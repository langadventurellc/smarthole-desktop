/**
 * Message delivery service for routing messages to connected plugin clients.
 * Provides fire-and-forget delivery with status tracking for debugging.
 *
 * @see F-message-delivery-to-clients feature specification
 */

import { WebSocket, RawData } from "ws";
import { EventEmitter } from "events";
import { getLogger, Logger } from "./logger";
import { getClientRegistry, ClientRegistryService } from "./client-registry";
import {
  MessageId,
  ClientId,
  ISOTimestamp,
  createTimestamp,
  RoutedMessage,
  WebSocketRoutedMessage,
  ClientResponse,
  ClientResponseType,
  RejectPayload,
  NotificationPayload,
  isWebSocketMessage,
  isResponseMessage,
  isAckResponse,
  isRejectResponse,
  isNotificationResponse,
} from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Error codes for message delivery failures.
 */
export type DeliveryError =
  | "CLIENT_NOT_FOUND" // Client name not in registry
  | "CLIENT_NOT_CONNECTED" // Client registered but WebSocket closed
  | "SEND_FAILED"; // WebSocket send threw an error

/**
 * Result of a message delivery attempt.
 */
export type DeliveryResult =
  | { success: true; deliveredAt: ISOTimestamp }
  | { success: false; error: DeliveryError };

/**
 * Response information attached to a delivery status after client responds.
 */
export interface DeliveryResponse {
  /** The type of response received */
  type: ClientResponseType;
  /** When the response was received */
  receivedAt: ISOTimestamp;
  /** Payload for reject or notification responses */
  payload?: RejectPayload | NotificationPayload;
}

/**
 * Status record for a single delivery attempt.
 * Used for debugging and audit trail.
 */
export interface DeliveryStatus {
  /** The message ID that was delivered */
  messageId: MessageId;
  /** The client name the message was sent to */
  clientName: string;
  /** The result of the delivery attempt */
  result: DeliveryResult;
  /** When the delivery was attempted */
  attemptedAt: ISOTimestamp;
  /** Response from the client, if received */
  response?: DeliveryResponse;
}

/**
 * Configuration options for the message delivery service.
 */
export interface MessageDeliveryConfig {
  /** Maximum number of delivery statuses to keep in history (default: 100) */
  maxHistorySize?: number;
}

/**
 * Context for handling a response message.
 */
export interface ResponseContext {
  /** The connection ID that sent the response */
  connectionId: ClientId;
}

/**
 * Result of processing a response message.
 */
export type ResponseProcessResult =
  | { handled: true; responseType: ClientResponseType }
  | {
      handled: false;
      reason: "not_response" | "invalid_message" | "parse_error" | "unknown_message";
    };

/**
 * Events emitted by the message delivery service.
 */
export interface MessageDeliveryEvents {
  /** Emitted when an ack response is received */
  "response:ack": (messageId: MessageId, clientName: string) => void;
  /** Emitted when a reject response is received */
  "response:reject": (messageId: MessageId, clientName: string, reason: string) => void;
  /** Emitted when a notification response is received */
  "response:notification": (
    messageId: MessageId,
    clientName: string,
    notification: NotificationPayload
  ) => void;
}

/**
 * Message delivery service interface.
 * Provides methods for sending messages to registered clients.
 */
export interface MessageDeliveryService {
  /**
   * Send a message to a single client by name.
   *
   * @param clientName - The name of the client to send to
   * @param message - The routed message to deliver
   * @returns Result indicating success or failure with error code
   */
  sendToClient(clientName: string, message: RoutedMessage): DeliveryResult;

  /**
   * Send a message to multiple clients.
   *
   * @param clientNames - Array of client names to send to
   * @param message - The routed message to deliver
   * @returns Map of client names to their delivery results
   */
  sendToClients(clientNames: string[], message: RoutedMessage): Map<string, DeliveryResult>;

