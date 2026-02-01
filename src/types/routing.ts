import { ErrorCode, isErrorCode } from "./errors";
import { ISOTimestamp } from "./common";
import { InputMethod } from "./messages";

// ============================================================================
// Routing Agent Types
// ============================================================================

/**
 * Record of a single client rejection for a message.
 */
export interface RejectionRecord {
  /** Name of the client that rejected the message */
  clientName: string;
  /** Reason provided by the client for rejection */
  reason: string;
  /** When the rejection occurred */
  rejectedAt: ISOTimestamp;
}

/**
 * History of routing attempts and rejections for a single message.
 * Used to track re-routing context and prevent routing to clients that already rejected.
 */
export interface RejectionHistory {
  /** The unique message ID being tracked */
  messageId: string;
  /** The original user message text */
  originalMessage: string;
  /** How the message was input (voice or text) */
  source: InputMethod;
  /** Optional additional metadata from the original routing request */
  metadata?: Record<string, unknown>;
  /** List of all rejections received for this message */
  rejections: RejectionRecord[];
  /** When this history entry was created */
  createdAt: ISOTimestamp;
}

/**
 * Events emitted by the RoutingAgentService for observability.
 */
export interface RoutingAgentEvents {
  /** Emitted when a message is successfully routed (initial or re-route) */
  "routing:success": (messageId: string, clientName: string, isReRoute: boolean) => void;
  /** Emitted when all available clients have rejected a message */
  "routing:rejected": (messageId: string, rejections: RejectionRecord[]) => void;
  /** Emitted when the routing system fails (API error, no clients, etc.) */
  "routing:failed": (messageId: string, error: string) => void;
}

/**
 * Information about a message delivery to a client.
 * Used in routing outcomes to track which clients received messages.
 */
export interface DeliveryInfo {
  /** Name of the client that received the message */
  clientName: string;
  /** Unique ID of the delivered message */
  messageId: string;
  /** True if message was routed via direct pattern matching (e.g., "notebook: remember this") */
  directRouted: boolean;
  /** Optional reason for routing to this client */
  reason?: string;
}

/**
 * Outcome of a routing operation.
 * Discriminated union representing all possible routing outcomes:
 * - "routed": Message(s) successfully delivered to client(s)
 * - "no_clients": No clients available to receive the message
 * - "routing_failed": Routing attempt failed with an error
 */
export type RoutingOutcome =
  | { type: "routed"; deliveries: DeliveryInfo[] }
  | { type: "no_clients"; message: string }
  | { type: "routing_failed"; error: string; fallbackAttempted: boolean };

/**
 * Service interface for the routing agent.
 * Orchestrates message routing to appropriate client(s) based on content analysis.
 */
export interface RoutingAgentService {
  /**
   * Route a message to appropriate client(s).
   *
   * @param params - Parameters for routing
   * @param params.message - The user's message text to route
   * @param params.source - How the message was input ("text" or "voice")
   * @param params.metadata - Optional additional metadata for the routing decision
   * @returns The outcome of the routing operation
   */
  routeMessage(params: {
    message: string;
    source: "text" | "voice";
    metadata?: Record<string, unknown>;
  }): Promise<RoutingOutcome>;

  /**
   * Subscribe to routing events.
   *
   * @param event - The event type to listen for
   * @param listener - The callback function
   */
  on<K extends keyof RoutingAgentEvents>(event: K, listener: RoutingAgentEvents[K]): void;

  /**
   * Unsubscribe from routing events.
   *
   * @param event - The event type to stop listening for
   * @param listener - The callback function to remove
   */
  off<K extends keyof RoutingAgentEvents>(event: K, listener: RoutingAgentEvents[K]): void;
}

/**
 * Result of direct routing pattern detection.
 * Returned when a message matches the direct routing pattern (e.g., "notebook: remember this").
 */
export interface DirectRouteResult {
  /** Name of the client to route to (matched from the pattern) */
  clientName: string;
  /** The actual message content (after stripping the client name prefix) */
  message: string;
  /** Always true for direct route results */
  directRouted: true;
}

// ============================================================================
// Routing Tool Types
// ============================================================================

export interface RoutingTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: {
      message: {
        type: "string";
        description: string;
      };
      reason: {
        type: "string";
        description: string;
      };
    };
    required: ["message"];
  };
}

