/**
 * Routing Agent Service
 *
 * Orchestrates message routing by combining direct routing detection,
 * LLM-based routing via RoutingApiService, and message delivery via
 * MessageDeliveryService.
 *
 * The routing flow:
 * 1. Check for registered clients (return no_clients if none)
 * 2. Try direct routing pattern (e.g., "notebook: remember this")
 * 3. If no direct match, use LLM routing via RoutingApiService
 * 4. Deliver messages via MessageDeliveryService
 *
 * Rejection handling:
 * - Subscribes to MessageDeliveryService rejection events
 * - Tracks rejection history per message
 * - Re-routes with excluded clients and rejection context
 * - Notifies user when all clients reject
 */

import { EventEmitter } from "events";
import { getLogger, Logger } from "./logger";
import { getClientRegistry, ClientRegistryService } from "./client-registry";
import { getRoutingApi } from "./routing-api";
import { getToolGenerator } from "./tool-generator";
import { getMessageDelivery, MessageDeliveryService } from "./message-delivery";
import { getNotificationService, NotificationService } from "./notifications";
import { tryDirectRoute } from "./direct-routing";
import {
  RoutingAgentService as IRoutingAgentService,
  RoutingAgentEvents,
  RoutingApiService,
  ToolGeneratorService,
  RoutingOutcome,
  DeliveryInfo,
  RoutedMessage,
  InputMethod,
  RejectionHistory,
  RejectionRecord,
  createMessageId,
  createTimestamp,
  isRoutingSuccess,
  MessageId,
} from "../types";

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of rejections before giving up on routing a message */
const MAX_REJECTIONS = 3;

/** Time-to-live for rejection history entries in milliseconds (5 minutes) */
const REJECTION_HISTORY_TTL_MS = 5 * 60 * 1000;

/** Interval for cleaning up stale rejection history entries (1 minute) */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * System prompt for the routing LLM.
 * Guides the model to make routing decisions by calling tools.
 */
const ROUTING_SYSTEM_PROMPT = `You are a message routing agent for SmartHole, a system that connects users to various plugins and services.

Your role is to analyze the user's message and route it to the appropriate plugin(s) by calling the provided tools. Each tool represents a connected plugin, and its description explains what that plugin handles.

Guidelines:
1. **Always route**: You must call at least one tool for every message. Never respond with text only.
2. **Analyze intent**: Consider what the user is trying to accomplish and match it to the most appropriate plugin(s).
3. **Multi-routing allowed**: If a message could benefit from multiple plugins (e.g., "Remember to check calendar tomorrow"), you may call multiple tools.
4. **Include the full message**: Pass the complete user message to each tool, not a summary.
5. **Provide reasons**: When possible, include a brief reason explaining why you chose each plugin.
6. **When uncertain**: Route to the plugin that seems most likely to help, even if you're not 100% sure.

Remember: Your only job is routing. Do not attempt to answer questions or provide information directly.`;

// ============================================================================
// Implementation
// ============================================================================

class RoutingAgentServiceImpl implements IRoutingAgentService {
  private readonly logger: Logger;
  private readonly registry: ClientRegistryService;
  private readonly routingApi: RoutingApiService;
  private readonly toolGenerator: ToolGeneratorService;
  private readonly messageDelivery: MessageDeliveryService;
  private readonly notificationService: NotificationService;
  private readonly emitter: EventEmitter;

  /** Rejection history tracking, keyed by messageId */
  private readonly rejectionHistory: Map<string, RejectionHistory> = new Map();

  /** Bound rejection handler for cleanup */
  private readonly rejectionHandlerBound: (
    messageId: MessageId,
    clientName: string,
    reason: string
  ) => void;

