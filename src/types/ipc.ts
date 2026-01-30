/**
 * IPC (Inter-Process Communication) channel definitions and types.
 * These types provide type-safe communication between Electron's main process
 * and renderer process.
 *
 * @see Electron IPC documentation
 */

import { LogLevel, AppConfig, PartialAppConfig } from "./config";

// ============================================================================
// IPC Channel Definitions
// ============================================================================

/**
 * IPC channel constants using const assertion for type safety.
 * Naming convention: {domain}:{action}
 *
 * Channels are organized by domain:
 * - log: Logging-related operations
 * - notify: System notification operations
 * - config: Configuration get/set operations
 * - app: Application lifecycle operations
 * - websocket: WebSocket server status operations
 */
export const IPC_CHANNELS = {
  // Logging channels
  LOG_MESSAGE: "log:message",

  // Notification channels
  NOTIFY_SHOW: "notify:show",

  // Configuration channels
  CONFIG_GET: "config:get",
  CONFIG_SET: "config:set",
  CONFIG_CHANGED: "config:changed", // Main -> Renderer broadcast

  // App lifecycle channels
  APP_QUIT: "app:quit",
  APP_VERSION: "app:version",

  // WebSocket server status channels
  WEBSOCKET_STATUS_GET: "websocket:status:get", // Renderer -> Main request
  WEBSOCKET_STATUS_CHANGED: "websocket:status:changed", // Main -> Renderer broadcast

  // Message delivery channels
  MESSAGE_SEND: "message:send", // Send message to single client
  MESSAGE_SEND_MULTIPLE: "message:sendMultiple", // Send message to multiple clients
  MESSAGE_GET_STATUS: "message:getStatus", // Get delivery status for a message
  MESSAGE_GET_RECENT: "message:getRecent", // Get recent delivery history

  // Client status channels
  CLIENTS_GET_COUNT: "clients:getCount", // Get number of registered clients
  CLIENTS_GET_LIST: "clients:getList", // Get list of client summaries
  CLIENTS_GET_DETAILS: "clients:getDetails", // Get full details for a specific client
  CLIENTS_STATUS_CHANGED: "clients:statusChanged", // Main -> Renderer broadcast
} as const;

/**
 * Union type of all valid IPC channel names.
 * Derived from IPC_CHANNELS constant for type safety.
 */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// ============================================================================
// Logging IPC Types
// ============================================================================

/**
 * Payload for log message IPC channel.
 * Renderer sends logs to main process for centralized logging.
 */
export interface LogMessagePayload {
  /** Log level for this message */
  level: LogLevel;
  /** The log message text */
  message: string;
  /** Optional context data for structured logging */
  context?: Record<string, unknown>;
  /** ISO 8601 timestamp, auto-generated if not provided */
  timestamp?: string;
}

// ============================================================================
// Notification IPC Types
// ============================================================================

/**
 * Type of notification to display.
 * Affects visual styling and icon.
 */
export type NotificationType = "info" | "warning" | "error" | "success";

/**
 * Priority level for notifications.
 * May affect notification behavior (e.g., persistence, sound).
 */
export type NotificationPriority = "low" | "medium" | "high";

/**
 * An action button that can be displayed on a notification.
 */
export interface NotificationAction {
  /** Display text for the action button */
  label: string;
  /** Identifier returned when this action is clicked */
  actionId: string;
}

/**
 * Payload for showing a system notification.
 */
export interface NotifyShowPayload {
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Type affects visual styling */
  type: NotificationType;
  /** Priority affects notification behavior */
  priority: NotificationPriority;
  /** Optional action buttons */
  actions?: NotificationAction[];
  /** Auto-dismiss timeout in milliseconds (undefined = no auto-dismiss) */
  timeout?: number;
}

/**
 * Payload returned when a notification is clicked.
 */
export interface NotificationClickedPayload {
  /** The actionId of the clicked action button, undefined if notification body was clicked */
  actionId?: string;
}

// ============================================================================
// Configuration IPC Types
// ============================================================================

/**
 * Response payload for config:get channel.
 */
export interface ConfigGetResponse {
  /** The current application configuration */
  config: AppConfig;
}

/**
 * Payload for config:set channel.
 * Uses partial config to allow updating specific settings.
 */
export interface ConfigSetPayload {
  /** Partial configuration with values to update */
  updates: PartialAppConfig;
}

/**
 * Payload broadcast when configuration changes.
 * Sent from main process to all renderer processes.
 */
export interface ConfigChangedPayload {
  /** The updated full configuration */
  config: AppConfig;
  /** Dot-notation paths that changed (e.g., "stt.backend", "logLevel") */
  changedKeys: string[];
}