  /**
   * Get the delivery status for a specific message.
   * Returns the most recent delivery status for the given message ID.
   *
   * @param messageId - The message ID to look up
   * @returns The delivery status if found, undefined otherwise
   */
  getDeliveryStatus(messageId: MessageId): DeliveryStatus | undefined;

  /**
   * Get all recent delivery statuses for debugging.
   *
   * @param limit - Maximum number of statuses to return (default: all)
   * @returns Array of delivery statuses, newest first
   */
  getRecentDeliveries(limit?: number): DeliveryStatus[];

  /**
   * Clear all delivery history.
   */
  clearDeliveryHistory(): void;

  /**
   * Process a raw WebSocket message that may be a client response.
   * If it's a response message, handles updating delivery status and emitting events.
   *
   * @param data - The raw message data from WebSocket
   * @param context - The connection context
   * @returns Result indicating if the message was handled
   */
  handleResponse(data: RawData, context: ResponseContext): ResponseProcessResult;

  /**
   * Subscribe to response events.
   *
   * @param event - The event type to listen for
   * @param listener - The callback function
   */
  on<K extends keyof MessageDeliveryEvents>(event: K, listener: MessageDeliveryEvents[K]): void;

  /**
   * Unsubscribe from response events.
   *
   * @param event - The event type to stop listening for
   * @param listener - The callback function to remove
   */
  off<K extends keyof MessageDeliveryEvents>(event: K, listener: MessageDeliveryEvents[K]): void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_HISTORY_SIZE = 100;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse raw WebSocket data to a JSON object.
 *
 * @param data - Raw WebSocket message data
 * @param logger - Logger for error reporting
 * @returns Parsed object or null if parsing fails
 */
function parseMessage(data: RawData, logger: Logger): unknown | null {
  try {
    const text = data.toString();
    return JSON.parse(text);
  } catch {
    logger.debug("Failed to parse message as JSON");
    return null;
  }
}

/**
 * Create the wire format message for WebSocket delivery.
 *
 * @param message - The routed message to wrap
 * @returns The WebSocket wire format message
 */
function createWireMessage(message: RoutedMessage): WebSocketRoutedMessage {
  return {
    type: "message",
    payload: message,
  };
}

/**
 * Check if a WebSocket connection is in the OPEN state.
 *
 * @param ws - The WebSocket to check
 * @returns true if the connection is open and ready to send
 */
function isConnectionOpen(ws: WebSocket): boolean {
  return ws.readyState === WebSocket.OPEN;
}

// ============================================================================
// Message Delivery Implementation
// ============================================================================

/**
 * Internal implementation of the MessageDeliveryService.
 */
class MessageDeliveryImpl implements MessageDeliveryService {
  private readonly logger: Logger;
  private readonly registry: ClientRegistryService;
  private readonly maxHistorySize: number;
  private readonly emitter: EventEmitter;

  /** Delivery history, newest entries at the end */
  private readonly deliveryHistory: DeliveryStatus[] = [];

  constructor(config: MessageDeliveryConfig = {}) {
    this.logger = getLogger().child({ component: "MessageDelivery" });
    this.registry = getClientRegistry();
    this.maxHistorySize = config.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
    this.emitter = new EventEmitter();
  }

  /**
   * Send a message to a single client by name.
   */
  sendToClient(clientName: string, message: RoutedMessage): DeliveryResult {
    const attemptedAt = createTimestamp();
    const result = this.attemptDelivery(clientName, message);

    // Track the delivery
    this.recordDelivery({
      messageId: message.id,
      clientName,
      result,
      attemptedAt,
    });

    // Log the delivery attempt
    this.logDelivery(message.id, clientName, result);

    return result;
  }

  /**
   * Send a message to multiple clients.
   */
  sendToClients(clientNames: string[], message: RoutedMessage): Map<string, DeliveryResult> {
    const results = new Map<string, DeliveryResult>();

    for (const clientName of clientNames) {
      const result = this.sendToClient(clientName, message);
      results.set(clientName, result);
    }

    return results;
  }