  /** Interval for cleaning up stale history entries */
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    registry: ClientRegistryService,
    routingApi: RoutingApiService,
    toolGenerator: ToolGeneratorService,
    messageDelivery: MessageDeliveryService,
    notificationService: NotificationService
  ) {
    this.logger = getLogger().child({ component: "RoutingAgent" });
    this.registry = registry;
    this.routingApi = routingApi;
    this.toolGenerator = toolGenerator;
    this.messageDelivery = messageDelivery;
    this.notificationService = notificationService;
    this.emitter = new EventEmitter();

    // Bind and subscribe to rejection events
    this.rejectionHandlerBound = this.handleRejection.bind(this);
    this.messageDelivery.on("response:reject", this.rejectionHandlerBound);

    // Start cleanup interval
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupStaleHistory();
    }, CLEANUP_INTERVAL_MS);

    this.logger.debug("RoutingAgent initialized with rejection handling");
  }

  async routeMessage(params: {
    message: string;
    source: "text" | "voice";
    metadata?: Record<string, unknown>;
  }): Promise<RoutingOutcome> {
    const { message, source, metadata } = params;

    this.logger.debug("Routing message", {
      source,
      messageLength: message.length,
      hasMetadata: !!metadata,
    });

    // Step 1: Check for registered clients
    const clientCount = this.registry.getClientCount();
    if (clientCount === 0) {
      this.logger.info("No clients registered, cannot route message");
      this.notificationService.showWarning(
        "No plugins connected",
        "No plugins are currently connected. Please start a plugin and try again."
      );
      return {
        type: "no_clients",
        message: "No plugins are currently connected. Please start a plugin and try again.",
      };
    }

    // Get list of available client names for direct routing check
    const clients = this.registry.getAllClients();
    const clientNames = clients.map((c) => c.name);

    // Step 2: Try direct routing
    const directResult = tryDirectRoute(message, clientNames);
    if (directResult) {
      this.logger.info("Direct routing match found", {
        clientName: directResult.clientName,
        source,
      });
      return this.deliverDirectRouted(
        directResult.clientName,
        directResult.message,
        source,
        message,
        metadata
      );
    }

    // Step 3: Use LLM routing
    return this.routeViaLlm(message, source, metadata);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Deliver a directly-routed message to a single client.
   */
  private deliverDirectRouted(
    clientName: string,
    messageContent: string,
    source: InputMethod,
    originalMessage: string,
    metadata?: Record<string, unknown>
  ): RoutingOutcome {
    const routedMessage = this.createRoutedMessage(messageContent, source, true);

    // Store routing context for potential rejection handling
    this.rejectionHistory.set(routedMessage.id, {
      messageId: routedMessage.id,
      originalMessage,
      source,
      metadata,
      rejections: [],
      createdAt: createTimestamp(),
    });

    const result = this.messageDelivery.sendToClient(clientName, routedMessage);

    if (!result.success) {
      this.logger.error("Direct routing delivery failed", {
        clientName,
        messageId: routedMessage.id,
        error: result.error,
      });
      // Clean up rejection history since delivery failed
      this.rejectionHistory.delete(routedMessage.id);
      this.emitter.emit(
        "routing:failed",
        routedMessage.id,
        `Failed to deliver message to ${clientName}: ${result.error}`
      );
      return {
        type: "routing_failed",
        error: `Failed to deliver message to ${clientName}: ${result.error}`,
        fallbackAttempted: false,
      };
    }

    const deliveryInfo: DeliveryInfo = {
      clientName,
      messageId: routedMessage.id,
      directRouted: true,
    };

    this.logger.info("Direct routing completed", {
      clientName,
      messageId: routedMessage.id,
      source,
    });

    // Emit success event
    this.emitter.emit("routing:success", routedMessage.id, clientName, false);

    return {
      type: "routed",
      deliveries: [deliveryInfo],
    };
  }

  /**
   * Route a message using the LLM routing API.
   * If LLM routing fails, attempts direct routing as fallback.
   */
  private async routeViaLlm(
    message: string,
    source: InputMethod,
    metadata?: Record<string, unknown>
  ): Promise<RoutingOutcome> {
    // Generate tools from registered clients
    const tools = this.toolGenerator.generateTools();

    if (tools.length === 0) {
      this.logger.warn("No tools generated from registered clients");
      return {
        type: "no_clients",
        message: "No plugins are currently connected. Please start a plugin and try again.",
      };
    }

    this.logger.debug("Calling routing API", {
      toolCount: tools.length,
      source,
    });

    // Call the routing API
    const routingResult = await this.routingApi.routeMessage({
      userMessage: message,
      tools,
      systemPrompt: ROUTING_SYSTEM_PROMPT,
    });

    if (!isRoutingSuccess(routingResult)) {
      this.logger.error("LLM routing failed", {
        errorCode: routingResult.error.code,
        errorMessage: routingResult.error.message,
      });

      // Attempt fallback to direct routing
      return this.attemptDirectRoutingFallback(
        message,
        source,
        metadata,
        `LLM routing failed: ${routingResult.error.message}`
      );
    }

    // If no routing decisions were made, attempt fallback
    if (routingResult.decisions.length === 0) {
      this.logger.warn("LLM returned no routing decisions");

      // Attempt fallback to direct routing
      return this.attemptDirectRoutingFallback(
        message,
        source,
        metadata,
        "No routing decisions were made by the routing agent"
      );
    }

    // Deliver messages to each client
    const deliveries: DeliveryInfo[] = [];

    for (const decision of routingResult.decisions) {
      const routedMessage = this.createRoutedMessage(
        decision.message,
        source,
        false,
        decision.reason
      );

      // Store routing context for potential rejection handling
      this.rejectionHistory.set(routedMessage.id, {
        messageId: routedMessage.id,
        originalMessage: message,
        source,
        metadata,
        rejections: [],
        createdAt: createTimestamp(),
      });

      const result = this.messageDelivery.sendToClient(decision.clientName, routedMessage);

      if (result.success) {
        deliveries.push({
          clientName: decision.clientName,
          messageId: routedMessage.id,
          directRouted: false,
          reason: decision.reason,
        });

        this.logger.info("LLM routing delivery succeeded", {
          clientName: decision.clientName,
          messageId: routedMessage.id,
          reason: decision.reason,
        });

        // Emit success event
        this.emitter.emit("routing:success", routedMessage.id, decision.clientName, false);
      } else {
        this.logger.warn("LLM routing delivery failed", {
          clientName: decision.clientName,
          messageId: routedMessage.id,
          error: result.error,
        });
        // Clean up rejection history for failed delivery
        this.rejectionHistory.delete(routedMessage.id);
        // Continue delivering to other clients even if one fails
      }
    }

    // If all deliveries failed, attempt fallback
    if (deliveries.length === 0) {
      return this.attemptDirectRoutingFallback(
        message,
        source,
        metadata,
        "All message deliveries failed"
      );
    }

    this.logger.info("LLM routing completed", {
      totalDecisions: routingResult.decisions.length,
      successfulDeliveries: deliveries.length,
      source,
    });

    return {
      type: "routed",
      deliveries,
    };
  }

  /**
   * Attempt direct routing as a fallback when LLM routing fails.
   * Shows user notification if fallback also fails.
   */
  private attemptDirectRoutingFallback(
    message: string,
    source: InputMethod,
    metadata: Record<string, unknown> | undefined,
    originalError: string
  ): RoutingOutcome {
    this.logger.info("Attempting direct routing fallback", {
      reason: originalError,
      source,
    });

    // Get list of available client names for direct routing check
    const clients = this.registry.getAllClients();
    const clientNames = clients.map((c) => c.name);

    // Try direct routing pattern matching
    const directResult = tryDirectRoute(message, clientNames);

    if (directResult) {
      this.logger.info("Direct routing fallback found match", {
        clientName: directResult.clientName,
        source,
      });

      // Attempt to deliver via direct routing
      const routedMessage = this.createRoutedMessage(directResult.message, source, true);

      // Store routing context for potential rejection handling
      this.rejectionHistory.set(routedMessage.id, {
        messageId: routedMessage.id,
        originalMessage: message,
        source,
        metadata,
        rejections: [],
        createdAt: createTimestamp(),
      });

      const result = this.messageDelivery.sendToClient(directResult.clientName, routedMessage);

      if (result.success) {
        const deliveryInfo: DeliveryInfo = {
          clientName: directResult.clientName,
          messageId: routedMessage.id,
          directRouted: true,
        };

        this.logger.info("Direct routing fallback delivery succeeded", {
          clientName: directResult.clientName,
          messageId: routedMessage.id,
          source,
        });

        // Emit success event
        this.emitter.emit("routing:success", routedMessage.id, directResult.clientName, false);

        return {
          type: "routed",
          deliveries: [deliveryInfo],
        };
      }

      // Direct routing delivery failed
      this.logger.error("Direct routing fallback delivery failed", {
        clientName: directResult.clientName,
        messageId: routedMessage.id,
        error: result.error,
      });

      // Clean up rejection history since delivery failed
      this.rejectionHistory.delete(routedMessage.id);
    }

    // No direct route found or delivery failed - notify user and emit failure event
    this.logger.warn("Routing completely failed, notifying user", {
      originalError,
      fallbackAttempted: true,
    });

    this.notificationService.showWarning(
      "Routing unavailable",
      "Unable to determine the best plugin for your message. Please try again or use direct routing (e.g., 'notebook: your message')."
    );

    this.emitter.emit("routing:failed", "unknown", originalError);

    return {
      type: "routing_failed",
      error: originalError,
      fallbackAttempted: true,
    };
  }

  /**
   * Create a RoutedMessage with proper metadata.
   */
  private createRoutedMessage(
    text: string,
    source: InputMethod,
    directRouted: boolean,
    routingReason?: string
  ): RoutedMessage {
    return {
      id: createMessageId(crypto.randomUUID()),
      text,
      timestamp: createTimestamp(),
      metadata: {
        inputMethod: source,
        directRouted,
        routingReason,
      },
    };
  }

  // ==========================================================================
  // Rejection Handling Methods
  // ==========================================================================

  /**
   * Handle a rejection event from MessageDeliveryService.
   * Records the rejection and triggers re-routing if within limits.
   */
  private handleRejection(messageId: MessageId, clientName: string, reason: string): void {
    this.logger.debug("Handling rejection", { messageId, clientName, reason });

    const history = this.rejectionHistory.get(messageId);
    if (!history) {
      // No history for this message - it may have been cleaned up or wasn't tracked
      this.logger.warn("Received rejection for unknown message", { messageId, clientName });
      return;
    }

    // Add the rejection to history
    const rejection: RejectionRecord = {
      clientName,
      reason,
      rejectedAt: createTimestamp(),
    };
    history.rejections.push(rejection);

    this.logger.info("Recorded rejection", {
      messageId,
      clientName,
      reason,
      totalRejections: history.rejections.length,
    });

    // Check if we've hit the maximum rejection limit
    const availableClientCount = this.registry.getClientCount();
    const effectiveMaxRejections = Math.min(MAX_REJECTIONS, availableClientCount);

    if (history.rejections.length >= effectiveMaxRejections) {
      this.handleAllClientsRejected(messageId, history);
      return;
    }

    // Attempt re-routing
    this.reRouteMessage(messageId, history).catch((error) => {
      this.logger.error("Re-routing failed", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emitter.emit("routing:failed", messageId, "Re-routing failed unexpectedly");
    });
  }

  /**
   * Re-route a message after rejection, excluding clients that already rejected.
   */
  private async reRouteMessage(messageId: string, history: RejectionHistory): Promise<void> {
    const rejectedClients = history.rejections.map((r) => r.clientName);

    this.logger.debug("Re-routing message", {
      messageId,
      excludeClients: rejectedClients,
    });

    // Build rejection context for the LLM
    const rejectionContext = history.rejections
      .map((r) => `Routed to "${r.clientName}" but they rejected because: "${r.reason}"`)
      .join("\n");

    // Generate tools excluding rejected clients
    const tools = this.toolGenerator.generateToolsExcluding(rejectedClients);

    if (tools.length === 0) {
      this.logger.warn("No clients available after exclusions", { messageId });
      this.handleAllClientsRejected(messageId, history);
      return;
    }

    // Call the routing API with exclusion context
    const routingResult = await this.routingApi.routeMessage({
      userMessage: history.originalMessage,
      tools,
      systemPrompt: ROUTING_SYSTEM_PROMPT,
      excludeClients: rejectedClients,
      rejectionContext: `Previous routing attempts failed:\n${rejectionContext}\nPlease route to a different, more appropriate plugin.`,
    });

    if (!isRoutingSuccess(routingResult)) {
      this.logger.error("LLM re-routing failed", {
        messageId,
        errorCode: routingResult.error.code,
        errorMessage: routingResult.error.message,
      });
      this.emitter.emit("routing:failed", messageId, routingResult.error.message);
      this.rejectionHistory.delete(messageId);
      return;
    }

    // If no routing decisions were made, treat as all rejected
    if (routingResult.decisions.length === 0) {
      this.logger.warn("LLM returned no routing decisions on re-route", { messageId });
      this.handleAllClientsRejected(messageId, history);
      return;
    }

    // Deliver to the new client(s)
    let successfulDelivery = false;
    for (const decision of routingResult.decisions) {
      // Skip if this client already rejected
      if (rejectedClients.includes(decision.clientName)) {
        this.logger.warn("LLM suggested already-rejected client", {
          messageId,
          clientName: decision.clientName,
        });
        continue;
      }

      const routedMessage = this.createRoutedMessage(
        decision.message,
        history.source,
        false,
        decision.reason
      );

      // Update the history with the new message ID for tracking
      this.rejectionHistory.delete(messageId);
      this.rejectionHistory.set(routedMessage.id, {
        ...history,
        messageId: routedMessage.id,
      });

      const result = this.messageDelivery.sendToClient(decision.clientName, routedMessage);

      if (result.success) {
        successfulDelivery = true;
        this.logger.info("Re-routing delivery succeeded", {
          originalMessageId: messageId,
          newMessageId: routedMessage.id,
          clientName: decision.clientName,
          reason: decision.reason,
        });
        this.emitter.emit("routing:success", routedMessage.id, decision.clientName, true);
      } else {
        this.logger.warn("Re-routing delivery failed", {
          messageId: routedMessage.id,
          clientName: decision.clientName,
          error: result.error,
        });
      }
    }

    if (!successfulDelivery) {
      this.handleAllClientsRejected(messageId, history);
    }
  }

  /**
   * Handle the case when all available clients have rejected a message.
   * Notifies the user and cleans up tracking state.
   */
  private handleAllClientsRejected(messageId: string, history: RejectionHistory): void {
    this.logger.warn("All clients rejected message", {
      messageId,
      rejectionCount: history.rejections.length,
      rejections: history.rejections.map((r) => ({
        client: r.clientName,
        reason: r.reason,
      })),
    });

    // Build notification body with rejection details
    const rejectionSummary = history.rejections
      .map((r) => `- ${r.clientName}: ${r.reason}`)
      .join("\n");

    // Notify the user
    this.notificationService.showWarning(
      "Unable to route message",
      `No plugin could handle your message.\n\nTried:\n${rejectionSummary}`
    );

    // Emit the routing:rejected event
    this.emitter.emit("routing:rejected", messageId, history.rejections);

    // Clean up
    this.rejectionHistory.delete(messageId);
  }

  /**
   * Clean up stale rejection history entries that have exceeded the TTL.
   */
  private cleanupStaleHistory(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [messageId, history] of this.rejectionHistory.entries()) {
      const createdAt = new Date(history.createdAt).getTime();
      if (now - createdAt > REJECTION_HISTORY_TTL_MS) {
        this.rejectionHistory.delete(messageId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug("Cleaned up stale rejection history", { count: cleanedCount });
    }
  }

  /**
   * Clean up resources and unsubscribe from events.
   * Called during service reset.
   */
  cleanup(): void {
    // Unsubscribe from rejection events
    this.messageDelivery.off("response:reject", this.rejectionHandlerBound);

    // Clear the cleanup interval
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Clear rejection history
    this.rejectionHistory.clear();

    // Remove all event listeners
    this.emitter.removeAllListeners();

    this.logger.debug("RoutingAgent cleaned up");
  }

  // ==========================================================================
  // Event Subscription Methods
  // ==========================================================================

  /**
   * Subscribe to routing events.
   */
  on<K extends keyof RoutingAgentEvents>(event: K, listener: RoutingAgentEvents[K]): void {
    this.emitter.on(event, listener);
  }

  /**
   * Unsubscribe from routing events.
   */
  off<K extends keyof RoutingAgentEvents>(event: K, listener: RoutingAgentEvents[K]): void {
    this.emitter.off(event, listener);
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let routingAgentInstance: RoutingAgentServiceImpl | null = null;

/**
 * Initializes the global routing agent instance.
 * Must be called inside `app.whenReady()` after all dependencies have been initialized:
 * - Logger
 * - ClientRegistry
 * - RoutingApiService
 * - ToolGeneratorService
 * - MessageDeliveryService
 *
 * @returns The initialized RoutingAgentService instance
 * @throws Error if dependencies have not been initialized
 */
export function initializeRoutingAgent(): IRoutingAgentService {
  if (routingAgentInstance) {
    return routingAgentInstance;
  }

  const registry = getClientRegistry();
  const routingApi = getRoutingApi();
  const toolGenerator = getToolGenerator();
  const messageDelivery = getMessageDelivery();
  const notificationService = getNotificationService();

  routingAgentInstance = new RoutingAgentServiceImpl(
    registry,
    routingApi,
    toolGenerator,
    messageDelivery,
    notificationService
  );
  return routingAgentInstance;
}

/**
 * Gets the current routing agent service instance.
 * Throws if initializeRoutingAgent() has not been called.
 *
 * @returns The RoutingAgentService instance
 * @throws Error if routing agent has not been initialized
 */
export function getRoutingAgent(): IRoutingAgentService {
  if (!routingAgentInstance) {
    throw new Error(
      "RoutingAgent not initialized. Call initializeRoutingAgent() before using getRoutingAgent()."
    );
  }
  return routingAgentInstance;
}

/**
 * Resets the routing agent instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetRoutingAgent(): void {
  if (routingAgentInstance) {
    routingAgentInstance.cleanup();
  }
  routingAgentInstance = null;
}