// ============================================================================
// App Lifecycle IPC Types
// ============================================================================

/**
 * Response payload for app:version channel.
 * Provides version information about the application and runtime.
 */
export interface AppVersionResponse {
  /** Application version from package.json */
  version: string;
  /** Electron version */
  electronVersion: string;
  /** Node.js version */
  nodeVersion: string;
}

// ============================================================================
// WebSocket Server Status Types
// ============================================================================

/**
 * Current state of the WebSocket server.
 */
export type WebSocketServerState = "running" | "stopped" | "error";

/**
 * Status information about the WebSocket server.
 * Used for UI display and health monitoring.
 */
export interface WebSocketServerStatus {
  /** Current server state */
  state: WebSocketServerState;
  /** Port the server is listening on */
  port: number;
  /** Number of currently connected clients */
  activeConnections: number;
  /** Error message if state is 'error' */
  error?: string;
}

// ============================================================================
// Message Delivery IPC Types
// ============================================================================

// Re-export types from message-delivery service for convenience
// Import from services would create circular dependencies, so we define IPC-specific types here

/**
 * Serializable delivery result for IPC transport.
 * Mirrors DeliveryResult from message-delivery service.
 */
export type IpcDeliveryResult =
  | { success: true; deliveredAt: string }
  | { success: false; error: "CLIENT_NOT_FOUND" | "CLIENT_NOT_CONNECTED" | "SEND_FAILED" };

/**
 * Serializable delivery status for IPC transport.
 * Mirrors DeliveryStatus from message-delivery service.
 */
export interface IpcDeliveryStatus {
  /** The message ID that was delivered */
  messageId: string;
  /** The client name the message was sent to */
  clientName: string;
  /** The result of the delivery attempt */
  result: IpcDeliveryResult;
  /** When the delivery was attempted */
  attemptedAt: string;
  /** Response from the client, if received */
  response?: {
    type: "ack" | "reject" | "notification";
    receivedAt: string;
    payload?: Record<string, unknown>;
  };
}

/**
 * Serializable routed message for IPC transport.
 * Mirrors RoutedMessage from messages.ts.
 */
export interface IpcRoutedMessage {
  /** Unique message ID for correlation */
  id: string;
  /** Raw transcribed text (unmodified from user input) */
  text: string;
  /** ISO 8601 timestamp when message was created */
  timestamp: string;
  /** Additional metadata about the message */
  metadata: {
    confidence?: number;
    routingReason?: string;
    inputMethod: "voice" | "text";
    directRouted: boolean;
  };
}

/**
 * Payload for message:send IPC channel.
 */
export interface MessageSendPayload {
  /** The client name to send to */
  clientName: string;
  /** The message to deliver */
  message: IpcRoutedMessage;
}

/**
 * Payload for message:sendMultiple IPC channel.
 */
export interface MessageSendMultiplePayload {
  /** Array of client names to send to */
  clientNames: string[];
  /** The message to deliver */
  message: IpcRoutedMessage;
}

/**
 * Payload for message:getStatus IPC channel.
 */
export interface MessageGetStatusPayload {
  /** The message ID to look up */
  messageId: string;
}

/**
 * Payload for message:getRecent IPC channel.
 */
export interface MessageGetRecentPayload {
  /** Maximum number of statuses to return */
  limit?: number;
}

/**
 * Response for message:sendMultiple IPC channel.
 * Uses array of entries instead of Map for IPC serialization.
 */
export interface MessageSendMultipleResponse {
  /** Array of [clientName, result] pairs */
  results: Array<[string, IpcDeliveryResult]>;
}

// ============================================================================
// Client Status IPC Types
// ============================================================================

/**
 * Minimal client info for list view.
 * Contains only the essential fields for displaying a client list.
 */
export interface ClientSummary {
  /** Client-provided unique name */
  name: string;
  /** Free-form description for display */
  description: string;
}

/**
 * Full client details for detailed view.
 * Mirrors RegistryClientInfo for IPC transport.
 */
export interface ClientDetails {
  /** Server-assigned unique identifier */
  id: string;
  /** Client-provided unique name */
  name: string;
  /** Free-form description */
  description: string;
  /** Optional client version */
  version?: string;
  /** Optional structured capability hints */
  capabilities?: string[];
  /** ISO 8601 timestamp when the client registered */
  registeredAt: string;
}

/**
 * Payload for clients:getDetails IPC channel.
 */
export interface ClientGetDetailsPayload {
  /** The client name to look up */
  clientName: string;
}

/**
 * Payload broadcast when client status changes.
 * Sent from main process to all renderer processes.
 */
