/**
 * IPC handlers barrel export for SmartHole application.
 * Import all IPC handlers from this module.
 *
 * @example
 * ```ts
 * import { createLogMessageHandler, processLogMessage } from './ipc';
 * import { createNotificationHandler, processNotification } from './ipc';
 * import { createClientCountHandler, broadcastClientStatusChange } from './ipc';
 * ```
 */

export * from "./log-handler";
export * from "./notification-handler";
export * from "./client-status-handler";
