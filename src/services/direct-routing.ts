/**
 * Direct Routing Service
 *
 * Provides pattern matching for explicit routing requests in the format
 * `{client_name}: {message}` or `{client_name}, {message}`.
 *
 * When a message matches this pattern and the client exists in the registry,
 * the LLM routing step is bypassed and the message is delivered directly.
 */

import { DirectRouteResult } from "../types";

// ============================================================================
// Constants
// ============================================================================

/**
 * Pattern for matching direct routing syntax.
 *
 * Matches: "clientname: message" or "clientname, message"
 * - Client name: starts with letter, contains alphanumeric/dash/underscore
 * - Separator: colon or comma followed by optional whitespace
 * - Message: everything after (can be multiline due to dot-all flag)
 *
 * Groups:
 * - [1] = client name
 * - [2] = message content
 */
const DIRECT_ROUTE_PATTERN = /^([a-zA-Z][a-zA-Z0-9_-]*)[,:][ \t]*(.+)$/s;

// ============================================================================
// Public API
// ============================================================================

/**
 * Attempts to detect and parse a direct routing pattern in a message.
 *
 * Direct routing allows users to explicitly specify which client should receive
 * a message using the format `{client_name}: {message}` or `{client_name}, {message}`.
 *
 * The client name matching is case-insensitive, but the returned clientName
 * preserves the original casing from the availableClients list.
 *
 * @param message - The user's input message to check
 * @param availableClients - List of registered client names from the registry
 * @returns DirectRouteResult if pattern matches and client exists, null otherwise
 *
 * @example
 * // Matches - returns DirectRouteResult
 * tryDirectRoute("notebook: Buy milk", ["notebook", "home-assistant"]);
 * // => { clientName: "notebook", message: "Buy milk", directRouted: true }
 *
 * @example
 * // Case insensitive matching, preserves registry casing
 * tryDirectRoute("NOTEBOOK: TEST", ["notebook"]);
 * // => { clientName: "notebook", message: "TEST", directRouted: true }
 *
 * @example
 * // No match - client not registered
 * tryDirectRoute("please note: something", ["notebook"]);
 * // => null (falls through to LLM routing)
 */
export function tryDirectRoute(
  message: string,
  availableClients: string[]
): DirectRouteResult | null {
  // Match the direct routing pattern
  const match = message.match(DIRECT_ROUTE_PATTERN);
  if (!match) {
    return null;
  }

  const [, clientNameFromMessage, actualMessage] = match;

  // Case-insensitive client name lookup
  const matchedClient = availableClients.find(
    (c) => c.toLowerCase() === clientNameFromMessage.toLowerCase()
  );

  // If client not found, fall through to LLM routing
  if (!matchedClient) {
    return null;
  }

  // Trim the message and ensure it's not empty
  const trimmedMessage = actualMessage.trim();
  if (trimmedMessage.length === 0) {
    return null;
  }

  return {
    clientName: matchedClient, // Use original casing from registry
    message: trimmedMessage,
    directRouted: true,
  };
}