export interface ClientStatusChangedPayload {
  /** The type of change that occurred */
  event: "registered" | "unregistered";
  /** The client that changed */
  client: ClientSummary;
  /** Current count of registered clients */
  count: number;
}

// ============================================================================
// IPC Type Maps (for type-safe handlers)
// ============================================================================

/**
 * Maps IPC channels to their payload types.
 * Used for type-safe IPC handler registration and send operations.
 *
 * - void indicates no payload is needed for that channel
 * - Payload interfaces define the expected data structure
 */
export interface IpcPayloadMap {
  [IPC_CHANNELS.LOG_MESSAGE]: LogMessagePayload;
  [IPC_CHANNELS.NOTIFY_SHOW]: NotifyShowPayload;
  [IPC_CHANNELS.CONFIG_GET]: void; // No payload needed
  [IPC_CHANNELS.CONFIG_SET]: ConfigSetPayload;
  [IPC_CHANNELS.CONFIG_CHANGED]: ConfigChangedPayload;
  [IPC_CHANNELS.APP_QUIT]: void; // No payload needed
  [IPC_CHANNELS.APP_VERSION]: void; // No payload needed
  [IPC_CHANNELS.WEBSOCKET_STATUS_GET]: void; // No payload needed
  [IPC_CHANNELS.WEBSOCKET_STATUS_CHANGED]: WebSocketServerStatus;
  [IPC_CHANNELS.MESSAGE_SEND]: MessageSendPayload;
  [IPC_CHANNELS.MESSAGE_SEND_MULTIPLE]: MessageSendMultiplePayload;
  [IPC_CHANNELS.MESSAGE_GET_STATUS]: MessageGetStatusPayload;
  [IPC_CHANNELS.MESSAGE_GET_RECENT]: MessageGetRecentPayload;
  [IPC_CHANNELS.CLIENTS_GET_COUNT]: void; // No payload needed
  [IPC_CHANNELS.CLIENTS_GET_LIST]: void; // No payload needed
  [IPC_CHANNELS.CLIENTS_GET_DETAILS]: ClientGetDetailsPayload;
  [IPC_CHANNELS.CLIENTS_STATUS_CHANGED]: ClientStatusChangedPayload;
}

/**
 * Maps IPC channels to their response types.
 * For invoke-style IPC that returns data to the renderer.
 *
 * Only channels that return data are included.
 * Channels like LOG_MESSAGE and APP_QUIT don't return responses.
 */
export interface IpcResponseMap {
  [IPC_CHANNELS.CONFIG_GET]: ConfigGetResponse;
  [IPC_CHANNELS.APP_VERSION]: AppVersionResponse;
  [IPC_CHANNELS.WEBSOCKET_STATUS_GET]: WebSocketServerStatus;
  [IPC_CHANNELS.MESSAGE_SEND]: IpcDeliveryResult;
  [IPC_CHANNELS.MESSAGE_SEND_MULTIPLE]: MessageSendMultipleResponse;
  [IPC_CHANNELS.MESSAGE_GET_STATUS]: IpcDeliveryStatus | null;
  [IPC_CHANNELS.MESSAGE_GET_RECENT]: IpcDeliveryStatus[];
  [IPC_CHANNELS.CLIENTS_GET_COUNT]: number;
  [IPC_CHANNELS.CLIENTS_GET_LIST]: ClientSummary[];
  [IPC_CHANNELS.CLIENTS_GET_DETAILS]: ClientDetails | null;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Valid IPC channel values for runtime validation.
 */
const IPC_CHANNEL_VALUES: ReadonlySet<string> = new Set(Object.values(IPC_CHANNELS));

/**
 * Checks if a value is a valid IpcChannel.
 *
 * @param value - The value to check
 * @returns true if the value is a valid IPC channel
 */
export function isIpcChannel(value: unknown): value is IpcChannel {
  return typeof value === "string" && IPC_CHANNEL_VALUES.has(value);
}

/**
 * Valid notification type values for runtime validation.
 */
const NOTIFICATION_TYPE_VALUES: ReadonlySet<string> = new Set([
  "info",
  "warning",
  "error",
  "success",
]);

/**
 * Checks if a value is a valid NotificationType.
 *
 * @param value - The value to check
 * @returns true if the value is a valid notification type
 */
export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && NOTIFICATION_TYPE_VALUES.has(value);
}

/**
 * Valid notification priority values for runtime validation.
 */
const NOTIFICATION_PRIORITY_VALUES: ReadonlySet<string> = new Set(["low", "medium", "high"]);