  /**
   * Get the delivery status for a specific message.
   */
  getDeliveryStatus(messageId: MessageId): DeliveryStatus | undefined {
    // Search from newest to oldest
    for (let i = this.deliveryHistory.length - 1; i >= 0; i--) {
      if (this.deliveryHistory[i].messageId === messageId) {
        return this.deliveryHistory[i];
      }
    }
    return undefined;
  }

  /**
   * Get all recent delivery statuses.
   */
  getRecentDeliveries(limit?: number): DeliveryStatus[] {
    // Return newest first
    const reversed = [...this.deliveryHistory].reverse();
    if (limit === undefined || limit >= reversed.length) {
      return reversed;
    }
    return reversed.slice(0, limit);
  }

  /**
   * Clear all delivery history.
   */
  clearDeliveryHistory(): void {
    this.deliveryHistory.length = 0;
    this.logger.debug("Delivery history cleared");
  }

  /**
   * Process a raw WebSocket message that may be a client response.
   */
  handleResponse(data: RawData, context: ResponseContext): ResponseProcessResult {
    // Parse the message
    const parsed = parseMessage(data, this.logger);
    if (parsed === null) {
      return { handled: false, reason: "parse_error" };
    }

    // Check if it's a valid WebSocket message
    if (!isWebSocketMessage(parsed)) {
      this.logger.debug("Received non-WebSocket message format");
      return { handled: false, reason: "invalid_message" };
    }

    // Check if it's a response message
    if (!isResponseMessage(parsed)) {
      return { handled: false, reason: "not_response" };
    }

    // Handle the response
    const response: ClientResponse = parsed.payload;
    return this.processResponse(response, context);
  }

  /**
   * Subscribe to response events.
   */
  on<K extends keyof MessageDeliveryEvents>(event: K, listener: MessageDeliveryEvents[K]): void {
    this.emitter.on(event, listener);
  }

