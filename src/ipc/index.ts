/**
 * IPC handlers barrel export for SmartHole application.
 * Import all IPC handlers from this module.
 *
 * @example
 * ```ts
 * import { createLogMessageHandler, processLogMessage } from './ipc';
 * import { createNotificationHandler, processNotification } from './ipc';
 * import { createClientCountHandler, broadcastClientStatusChange } from './ipc';
 * import { wireHotkeyManagerToIpc, broadcastHotkeyActivated } from './ipc';
 * import { createInputStateHandler, wireInputStateToIpc } from './ipc';
 * ```
 */

export * from "./log-handler";
export * from "./notification-handler";
export * from "./client-status-handler";
export * from "./hotkey-handler";
export * from "./input-state-handler";
