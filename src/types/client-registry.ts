/**
 * Type definitions for the client registry system.
 * Defines types for tracking registered plugin clients and registry events.
 *
 * @see F-client-registration-registry feature specification
 */

import { WebSocket } from "ws";
import { ClientId, ISOTimestamp } from "./common";

// ============================================================================
// Re-export base types for convenience
// ============================================================================

export type { ClientRegistration } from "./messages";

// ============================================================================
// Registry Client Types
// ============================================================================

/**
 * A client that has been registered with the registry.
 * Extends the registration data with server-side tracking information
 * and maintains a reference to the WebSocket connection.
 */
export interface RegistryClient {
  /** Server-assigned unique identifier for this connection */
  id: ClientId;

  /** Client-provided unique name (e.g., "notebook", "home-assistant") */
  name: string;

  /** Free-form description for LLM routing decisions */
  description: string;

  /** Optional client version for debugging */
  version?: string;

  /** Optional structured capability hints */
  capabilities?: string[];

  /** The WebSocket connection for this client */
  connection: WebSocket;

  /** Timestamp when the client registered */
  registeredAt: ISOTimestamp;
}

/**
 * Public view of a registered client, without the WebSocket connection.
 * Used for listing clients without exposing internal connection details.
 */
export interface RegistryClientInfo {
  /** Server-assigned unique identifier */
  id: ClientId;

  /** Client-provided unique name */
  name: string;

  /** Free-form description for LLM routing decisions */
  description: string;

  /** Optional client version */
  version?: string;

  /** Optional structured capability hints */
  capabilities?: string[];

  /** Timestamp when the client registered */
  registeredAt: ISOTimestamp;
}

// ============================================================================
// Registration Message Types
// ============================================================================

/**
 * Result of a successful registration.
 */
export interface RegistrationSuccess {
  success: true;
  /** The assigned client ID */
  clientId: ClientId;
  /** Human-readable confirmation message */
  message: string;
}

/**
 * Result of a failed registration.
 */
export interface RegistrationFailure {
  success: false;
  /** Error code for programmatic handling */
  code: RegistrationErrorCode;
  /** Human-readable error message */
  message: string;
}

/**
 * Error codes for registration failures.
 */
export type RegistrationErrorCode =
  | "INVALID_NAME"
  | "INVALID_DESCRIPTION"
  | "DUPLICATE_NAME"
  | "ALREADY_REGISTERED"
  | "VALIDATION_ERROR";

/**
 * Registration response sent back to the client.
 */
export type RegistrationResponse = RegistrationSuccess | RegistrationFailure;

/**
 * WebSocket message format for registration response.
 */
export interface WebSocketRegistrationResponse {
  type: "registration_response";
  payload: RegistrationResponse;
}

// ============================================================================
// Registry Event Types
// ============================================================================

/**
 * Emitted when a client successfully registers.
 */
export interface ClientRegisteredEvent {
  /** The registered client info */
  client: RegistryClientInfo;
}

/**
 * Emitted when a client unregisters (either gracefully or due to disconnect).
 */
export interface ClientUnregisteredEvent {
  /** The unregistered client info */
  client: RegistryClientInfo;
  /** Reason for unregistration */
  reason: "disconnect" | "unregister" | "error";
}

/**
 * Events emitted by the ClientRegistry.
 */
export interface ClientRegistryEvents {
  /** Emitted when a new client registers */
  registered: (event: ClientRegisteredEvent) => void;
  /** Emitted when a client unregisters */
  unregistered: (event: ClientUnregisteredEvent) => void;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Checks if a registration response indicates success.
 *
 * @param response - The response to check
 * @returns true if registration was successful
 */
export function isRegistrationSuccess(
  response: RegistrationResponse
): response is RegistrationSuccess {
  return response.success === true;
}

/**
 * Checks if a registration response indicates failure.
 *
 * @param response - The response to check
 * @returns true if registration failed
 */
export function isRegistrationFailure(
  response: RegistrationResponse
): response is RegistrationFailure {
  return response.success === false;
}

/**
 * Validates that a ClientRegistration has all required fields for registry use.
 * This is a stricter validation than guards.validateClientRegistration,
 * including name format rules (alphanumeric, starts with letter).
 *
 * @param registration - The registration data to validate
 * @returns An error message if invalid, or null if valid
 */
export function validateRegistrationForRegistry(registration: unknown): string | null {
  if (typeof registration !== "object" || registration === null) {
    return "Registration must be an object";
  }

  const reg = registration as Record<string, unknown>;

  // Validate name
  if (typeof reg.name !== "string") {
    return "Name is required and must be a string";
  }
  if (reg.name.trim().length === 0) {
    return "Name cannot be empty";
  }
  if (reg.name.length > 64) {
    return "Name must be 64 characters or less";
  }
  // Name should be alphanumeric with hyphens/underscores
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(reg.name)) {
    return "Name must start with a letter and contain only alphanumeric characters, hyphens, and underscores";
  }

  // Validate description
  if (typeof reg.description !== "string") {
    return "Description is required and must be a string";
  }
  if (reg.description.trim().length === 0) {
    return "Description cannot be empty";
  }
  if (reg.description.length > 1024) {
    return "Description must be 1024 characters or less";
  }

  // Validate optional version
  if (reg.version !== undefined && typeof reg.version !== "string") {
    return "Version must be a string if provided";
  }

  // Validate optional capabilities
  if (reg.capabilities !== undefined) {
    if (!Array.isArray(reg.capabilities)) {
      return "Capabilities must be an array if provided";
    }
    for (const cap of reg.capabilities) {
      if (typeof cap !== "string") {
        return "Each capability must be a string";
      }
    }
  }

  return null;
}
