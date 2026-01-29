/**
 * Error codes and severity types for the SmartHole application.
 * These types provide a type-safe foundation for error handling throughout the app.
 */

// ============================================================================
// Error Codes Enum
// ============================================================================

/**
 * Exhaustive error codes for the application.
 * Organized by domain/category for easy navigation and grouping.
 *
 * Naming convention: DOMAIN_SPECIFIC_ERROR
 * - DOMAIN: The area of the application (CONFIG, NETWORK, IPC, etc.)
 * - SPECIFIC_ERROR: What went wrong
 */
export enum ErrorCode {
  // -------------------------------------------------------------------------
  // General errors (catch-all for unexpected situations)
  // -------------------------------------------------------------------------

  /** Unknown error that doesn't fit other categories */
  UNKNOWN = "UNKNOWN",

  /** Internal application error (bug, assertion failure, etc.) */
  INTERNAL = "INTERNAL",

  // -------------------------------------------------------------------------
  // Configuration errors
  // -------------------------------------------------------------------------

  /** Configuration file or value is invalid */
  CONFIG_INVALID = "CONFIG_INVALID",

  /** Failed to load configuration from disk or storage */
  CONFIG_LOAD_FAILED = "CONFIG_LOAD_FAILED",

  /** Failed to save configuration to disk or storage */
  CONFIG_SAVE_FAILED = "CONFIG_SAVE_FAILED",

  // -------------------------------------------------------------------------
  // Network errors
  // -------------------------------------------------------------------------

  /** Network is not available (offline, no connection) */
  NETWORK_UNAVAILABLE = "NETWORK_UNAVAILABLE",

  /** Request timed out waiting for response */
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",

  /** HTTP request failed (4xx, 5xx, or other failure) */
  NETWORK_REQUEST_FAILED = "NETWORK_REQUEST_FAILED",

  // -------------------------------------------------------------------------
  // IPC (Inter-Process Communication) errors
  // -------------------------------------------------------------------------

  /** IPC channel name is invalid or unregistered */
  IPC_CHANNEL_INVALID = "IPC_CHANNEL_INVALID",

  /** IPC message payload failed validation */
  IPC_PAYLOAD_INVALID = "IPC_PAYLOAD_INVALID",

  /** IPC handler threw an error during execution */
  IPC_HANDLER_FAILED = "IPC_HANDLER_FAILED",

  // -------------------------------------------------------------------------
  // Service errors
  // -------------------------------------------------------------------------

  /** Required service is unavailable */
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  /** Service failed to initialize properly */
  SERVICE_INITIALIZATION_FAILED = "SERVICE_INITIALIZATION_FAILED",

  // -------------------------------------------------------------------------
  // STT (Speech-to-Text) errors - for future features
  // -------------------------------------------------------------------------

  /** Failed to initialize speech-to-text service */
  STT_INITIALIZATION_FAILED = "STT_INITIALIZATION_FAILED",

  /** Failed to transcribe audio */
  STT_TRANSCRIPTION_FAILED = "STT_TRANSCRIPTION_FAILED",

  // -------------------------------------------------------------------------
  // LLM (Large Language Model) errors - for future features
  // -------------------------------------------------------------------------

  /** Failed to send request to LLM service */
  LLM_REQUEST_FAILED = "LLM_REQUEST_FAILED",

  /** LLM response was invalid or malformed */
  LLM_RESPONSE_INVALID = "LLM_RESPONSE_INVALID",
}

// ============================================================================
// Error Severity
// ============================================================================

/**
 * Severity levels for errors, used to determine appropriate handling.
 *
 * - `low`: Minor issues, informational, doesn't affect core functionality
 * - `medium`: Noticeable issues, some features may be degraded
 * - `high`: Significant issues, major features not working
 * - `critical`: Application cannot function, requires immediate attention
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Array of all valid severity levels, useful for validation.
 */
export const ERROR_SEVERITIES = ["low", "medium", "high", "critical"] as const;

/**
 * Type guard to check if a value is a valid ErrorSeverity.
 *
 * @param value - The value to check
 * @returns true if the value is a valid ErrorSeverity
 */
export function isErrorSeverity(value: unknown): value is ErrorSeverity {
  return typeof value === "string" && ERROR_SEVERITIES.includes(value as ErrorSeverity);
}

/**
 * Type guard to check if a value is a valid ErrorCode.
 *
 * @param value - The value to check
 * @returns true if the value is a valid ErrorCode
 */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.values(ErrorCode).includes(value as ErrorCode);
}
