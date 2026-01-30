/**
 * Registration handler service for WebSocket client registration.
 * Handles registration messages, validates data, and sends responses.
 *
 * @see F-client-registration-registry feature specification
 */

import { WebSocket, RawData } from "ws";
import { getLogger, Logger } from "./logger";
import { getClientRegistry, ClientRegistryService, RegisterResult } from "./client-registry";
import {
  ClientId,
  ClientRegistration,
  isWebSocketMessage,
  isRegistrationMessage,
  WebSocketRegistrationResponse,
  RegistrationResponse,
  RegistrationErrorCode,
  validateRegistrationForRegistry,
} from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Context for handling a registration request.
 * Contains connection details needed for the registration flow.
 */
export interface RegistrationContext {
  /** The WebSocket connection */
  ws: WebSocket;
  /** The connection ID assigned by the WebSocket server */
  connectionId: ClientId;
}

/**
 * Result of processing a WebSocket message.
 */
export type MessageProcessResult =
  | { handled: true; registered: boolean }
  | { handled: false; reason: "not_registration" | "invalid_message" | "parse_error" };

/**
 * Registration handler service interface.
 * Provides methods for handling WebSocket registration messages.
 */
export interface RegistrationHandler {
  /**
   * Process a raw WebSocket message.
   * If it's a registration message, handles the registration flow.
   *
   * @param data - The raw message data from WebSocket
   * @param context - The connection context
   * @returns Result indicating if the message was handled
   */
  processMessage(data: RawData, context: RegistrationContext): MessageProcessResult;

  /**
   * Check if a connection is already registered.
   *
   * @param connectionId - The connection ID to check
   * @returns true if the connection has a registered client
   */
  isConnectionRegistered(connectionId: ClientId): boolean;
}

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
 * Send a registration response to the client.
 *
 * @param ws - The WebSocket connection
 * @param response - The registration response
 * @param logger - Logger for error reporting
 */
