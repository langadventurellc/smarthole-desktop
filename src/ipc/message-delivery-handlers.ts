/**
 * IPC message delivery handlers for the main process.
 * Exposes message delivery service methods to the renderer process.
 *
 * @see F-message-delivery-to-clients feature specification
 */

import { IpcMainInvokeEvent } from "electron";
import {
  IPC_CHANNELS,
  IpcDeliveryResult,
  IpcDeliveryStatus,
  IpcRoutedMessage,
  MessageSendMultipleResponse,
} from "../types";
import {
  MessageDeliveryService,
  DeliveryStatus,
  DeliveryResult,
} from "../services/message-delivery";
import { RoutedMessage, MessageId, ISOTimestamp } from "../types";
import { Logger } from "../services/logger";

// ============================================================================
// Type Conversion Helpers
// ============================================================================

/**
 * Converts an IPC routed message to the internal RoutedMessage type.
 * Casts plain strings to branded types (MessageId, ISOTimestamp).
 */
function ipcMessageToRoutedMessage(ipcMessage: IpcRoutedMessage): RoutedMessage {
  return {
    id: ipcMessage.id as MessageId,
    text: ipcMessage.text,
    timestamp: ipcMessage.timestamp as ISOTimestamp,
    metadata: ipcMessage.metadata,
  };
}

/**
 * Converts a DeliveryResult to IpcDeliveryResult.
 * The types are structurally identical.
 */
function deliveryResultToIpc(result: DeliveryResult): IpcDeliveryResult {
  return result;
}

/**
 * Converts a DeliveryStatus to IpcDeliveryStatus.
 * Ensures all branded types are converted to plain strings.
 */
function deliveryStatusToIpc(status: DeliveryStatus): IpcDeliveryStatus {
  return {
    messageId: status.messageId,
    clientName: status.clientName,
    result: deliveryResultToIpc(status.result),
    attemptedAt: status.attemptedAt,
    response: status.response
      ? {
          type: status.response.type,
          receivedAt: status.response.receivedAt,
          payload: status.response.payload as Record<string, unknown> | undefined,
        }
      : undefined,
  };
}

// ============================================================================
// Handler Factories
// ============================================================================

