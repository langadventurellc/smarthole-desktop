/**
 * IPC notification handler for the main process.
 * Receives notification requests from the renderer process and forwards them
 * to the NotificationQueue for display.
 *
 * @see F-system-notifications feature specification
 */

import { IpcMainEvent } from "electron";
import { isNotifyShowPayload, NotifyShowPayload } from "../types";
import { NotificationQueue } from "../services/notification-queue";
import { NotificationOptions } from "../services/notifications";
import { Logger } from "../services/logger";

/**
 * Creates an IPC handler function for NOTIFY_SHOW channel.
 * The handler validates incoming payloads and forwards valid notifications
 * to the notification queue for display.
 *
 * @param queue - The notification queue instance for enqueueing notifications
 * @param ipcLogger - Child logger for IPC-related logging (warnings, errors)
 * @returns Handler function compatible with ipcMain.on()
 *
 * @example
 * ```typescript
 * import { ipcMain } from 'electron';
 * import { IPC_CHANNELS } from './types';
 * import { createNotificationHandler } from './ipc/notification-handler';
 *
 * const handler = createNotificationHandler(queue, ipcLogger);
 * ipcMain.on(IPC_CHANNELS.NOTIFY_SHOW, handler);
 * ```
 */
export function createNotificationHandler(
  queue: NotificationQueue,
  ipcLogger: Logger
): (event: IpcMainEvent, payload: unknown) => void {
  return (_event: IpcMainEvent, payload: unknown): void => {
    processNotification(payload, queue, ipcLogger);
  };
}

/**
 * Converts a NotifyShowPayload to NotificationOptions.
 * The types are compatible, so this is essentially a type cast with
 * explicit field mapping for clarity.
 *
 * @param payload - The validated payload from IPC
 * @returns NotificationOptions suitable for the queue
 */
function payloadToNotificationOptions(payload: NotifyShowPayload): NotificationOptions {
  return {
    title: payload.title,
    body: payload.body,
    type: payload.type,
    priority: payload.priority,
    actions: payload.actions,
    timeout: payload.timeout,
  };
}

/**
 * Processes a notification payload from the renderer process.
 * This is the core logic extracted for testing purposes.
 *
 * @param payload - The raw payload received via IPC
 * @param queue - The notification queue for enqueueing notifications
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns true if the payload was valid and enqueued, false otherwise
 */
export function processNotification(
  payload: unknown,
  queue: NotificationQueue,
  ipcLogger: Logger
): boolean {
  // Validate payload structure
  if (!isNotifyShowPayload(payload)) {
    ipcLogger.warn("Invalid notification payload received", { payload });
    return false;
  }

  try {
    // Convert payload to notification options and enqueue
    const options = payloadToNotificationOptions(payload);
    queue.enqueue(options);

    ipcLogger.debug("Notification enqueued", {
      title: payload.title,
      type: payload.type,
      priority: payload.priority,
    });

    return true;
  } catch (error) {
    // Never throw exceptions - log and return false
    ipcLogger.error("Failed to enqueue notification", {
      error: error instanceof Error ? error.message : String(error),
      title: payload.title,
    });
    return false;
  }
}
