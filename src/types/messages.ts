/**
 * WebSocket message types for the SmartHole plugin communication protocol.
 * These types define the contracts for client registration, message routing,
 * and client responses over WebSocket connections.
 *
 * @see docs/requirements/smarthole-mvp.md - Plugin/Client System section
 */

import { MessageId, ClientId, ISOTimestamp } from "./common";

// ============================================================================
// Client Registration
// ============================================================================

/**
 * Sent by client immediately after WebSocket connection.
 * Contains information used by the routing agent to decide message destinations.
 *
 * @see smarthole-mvp.md - Client Registration section
 *
 * @example
 * ```ts
 * const registration: ClientRegistration = {
 *   name: "notebook",
 *   description: "I handle note-taking, journaling, memory storage, and anything the user wants to remember.",
 *   version: "1.0.0",
 *   capabilities: ["notes", "memory", "journaling"]
 * };
 * ```
 */
export interface ClientRegistration {
  /** Unique identifier for the client (e.g., "notebook", "home-assistant") */
  name: string;

  /** Free-form description for LLM routing decisions */
  description: string;

  /** Optional client version for debugging */
  version?: string;

  /** Optional structured capability hints */
  capabilities?: string[];
}

/**
 * Internal representation of a registered client.
 * Extends registration with server-assigned metadata.
 */
export interface RegisteredClient extends ClientRegistration {
  /** Server-assigned unique ID */
  id: ClientId;

  /** Timestamp when client connected */
  connectedAt: ISOTimestamp;

  /** Connection status */
  status: "connected" | "disconnected";
}

// ============================================================================
// Message Routing
// ============================================================================

/** How the message was input by the user */
export type InputMethod = "voice" | "text";

/**
 * Metadata attached to routed messages.
 * Provides context about how the message was captured and routed.
 */
export interface MessageMetadata {
  /** STT confidence score if available (0-1 range) */
  confidence?: number;

  /** Routing agent's reason for selecting this client */
  routingReason?: string;

  /** How the user provided input */
  inputMethod: InputMethod;

  /** True if message bypassed routing agent (e.g., "notebook: remember this") */
  directRouted: boolean;
}

/**
 * Message sent from SmartHole to a client plugin.
 * Contains the user's input and metadata for processing.
 *
 * @see smarthole-mvp.md - Message Delivery section
 *
 * @example
 * ```ts
 * const message: RoutedMessage = {
 *   id: createMessageId("msg-123"),
 *   text: "Remember to buy groceries",
 *   timestamp: createTimestamp(),
 *   metadata: {
 *     inputMethod: "voice",
 *     directRouted: false,
 *     confidence: 0.95,
 *     routingReason: "User wants to remember something"
 *   }
 * };
 * ```
 */
export interface RoutedMessage {
  /** Unique message ID for correlation */
  id: MessageId;

  /** Raw transcribed text (unmodified from user input) */
  text: string;

  /** ISO 8601 timestamp when message was created */
  timestamp: ISOTimestamp;

  /** Additional metadata about the message */
  metadata: MessageMetadata;
}

// ============================================================================
// Client Responses
// ============================================================================

/** Response type from client back to SmartHole */
export type ClientResponseType = "ack" | "reject" | "notification";

/** Priority level for client-requested notifications */
export type ClientNotificationPriority = "low" | "normal" | "high";

/**
 * Payload for 'reject' response type.
 * Used when a client cannot or chooses not to handle a message.
 */
export interface RejectPayload {
  /** Why the client cannot handle this message */
  reason?: string;
}

/**
 * Payload for 'notification' response type.
 * Client requests SmartHole to show a notification to the user.
 */
export interface NotificationPayload {
  /** Notification title */
  title?: string;

  /** Notification body text */
  body?: string;

  /** Notification priority level */
  priority?: ClientNotificationPriority;
}

/**
 * Empty payload type for 'ack' responses.
 * Ack responses don't carry additional data.
 */
export type AckPayload = Record<string, never>;

/**
 * Response from a client to a routed message.
 * Used to acknowledge, reject, or request notifications for processed messages.
 *
 * @see smarthole-mvp.md - Client Responses section
 *
 * @example
 * ```ts
 * // Acknowledge receipt
 * const ack: ClientResponse = {
 *   messageId: createMessageId("msg-123"),
 *   type: "ack",
 *   payload: {}
 * };
 *
 * // Reject with reason
 * const reject: ClientResponse = {
 *   messageId: createMessageId("msg-123"),
 *   type: "reject",
 *   payload: { reason: "I don't handle calendar events" }
 * };
 *
 * // Request notification
 * const notify: ClientResponse = {
 *   messageId: createMessageId("msg-123"),
 *   type: "notification",
 *   payload: { title: "Note saved", body: "Your note was saved successfully" }
 * };
 * ```
 */
export interface ClientResponse {
  /** Correlates to RoutedMessage.id */
  messageId: MessageId;