/**
 * Creates an IPC handler for sending a message to a single client.
 *
 * @param getDeliveryService - Function to get the message delivery service
 * @param ipcLogger - Logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createMessageSendHandler(
  getDeliveryService: () => MessageDeliveryService | null,
  ipcLogger: Logger
): (event: IpcMainInvokeEvent, clientName: string, message: IpcRoutedMessage) => IpcDeliveryResult {
  return (
    _event: IpcMainInvokeEvent,
    clientName: string,
    message: IpcRoutedMessage
  ): IpcDeliveryResult => {
    const service = getDeliveryService();
    if (!service) {
      ipcLogger.warn("Message delivery service not initialized");
      return { success: false, error: "SEND_FAILED" };
    }

    try {
      const routedMessage = ipcMessageToRoutedMessage(message);
      const result = service.sendToClient(clientName, routedMessage);

      ipcLogger.debug("Message send via IPC", {
        clientName,
        messageId: message.id,
        success: result.success,
      });

      return deliveryResultToIpc(result);
    } catch (error) {
      ipcLogger.error("Failed to send message via IPC", {
        clientName,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: "SEND_FAILED" };
    }
  };
}

/**
 * Creates an IPC handler for sending a message to multiple clients.
 *
 * @param getDeliveryService - Function to get the message delivery service
 * @param ipcLogger - Logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createMessageSendMultipleHandler(
  getDeliveryService: () => MessageDeliveryService | null,
  ipcLogger: Logger
): (
  event: IpcMainInvokeEvent,
  clientNames: string[],
  message: IpcRoutedMessage
) => MessageSendMultipleResponse {
  return (
    _event: IpcMainInvokeEvent,
    clientNames: string[],
    message: IpcRoutedMessage
  ): MessageSendMultipleResponse => {
    const service = getDeliveryService();
    if (!service) {
      ipcLogger.warn("Message delivery service not initialized");
      // Return empty results when service is not available
      return { results: [] };
    }

    try {
      const routedMessage = ipcMessageToRoutedMessage(message);
      const resultsMap = service.sendToClients(clientNames, routedMessage);

      // Convert Map to array of entries for IPC serialization
      const results: Array<[string, IpcDeliveryResult]> = [];
      for (const [name, result] of resultsMap) {
        results.push([name, deliveryResultToIpc(result)]);
      }

      ipcLogger.debug("Message send multiple via IPC", {
        clientCount: clientNames.length,
        messageId: message.id,
        successCount: results.filter(([, r]) => r.success).length,
      });

      return { results };
    } catch (error) {
      ipcLogger.error("Failed to send message to multiple clients via IPC", {
        clientNames,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return { results: [] };
    }
  };
}

/**
 * Creates an IPC handler for getting the delivery status of a message.
 *
 * @param getDeliveryService - Function to get the message delivery service
 * @param ipcLogger - Logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createMessageGetStatusHandler(
  getDeliveryService: () => MessageDeliveryService | null,
  ipcLogger: Logger
): (event: IpcMainInvokeEvent, messageId: string) => IpcDeliveryStatus | null {
  return (_event: IpcMainInvokeEvent, messageId: string): IpcDeliveryStatus | null => {
    const service = getDeliveryService();
    if (!service) {
      ipcLogger.warn("Message delivery service not initialized");
      return null;
    }

    try {
      const status = service.getDeliveryStatus(messageId as MessageId);

      ipcLogger.debug("Message status requested via IPC", {
        messageId,
        found: !!status,
      });

      return status ? deliveryStatusToIpc(status) : null;
    } catch (error) {
      ipcLogger.error("Failed to get message status via IPC", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };
}

/**
 * Creates an IPC handler for getting recent delivery history.
 *
 * @param getDeliveryService - Function to get the message delivery service
 * @param ipcLogger - Logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createMessageGetRecentHandler(
  getDeliveryService: () => MessageDeliveryService | null,
  ipcLogger: Logger
): (event: IpcMainInvokeEvent, limit?: number) => IpcDeliveryStatus[] {
  return (_event: IpcMainInvokeEvent, limit?: number): IpcDeliveryStatus[] => {
    const service = getDeliveryService();
    if (!service) {
      ipcLogger.warn("Message delivery service not initialized");
      return [];
    }

    try {
      const statuses = service.getRecentDeliveries(limit);

      ipcLogger.debug("Recent deliveries requested via IPC", {
        limit,
        count: statuses.length,
      });

      return statuses.map(deliveryStatusToIpc);
    } catch (error) {
      ipcLogger.error("Failed to get recent deliveries via IPC", {
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  };
}

// ============================================================================
// Convenience Registration Function
// ============================================================================

/**
 * Registers all message delivery IPC handlers.
 *
 * @param ipcMain - The Electron ipcMain module
 * @param getDeliveryService - Function to get the message delivery service
 * @param ipcLogger - Logger for IPC-related logging
 *
 * @example
 * ```typescript
 * import { ipcMain } from 'electron';
 * import { registerMessageDeliveryHandlers } from './ipc/message-delivery-handlers';
 *
 * registerMessageDeliveryHandlers(
 *   ipcMain,
 *   () => wsState.messageDelivery,
 *   ipcLogger
 * );
 * ```
 */
export function registerMessageDeliveryHandlers(
  ipcMain: Electron.IpcMain,
  getDeliveryService: () => MessageDeliveryService | null,
  ipcLogger: Logger
): void {
  ipcMain.handle(
    IPC_CHANNELS.MESSAGE_SEND,
    createMessageSendHandler(getDeliveryService, ipcLogger)
  );

  ipcMain.handle(
    IPC_CHANNELS.MESSAGE_SEND_MULTIPLE,
    createMessageSendMultipleHandler(getDeliveryService, ipcLogger)
  );

  ipcMain.handle(
    IPC_CHANNELS.MESSAGE_GET_STATUS,
    createMessageGetStatusHandler(getDeliveryService, ipcLogger)
  );

  ipcMain.handle(
    IPC_CHANNELS.MESSAGE_GET_RECENT,
    createMessageGetRecentHandler(getDeliveryService, ipcLogger)
  );

  ipcLogger.info("Message delivery IPC handlers registered");
}
