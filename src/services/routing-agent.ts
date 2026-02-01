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
 */

import { getLogger, Logger } from "./logger";
import { getClientRegistry, ClientRegistryService } from "./client-registry";
import { getRoutingApi } from "./routing-api";
import { getToolGenerator } from "./tool-generator";
import { getMessageDelivery, MessageDeliveryService } from "./message-delivery";
import { tryDirectRoute } from "./direct-routing";
import {
  RoutingAgentService as IRoutingAgentService,
  RoutingApiService,
  ToolGeneratorService,
  RoutingOutcome,
  DeliveryInfo,
  RoutedMessage,
  InputMethod,
  createMessageId,
  createTimestamp,
  isRoutingSuccess,
} from "../types";

// ============================================================================
// Constants
// ============================================================================

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

  constructor(
    registry: ClientRegistryService,
    routingApi: RoutingApiService,
    toolGenerator: ToolGeneratorService,
    messageDelivery: MessageDeliveryService
  ) {
    this.logger = getLogger().child({ component: "RoutingAgent" });
    this.registry = registry;
    this.routingApi = routingApi;
    this.toolGenerator = toolGenerator;
    this.messageDelivery = messageDelivery;

    this.logger.debug("RoutingAgent initialized");
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
      return this.deliverDirectRouted(directResult.clientName, directResult.message, source);
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
    source: InputMethod
  ): RoutingOutcome {
    const routedMessage = this.createRoutedMessage(messageContent, source, true);

    const result = this.messageDelivery.sendToClient(clientName, routedMessage);

    if (!result.success) {
      this.logger.error("Direct routing delivery failed", {
        clientName,
        messageId: routedMessage.id,
        error: result.error,
      });
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

    return {
      type: "routed",
      deliveries: [deliveryInfo],
    };
  }

  /**
   * Route a message using the LLM routing API.
   */
  private async routeViaLlm(
    message: string,
    source: InputMethod,
    _metadata?: Record<string, unknown>
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
      return {
        type: "routing_failed",
        error: routingResult.error.message,
        fallbackAttempted: false,
      };
    }

    // If no routing decisions were made, return failure
    if (routingResult.decisions.length === 0) {
      this.logger.warn("LLM returned no routing decisions");
      return {
        type: "routing_failed",
        error: "No routing decisions were made by the routing agent",
        fallbackAttempted: false,
      };
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
      } else {
        this.logger.warn("LLM routing delivery failed", {
          clientName: decision.clientName,
          messageId: routedMessage.id,
          error: result.error,
        });
        // Continue delivering to other clients even if one fails
      }
    }

    // If all deliveries failed, return failure
    if (deliveries.length === 0) {
      return {
        type: "routing_failed",
        error: "All message deliveries failed",
        fallbackAttempted: false,
      };
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

  routingAgentInstance = new RoutingAgentServiceImpl(
    registry,
    routingApi,
    toolGenerator,
    messageDelivery
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
  routingAgentInstance = null;
}