function sendRegistrationResponse(
  ws: WebSocket,
  response: RegistrationResponse,
  logger: Logger
): void {
  const message: WebSocketRegistrationResponse = {
    type: "registration_response",
    payload: response,
  };

  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      logger.warn("Cannot send registration response: connection not open", {
        readyState: ws.readyState,
      });
    }
  } catch (error) {
    logger.error("Failed to send registration response", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create a success response for registration.
 *
 * @param clientId - The assigned client ID
 * @returns Registration success response
 */
function createSuccessResponse(clientId: ClientId): RegistrationResponse {
  return {
    success: true,
    clientId,
    message: "Registration successful",
  };
}

/**
 * Create a failure response for registration.
 *
 * @param code - The error code
 * @param message - Human-readable error message
 * @returns Registration failure response
 */
function createFailureResponse(code: RegistrationErrorCode, message: string): RegistrationResponse {
  return {
    success: false,
    code,
    message,
  };
}

/**
 * Map validation error message to error code.
 *
 * @param validationError - The validation error message
 * @returns The appropriate error code
 */
function getErrorCodeFromValidation(validationError: string): RegistrationErrorCode {
  if (validationError.toLowerCase().includes("name")) {
    return "INVALID_NAME";
  }
  if (validationError.toLowerCase().includes("description")) {
    return "INVALID_DESCRIPTION";
  }
  return "VALIDATION_ERROR";
}

/**
 * Map registry error to error code.
 *
 * @param registryError - The error message from the registry
 * @returns The appropriate error code
 */
function getErrorCodeFromRegistry(registryError: string): RegistrationErrorCode {
  // Check for connection already registered (more specific check first)
  if (registryError.includes("connection is already registered")) {
    return "ALREADY_REGISTERED";
  }
  // Check for duplicate name (client named X is already registered)
  if (registryError.includes("named") && registryError.includes("already registered")) {
    return "DUPLICATE_NAME";
  }
  return "VALIDATION_ERROR";
}

// ============================================================================
// Registration Handler Implementation
// ============================================================================

/**
 * Internal implementation of the RegistrationHandler.
 */
class RegistrationHandlerImpl implements RegistrationHandler {
  private readonly logger: Logger;
  private readonly registry: ClientRegistryService;

  constructor() {
    this.logger = getLogger().child({ component: "RegistrationHandler" });
    this.registry = getClientRegistry();
  }

  /**
   * Process a raw WebSocket message.
   */
  processMessage(data: RawData, context: RegistrationContext): MessageProcessResult {
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

    // Check if it's a registration message
    if (!isRegistrationMessage(parsed)) {
      // Not a registration message - let other handlers process it
      return { handled: false, reason: "not_registration" };
    }

    // Handle the registration
    const registered = this.handleRegistration(parsed.payload, context);
    return { handled: true, registered };
  }

  /**
   * Check if a connection is already registered.
   */
  isConnectionRegistered(connectionId: ClientId): boolean {
    return this.registry.getClientById(connectionId) !== undefined;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Handle a registration request.
   *
   * @param registration - The registration payload
   * @param context - The connection context
   * @returns true if registration succeeded
   */
  private handleRegistration(
    registration: ClientRegistration,
    context: RegistrationContext
  ): boolean {
    const { ws, connectionId } = context;

    this.logger.debug("Processing registration request", {
      connectionId,
      name: registration.name,
    });

    // Check if this connection is already registered
    if (this.isConnectionRegistered(connectionId)) {
      this.logger.warn("Registration rejected: connection already registered", {
        connectionId,
        attemptedName: registration.name,
      });
      sendRegistrationResponse(
        ws,
        createFailureResponse("ALREADY_REGISTERED", "This connection is already registered"),
        this.logger
      );
      return false;
    }

    // Validate the registration data
    const validationError = validateRegistrationForRegistry(registration);
    if (validationError !== null) {
      this.logger.warn("Registration validation failed", {
        connectionId,
        name: registration.name,
        error: validationError,
      });
      sendRegistrationResponse(
        ws,
        createFailureResponse(getErrorCodeFromValidation(validationError), validationError),
        this.logger
      );
      return false;
    }

    // Register the client with the registry
    const result: RegisterResult = this.registry.register(connectionId, registration, ws);

    if (!result.success) {
      this.logger.warn("Registration rejected by registry", {
        connectionId,
        name: registration.name,
        error: result.error,
      });
      sendRegistrationResponse(
        ws,
        createFailureResponse(getErrorCodeFromRegistry(result.error), result.error),
        this.logger
      );
      return false;
    }

    // Success!
    this.logger.info("Client registration successful", {
      connectionId,
      name: registration.name,
      version: registration.version,
    });
    sendRegistrationResponse(ws, createSuccessResponse(connectionId), this.logger);
    return true;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

/**
 * Singleton instance of the registration handler.
 */
let registrationHandlerInstance: RegistrationHandlerImpl | null = null;

/**
 * Initializes the global registration handler instance.
 * This should be called inside `app.whenReady()` after the logger
 * and client registry have been initialized.
 *
 * @returns The initialized RegistrationHandler instance
 * @throws Error if logger or client registry has not been initialized
 *
 * @example
 * ```typescript
 * import { initializeRegistrationHandler } from './services/registration-handler';
 *
 * // Inside app.whenReady(), after logger and registry initialization
 * const handler = initializeRegistrationHandler();
 * ```
 */
export function initializeRegistrationHandler(): RegistrationHandler {
  if (registrationHandlerInstance) {
    // Already initialized, return existing instance
    return registrationHandlerInstance;
  }

  registrationHandlerInstance = new RegistrationHandlerImpl();
  return registrationHandlerInstance;
}

/**
 * Gets the current registration handler instance.
 * Throws if initializeRegistrationHandler() has not been called.
 *
 * @returns The RegistrationHandler instance
 * @throws Error if registration handler has not been initialized
 */
export function getRegistrationHandler(): RegistrationHandler {
  if (!registrationHandlerInstance) {
    throw new Error(
      "RegistrationHandler not initialized. Call initializeRegistrationHandler() before using getRegistrationHandler()."
    );
  }
  return registrationHandlerInstance;
}

/**
 * Resets the registration handler instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetRegistrationHandler(): void {
  registrationHandlerInstance = null;
}
