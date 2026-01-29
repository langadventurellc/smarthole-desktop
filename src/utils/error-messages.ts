/**
 * User-facing error messages for SmartHole application.
 * Maps technical error codes to clear, actionable messages for end users.
 *
 * Guidelines for messages:
 * - Be actionable (tell users what to do)
 * - Avoid jargon (no technical terms)
 * - Be concise (one or two sentences max)
 * - Never expose sensitive information (file paths, API keys, stack traces)
 */

import { ErrorCode, isErrorCode } from "../types/errors";

// Re-export isErrorCode for convenience
export { isErrorCode };

// ============================================================================
// Error Message Mapping
// ============================================================================

/**
 * User-facing error messages keyed by ErrorCode.
 * Messages should be:
 * - Clear and non-technical
 * - Actionable (tell user what to do)
 * - Never expose sensitive information
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // -------------------------------------------------------------------------
  // General errors
  // -------------------------------------------------------------------------

  [ErrorCode.UNKNOWN]: "An unexpected error occurred. Please try again.",
  [ErrorCode.INTERNAL]: "Something went wrong. Please restart the application.",

  // -------------------------------------------------------------------------
  // Configuration errors
  // -------------------------------------------------------------------------

  [ErrorCode.CONFIG_INVALID]:
    "Your settings appear to be corrupted. Default settings will be restored.",
  [ErrorCode.CONFIG_LOAD_FAILED]: "Could not load your settings. Using default settings.",
  [ErrorCode.CONFIG_SAVE_FAILED]:
    "Could not save your settings. Please check if you have write permissions.",

  // -------------------------------------------------------------------------
  // Network errors
  // -------------------------------------------------------------------------

  [ErrorCode.NETWORK_UNAVAILABLE]:
    "No internet connection. Please check your network and try again.",
  [ErrorCode.NETWORK_TIMEOUT]:
    "The connection timed out. Please check your internet and try again.",
  [ErrorCode.NETWORK_REQUEST_FAILED]: "Could not connect to the server. Please try again later.",

  // -------------------------------------------------------------------------
  // IPC (Inter-Process Communication) errors
  // Note: User messages should NOT mention "IPC" - it's technical jargon
  // -------------------------------------------------------------------------

  [ErrorCode.IPC_CHANNEL_INVALID]:
    "An internal communication error occurred. Please restart the application.",
  [ErrorCode.IPC_PAYLOAD_INVALID]:
    "An internal communication error occurred. Please restart the application.",
  [ErrorCode.IPC_HANDLER_FAILED]: "An operation failed. Please try again.",

  // -------------------------------------------------------------------------
  // Service errors
  // -------------------------------------------------------------------------

  [ErrorCode.SERVICE_UNAVAILABLE]:
    "A required service is not available. Please restart the application.",
  [ErrorCode.SERVICE_INITIALIZATION_FAILED]:
    "Could not start a required service. Please restart the application.",

  // -------------------------------------------------------------------------
  // STT (Speech-to-Text) errors
  // Note: User messages should NOT mention "STT" - it's technical jargon
  // -------------------------------------------------------------------------

  [ErrorCode.STT_INITIALIZATION_FAILED]:
    "Could not start speech recognition. Please check your microphone settings.",
  [ErrorCode.STT_TRANSCRIPTION_FAILED]: "Could not transcribe audio. Please try again.",

  // -------------------------------------------------------------------------
  // LLM (Large Language Model) errors
  // Note: User messages should NOT mention "LLM" or "API" - it's technical jargon
  // -------------------------------------------------------------------------

  [ErrorCode.LLM_REQUEST_FAILED]:
    "Could not process your request. Please check your settings and try again.",
  [ErrorCode.LLM_RESPONSE_INVALID]: "Received an invalid response. Please try again.",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the user-facing message for an error code.
 * Falls back to UNKNOWN message if code not found.
 *
 * @param code - The error code to get the message for
 * @returns The user-facing message for the error code
 *
 * @example
 * ```ts
 * const message = getUserMessage(ErrorCode.NETWORK_TIMEOUT);
 * // Returns: "The connection timed out. Please check your internet and try again."
 * ```
 */
export function getUserMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES[ErrorCode.UNKNOWN];
}

/**
 * Gets the user-facing message for an error code, with a fallback for unknown codes.
 * This variant accepts unknown values and safely returns a message.
 *
 * @param code - The error code to get the message for (can be unknown type)
 * @returns The user-facing message for the error code, or the UNKNOWN message
 *
 * @example
 * ```ts
 * const message = getUserMessageSafe(someValue);
 * // Always returns a valid message string
 * ```
 */
export function getUserMessageSafe(code: unknown): string {
  if (isErrorCode(code)) {
    return ERROR_MESSAGES[code];
  }
  return ERROR_MESSAGES[ErrorCode.UNKNOWN];
}
