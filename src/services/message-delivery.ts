/**
 * Message delivery service for routing messages to connected plugin clients.
 * Provides fire-and-forget delivery with status tracking for debugging.
 *
 * @see F-message-delivery-to-clients feature specification
 */

import { WebSocket } from "ws";
import { getLogger, Logger } from "./logger";
import { getClientRegistry, ClientRegistryService } from "./client-registry";
import {
  MessageId,
  ISOTimestamp,
  createTimestamp,
  RoutedMessage,
  WebSocketRoutedMessage,
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
}

/**
 * Configuration options for the message delivery service.
 */
export interface MessageDeliveryConfig {
  /** Maximum number of delivery statuses to keep in history (default: 100) */
  maxHistorySize?: number;
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
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_HISTORY_SIZE = 100;

// ============================================================================
// Helper Functions
// ============================================================================

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

  /** Delivery history, newest entries at the end */
  private readonly deliveryHistory: DeliveryStatus[] = [];

  constructor(config: MessageDeliveryConfig = {}) {
    this.logger = getLogger().child({ component: "MessageDelivery" });
    this.registry = getClientRegistry();
    this.maxHistorySize = config.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
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