  /** Type of response */
  type: ClientResponseType;

  /** Response-specific payload */
  payload: RejectPayload | NotificationPayload | AckPayload;
}

// ============================================================================
// Type Guards for Response Types
// ============================================================================

/**
 * Checks if a ClientResponse is a reject response.
 * Validates both the type and that the payload matches RejectPayload structure.
 *
 * @param response - The response to check
 * @returns true if this is a reject response with valid payload
 */
export function isRejectResponse(
  response: ClientResponse
): response is ClientResponse & { type: "reject"; payload: RejectPayload } {
  if (response.type !== "reject") {
    return false;
  }
  // Validate payload structure - should only have optional 'reason' string
  const payload = response.payload;
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  if ("reason" in payload && typeof payload.reason !== "string") {
    return false;
  }
  return true;
}

/**
 * Checks if a ClientResponse is a notification response.
 * Validates both the type and that the payload matches NotificationPayload structure.
 *
 * @param response - The response to check
 * @returns true if this is a notification response with valid payload
 */
export function isNotificationResponse(response: ClientResponse): response is ClientResponse & {
  type: "notification";
  payload: NotificationPayload;
} {
  if (response.type !== "notification") {
    return false;
  }
  // Validate payload structure
  const payload = response.payload;
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  if ("title" in payload && typeof payload.title !== "string") {
    return false;
  }
  if ("body" in payload && typeof payload.body !== "string") {
    return false;
  }
  if (
    "priority" in payload &&
    payload.priority !== "low" &&
    payload.priority !== "normal" &&
    payload.priority !== "high"
  ) {
    return false;
  }
  return true;
}

/**
 * Checks if a ClientResponse is an ack response.
 * Validates that the type is 'ack' and payload is empty.
 *
 * @param response - The response to check
 * @returns true if this is an ack response
 */
export function isAckResponse(
  response: ClientResponse
): response is ClientResponse & { type: "ack"; payload: AckPayload } {
  if (response.type !== "ack") {
    return false;
  }
  // Ack payload should be empty object
  const payload = response.payload;
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  return Object.keys(payload).length === 0;
}

// ============================================================================
// WebSocket Protocol Messages (Wire Format)
// ============================================================================

/**
 * Registration message sent by client after connection.
 */
export interface WebSocketRegistrationMessage {
  type: "registration";
  payload: ClientRegistration;
}

/**
 * Routed message sent from SmartHole to client.
 */
export interface WebSocketRoutedMessage {
  type: "message";
  payload: RoutedMessage;
}

/**
 * Response message sent from client to SmartHole.
 */
export interface WebSocketResponseMessage {
  type: "response";
  payload: ClientResponse;
}

/**
 * Discriminated union of all WebSocket message types.
 * Used for parsing incoming messages on the wire.
 *
 * @example
 * ```ts
 * function handleMessage(msg: WebSocketMessage) {
 *   switch (msg.type) {
 *     case "registration":
 *       handleRegistration(msg.payload);
 *       break;
 *     case "message":
 *       handleRoutedMessage(msg.payload);
 *       break;
 *     case "response":
 *       handleResponse(msg.payload);
 *       break;
 *   }
 * }
 * ```
 */
export type WebSocketMessage =
  | WebSocketRegistrationMessage
  | WebSocketRoutedMessage
  | WebSocketResponseMessage;

/**
 * Extracts the message type strings from WebSocketMessage union.
 */
export type WebSocketMessageType = WebSocketMessage["type"];

// ============================================================================
// Type Guards for WebSocket Messages
// ============================================================================

/**
 * Checks if a value is a valid WebSocketMessage.
 * Validates the structure matches one of the expected message types.
 *
 * @param value - The value to check
 * @returns true if the value is a valid WebSocketMessage
 */
export function isWebSocketMessage(value: unknown): value is WebSocketMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const msg = value as Record<string, unknown>;

  if (!("type" in msg) || !("payload" in msg)) {
    return false;
  }

  if (typeof msg.type !== "string") {
    return false;
  }

  return msg.type === "registration" || msg.type === "message" || msg.type === "response";
}

/**
 * Checks if a WebSocketMessage is a registration message.
 *
 * @param msg - The message to check
 * @returns true if this is a registration message
 */
export function isRegistrationMessage(msg: WebSocketMessage): msg is WebSocketRegistrationMessage {
  return msg.type === "registration";
}

/**
 * Checks if a WebSocketMessage is a routed message.
 *
 * @param msg - The message to check
 * @returns true if this is a routed message
 */
export function isRoutedMessage(msg: WebSocketMessage): msg is WebSocketRoutedMessage {
  return msg.type === "message";
}

/**
 * Checks if a WebSocketMessage is a response message.
 *
 * @param msg - The message to check
 * @returns true if this is a response message
 */
export function isResponseMessage(msg: WebSocketMessage): msg is WebSocketResponseMessage {
  return msg.type === "response";
}