/**
 * Checks if a value is a valid NotificationPriority.
 *
 * @param value - The value to check
 * @returns true if the value is a valid notification priority
 */
export function isNotificationPriority(value: unknown): value is NotificationPriority {
  return typeof value === "string" && NOTIFICATION_PRIORITY_VALUES.has(value);
}

/**
 * Checks if a value is a valid LogMessagePayload.
 *
 * @param value - The value to check
 * @returns true if the value is a valid log message payload
 */
export function isLogMessagePayload(value: unknown): value is LogMessagePayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields
  if (typeof obj.level !== "string" || typeof obj.message !== "string") {
    return false;
  }

  // Validate log level (import from config would create circular dependency risk)
  const validLogLevels = new Set(["error", "warn", "info", "debug", "trace"]);
  if (!validLogLevels.has(obj.level)) {
    return false;
  }

  // Optional context must be an object if present
  if (obj.context !== undefined && (typeof obj.context !== "object" || obj.context === null)) {
    return false;
  }

  // Optional timestamp must be a string if present
  if (obj.timestamp !== undefined && typeof obj.timestamp !== "string") {
    return false;
  }

  return true;
}

/**
 * Checks if a value is a valid NotificationAction.
 *
 * @param value - The value to check
 * @returns true if the value is a valid notification action
 */
export function isNotificationAction(value: unknown): value is NotificationAction {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return typeof obj.label === "string" && typeof obj.actionId === "string";
}

/**
 * Checks if a value is a valid NotifyShowPayload.
 *
 * @param value - The value to check
 * @returns true if the value is a valid notify show payload
 */
export function isNotifyShowPayload(value: unknown): value is NotifyShowPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields
  if (
    typeof obj.title !== "string" ||
    typeof obj.body !== "string" ||
    !isNotificationType(obj.type) ||
    !isNotificationPriority(obj.priority)
  ) {
    return false;
  }

  // Optional actions must be an array of valid NotificationActions if present
  if (obj.actions !== undefined) {
    if (!Array.isArray(obj.actions)) {
      return false;
    }
    for (const action of obj.actions) {
      if (!isNotificationAction(action)) {
        return false;
      }
    }
  }

  // Optional timeout must be a number if present
  if (obj.timeout !== undefined && typeof obj.timeout !== "number") {
    return false;
  }

  return true;
}

/**
 * Checks if a value is a valid ConfigSetPayload.
 *
 * @param value - The value to check
 * @returns true if the value is a valid config set payload
 */
export function isConfigSetPayload(value: unknown): value is ConfigSetPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // updates must be an object
  return typeof obj.updates === "object" && obj.updates !== null;
}

/**
 * Checks if a value is a valid ConfigChangedPayload.
 *
 * @param value - The value to check
 * @returns true if the value is a valid config changed payload
 */
export function isConfigChangedPayload(value: unknown): value is ConfigChangedPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // config must be an object and changedKeys must be an array of strings
  if (typeof obj.config !== "object" || obj.config === null) {
    return false;
  }

  if (!Array.isArray(obj.changedKeys)) {
    return false;
  }

  for (const key of obj.changedKeys) {
    if (typeof key !== "string") {
      return false;
    }
  }

  return true;
}

/**
 * Checks if a value is a valid AppVersionResponse.
 *
 * @param value - The value to check
 * @returns true if the value is a valid app version response
 */
export function isAppVersionResponse(value: unknown): value is AppVersionResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.version === "string" &&
    typeof obj.electronVersion === "string" &&
    typeof obj.nodeVersion === "string"
  );
}

/**
 * Valid WebSocket server state values for runtime validation.
 */
const WEBSOCKET_SERVER_STATE_VALUES: ReadonlySet<string> = new Set(["running", "stopped", "error"]);

/**
 * Checks if a value is a valid WebSocketServerState.
 *
 * @param value - The value to check
 * @returns true if the value is a valid WebSocket server state
 */
export function isWebSocketServerState(value: unknown): value is WebSocketServerState {
  return typeof value === "string" && WEBSOCKET_SERVER_STATE_VALUES.has(value);
}

/**
 * Checks if a value is a valid WebSocketServerStatus.
 *
 * @param value - The value to check
 * @returns true if the value is a valid WebSocket server status
 */
export function isWebSocketServerStatus(value: unknown): value is WebSocketServerStatus {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields
  if (
    !isWebSocketServerState(obj.state) ||
    typeof obj.port !== "number" ||
    typeof obj.activeConnections !== "number"
  ) {
    return false;
  }

  // Optional error must be a string if present
  if (obj.error !== undefined && typeof obj.error !== "string") {
    return false;
  }

  return true;
}
