/**
 * IPC log message handler for the main process.
 * Receives log messages from the renderer process and forwards them
 * to the main process logger with enriched context.
 *
 * @see F-logging-system feature specification
 */

import { IpcMainEvent } from "electron";
import { isLogMessagePayload } from "../types";
import { Logger } from "../services/logger";

/**
 * Context added to logs received from the renderer process.
 */
export interface RendererLogContext {
  /** Identifies the log source as renderer */
  source: "renderer";
  /** Original timestamp from the renderer process */
  rendererTimestamp?: string;
  /** Additional context from the original log call */
  [key: string]: unknown;
}

/**
 * Creates an IPC handler function for LOG_MESSAGE channel.
 * The handler validates incoming payloads and forwards valid logs
 * to the provided logger with enriched context.
 *
 * @param logger - The main process logger instance
 * @param ipcLogger - Child logger for IPC-related logging (warnings, errors)
 * @returns Handler function compatible with ipcMain.on()
 *
 * @example
 * ```typescript
 * import { ipcMain } from 'electron';
 * import { IPC_CHANNELS } from './types';
 * import { createLogMessageHandler } from './ipc/log-handler';
 *
 * const handler = createLogMessageHandler(logger, ipcLogger);
 * ipcMain.on(IPC_CHANNELS.LOG_MESSAGE, handler);
 * ```
 */
export function createLogMessageHandler(
  logger: Logger,
  ipcLogger: Logger
): (event: IpcMainEvent, payload: unknown) => void {
  return (_event: IpcMainEvent, payload: unknown): void => {
    // Validate payload structure
    if (!isLogMessagePayload(payload)) {
      ipcLogger.warn("Invalid log message payload received", { payload });
      return;
    }

    const { level, message, context, timestamp } = payload;

    // Enrich context with renderer source and preserve original timestamp
    const enrichedContext: RendererLogContext = {
      ...context,
      source: "renderer",
      rendererTimestamp: timestamp,
    };

    // Forward to appropriate log level
    logger[level](message, enrichedContext);
  };
}

/**
 * Processes a log message payload from the renderer process.
 * This is the core logic extracted for testing purposes.
 *
 * @param payload - The raw payload received via IPC
 * @param logger - The main process logger instance
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns true if the payload was valid and logged, false otherwise
 */
export function processLogMessage(payload: unknown, logger: Logger, ipcLogger: Logger): boolean {
  // Validate payload structure
  if (!isLogMessagePayload(payload)) {
    ipcLogger.warn("Invalid log message payload received", { payload });
    return false;
  }

  const { level, message, context, timestamp } = payload;

  // Enrich context with renderer source and preserve original timestamp
  const enrichedContext: RendererLogContext = {
    ...context,
    source: "renderer",
    rendererTimestamp: timestamp,
  };

  // Forward to appropriate log level
  logger[level](message, enrichedContext);
  return true;
}