export interface RoutingDecision {
  clientName: string;
  message: string;
  reason?: string;
}

export interface RoutingError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export type RoutingResult =
  | { success: true; decisions: RoutingDecision[] }
  | { success: false; error: RoutingError };

export interface RoutingRequestParams {
  userMessage: string;
  tools: RoutingTool[];
  systemPrompt: string;
  excludeClients?: string[];
  rejectionContext?: string;
}

export interface RoutingApiService {
  routeMessage(params: RoutingRequestParams): Promise<RoutingResult>;
}

export interface ToolGeneratorService {
  generateTools(): RoutingTool[];
  generateToolsExcluding(clientNames: string[]): RoutingTool[];
  resolveClientName(toolName: string): string | undefined;
}

export function isRoutingSuccess(
  result: RoutingResult
): result is { success: true; decisions: RoutingDecision[] } {
  return result.success === true;
}

export function isRoutingFailure(
  result: RoutingResult
): result is { success: false; error: RoutingError } {
  return result.success === false;
}

export function isRoutingDecision(value: unknown): value is RoutingDecision {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.clientName !== "string" || obj.clientName.length === 0) {
    return false;
  }

  if (typeof obj.message !== "string") {
    return false;
  }

  if (obj.reason !== undefined && typeof obj.reason !== "string") {
    return false;
  }

  return true;
}

export function isRoutingError(value: unknown): value is RoutingError {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (!isErrorCode(obj.code)) {
    return false;
  }

  if (typeof obj.message !== "string") {
    return false;
  }

  if (typeof obj.retryable !== "boolean") {
    return false;
  }

  return true;
}

export function isRoutingResult(value: unknown): value is RoutingResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.success === true) {
    if (!Array.isArray(obj.decisions)) {
      return false;
    }
    return obj.decisions.every(isRoutingDecision);
  } else if (obj.success === false) {
    return isRoutingError(obj.error);
  }

  return false;
}

// ============================================================================
// Routing Agent Type Guards
// ============================================================================

/**
 * Checks if a value is a valid DeliveryInfo.
 *
 * @param value - The value to check
 * @returns true if the value is a valid DeliveryInfo
 */
export function isDeliveryInfo(value: unknown): value is DeliveryInfo {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // clientName: required non-empty string
  if (typeof obj.clientName !== "string" || obj.clientName.length === 0) {
    return false;
  }

  // messageId: required string
  if (typeof obj.messageId !== "string") {
    return false;
  }

  // directRouted: required boolean
  if (typeof obj.directRouted !== "boolean") {
    return false;
  }

  // reason: optional string
  if (obj.reason !== undefined && typeof obj.reason !== "string") {
    return false;
  }

  return true;
}

/**
 * Checks if a value is a valid RoutingOutcome.
 * Validates the discriminated union structure based on the type field.
 *
 * @param value - The value to check
 * @returns true if the value is a valid RoutingOutcome
 */
export function isRoutingOutcome(value: unknown): value is RoutingOutcome {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // type: required string (discriminator)
  if (typeof obj.type !== "string") {
    return false;
  }

  switch (obj.type) {
    case "routed": {
      // deliveries: required array of DeliveryInfo
      if (!Array.isArray(obj.deliveries)) {
        return false;
      }
      return obj.deliveries.every(isDeliveryInfo);
    }

    case "no_clients": {
      // message: required string
      if (typeof obj.message !== "string") {
        return false;
      }
      return true;
    }

    case "routing_failed": {
      // error: required string
      if (typeof obj.error !== "string") {
        return false;
      }
      // fallbackAttempted: required boolean
      if (typeof obj.fallbackAttempted !== "boolean") {
        return false;
      }
      return true;
    }

    default:
      return false;
  }
}

/**
 * Checks if a value is a valid DirectRouteResult.
 *
 * @param value - The value to check
 * @returns true if the value is a valid DirectRouteResult
 */
export function isDirectRouteResult(value: unknown): value is DirectRouteResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // clientName: required non-empty string
  if (typeof obj.clientName !== "string" || obj.clientName.length === 0) {
    return false;
  }

  // message: required string
  if (typeof obj.message !== "string") {
    return false;
  }

  // directRouted: must be exactly true
  if (obj.directRouted !== true) {
    return false;
  }

  return true;
}