  /**
   * Unsubscribe from response events.
   */
  off<K extends keyof MessageDeliveryEvents>(event: K, listener: MessageDeliveryEvents[K]): void {
    this.emitter.off(event, listener);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Attempt to deliver a message to a client.
   * Returns the result without recording or logging (caller handles that).
   */
  private attemptDelivery(clientName: string, message: RoutedMessage): DeliveryResult {
    // Look up the client
    const client = this.registry.getClient(clientName);
    if (!client) {
      return { success: false, error: "CLIENT_NOT_FOUND" };
    }

    // Check if connection is open
    if (!isConnectionOpen(client.connection)) {
      return { success: false, error: "CLIENT_NOT_CONNECTED" };
    }

    // Attempt to send
    try {
      const wireMessage = createWireMessage(message);
      client.connection.send(JSON.stringify(wireMessage));
      return { success: true, deliveredAt: createTimestamp() };
    } catch {
      return { success: false, error: "SEND_FAILED" };
    }
  }

  /**
   * Record a delivery status in history with LRU eviction.
   */
  private recordDelivery(status: DeliveryStatus): void {
    this.deliveryHistory.push(status);

    // Evict oldest entries if over limit
    while (this.deliveryHistory.length > this.maxHistorySize) {
      this.deliveryHistory.shift();
    }
  }

  /**
   * Log a delivery attempt with structured data.
   */
  private logDelivery(messageId: MessageId, clientName: string, result: DeliveryResult): void {
    if (result.success) {
      this.logger.info("Message delivered", {
        messageId,
        clientName,
        success: true,
        deliveredAt: result.deliveredAt,
      });
    } else {
      this.logger.warn("Message delivery failed", {
        messageId,
        clientName,
        success: false,
        error: result.error,
      });
    }
  }

  /**
   * Process a validated client response.
   */
  private processResponse(
    response: ClientResponse,
    context: ResponseContext
  ): ResponseProcessResult {
    const { messageId } = response;
    const receivedAt = createTimestamp();

    // Look up the client name from the connection ID
    const client = this.registry.getClientById(context.connectionId);
    const clientName = client?.name ?? "unknown";

    // Find the delivery status for this message
    const status = this.findDeliveryStatusForUpdate(messageId, clientName);

    if (!status) {
      this.logger.warn("Received response for unknown message", {
        messageId,
        clientName,
        connectionId: context.connectionId,
        responseType: response.type,
      });
      // Still process the response type for event emission, but log the warning
      return { handled: false, reason: "unknown_message" };
    }

    // Update delivery status with response
    if (isAckResponse(response)) {
      status.response = {
        type: "ack",
        receivedAt,
      };

      this.logger.info("Message acknowledged", {
        messageId,
        clientName,
      });

      this.emitter.emit("response:ack", messageId, clientName);
      return { handled: true, responseType: "ack" };
    }

    if (isRejectResponse(response)) {
      const reason = response.payload.reason ?? "No reason provided";
      status.response = {
        type: "reject",
        receivedAt,
        payload: response.payload,
      };

      this.logger.warn("Message rejected by client", {
        messageId,
        clientName,
        reason,
      });

      this.emitter.emit("response:reject", messageId, clientName, reason);
      return { handled: true, responseType: "reject" };
    }

    if (isNotificationResponse(response)) {
      status.response = {
        type: "notification",
        receivedAt,
        payload: response.payload,
      };

      this.logger.info("Client requested notification", {
        messageId,
        clientName,
        title: response.payload.title,
        priority: response.payload.priority,
      });

      this.emitter.emit("response:notification", messageId, clientName, response.payload);
      return { handled: true, responseType: "notification" };
    }

    // Unknown response type (shouldn't happen if type guards work correctly)
    this.logger.warn("Unknown response type", {
      messageId,
      clientName,
      responseType: response.type,
    });
    return { handled: false, reason: "invalid_message" };
  }

  /**
   * Find a delivery status record for updating with a response.
   * Searches for a matching messageId and clientName combination.
   */
  private findDeliveryStatusForUpdate(
    messageId: MessageId,
    clientName: string
  ): DeliveryStatus | undefined {
    // Search from newest to oldest for the matching delivery
    for (let i = this.deliveryHistory.length - 1; i >= 0; i--) {
      const status = this.deliveryHistory[i];
      if (status.messageId === messageId && status.clientName === clientName) {
        return status;
      }
    }
    return undefined;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

/**
 * Singleton instance of the message delivery service.
 */
let messageDeliveryInstance: MessageDeliveryImpl | null = null;

/**
 * Initializes the global message delivery service instance.
 * This should be called inside `app.whenReady()` after the logger
 * and client registry have been initialized.
 *
 * @param config - Optional configuration options
 * @returns The initialized MessageDeliveryService instance
 * @throws Error if logger or client registry has not been initialized
 *
 * @example
 * ```typescript
 * import { initializeMessageDelivery } from './services/message-delivery';
 *
 * // Inside app.whenReady(), after logger and registry initialization
 * const delivery = initializeMessageDelivery();
 * ```
 */
export function initializeMessageDelivery(config?: MessageDeliveryConfig): MessageDeliveryService {
  if (messageDeliveryInstance) {
    // Already initialized, return existing instance
    return messageDeliveryInstance;
  }

  messageDeliveryInstance = new MessageDeliveryImpl(config);
  return messageDeliveryInstance;
}

/**
 * Gets the current message delivery service instance.
 * Throws if initializeMessageDelivery() has not been called.
 *
 * @returns The MessageDeliveryService instance
 * @throws Error if message delivery has not been initialized
 */
export function getMessageDelivery(): MessageDeliveryService {
  if (!messageDeliveryInstance) {
    throw new Error(
      "MessageDelivery not initialized. Call initializeMessageDelivery() before using getMessageDelivery()."
    );
  }
  return messageDeliveryInstance;
}

/**
 * Resets the message delivery instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetMessageDelivery(): void {
  if (messageDeliveryInstance) {
    messageDeliveryInstance.clearDeliveryHistory();
  }
  messageDeliveryInstance = null;
}
