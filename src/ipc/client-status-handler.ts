/**
 * IPC client status handler for the main process.
 * Provides client registry information to the renderer process.
 *
 * @see F-connection-health-ui feature specification
 */

import { IpcMainInvokeEvent, BrowserWindow } from "electron";
import { ClientSummary, ClientDetails, ClientStatusChangedPayload, IPC_CHANNELS } from "../types";
import { ClientRegistryService } from "../services/client-registry";
import { Logger } from "../services/logger";

/**
 * Converts a RegistryClientInfo to a ClientSummary for the list view.
 *
 * @param client - The client info from the registry
 * @returns Minimal client summary for list display
 */
function toClientSummary(client: { name: string; description: string }): ClientSummary {
  return {
    name: client.name,
    description: client.description,
  };
}

/**
 * Converts a RegistryClientInfo to ClientDetails for the detail view.
 *
 * @param client - The client info from the registry
 * @returns Full client details for IPC transport
 */
function toClientDetails(client: {
  id: string;
  name: string;
  description: string;
  version?: string;
  capabilities?: string[];
  registeredAt: string;
}): ClientDetails {
  return {
    id: client.id,
    name: client.name,
    description: client.description,
    version: client.version,
    capabilities: client.capabilities,
    registeredAt: client.registeredAt,
  };
}

/**
 * Creates an IPC handler function for CLIENTS_GET_COUNT channel.
 * Returns the number of registered clients.
 *
 * @param getRegistry - Function to get the client registry service
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createClientCountHandler(
  getRegistry: () => ClientRegistryService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => number {
  return (_event: IpcMainInvokeEvent): number => {
    try {
      const registry = getRegistry();
      const count = registry.getClientCount();

      ipcLogger.debug("Client count requested", { count });

      return count;
    } catch (error) {
      ipcLogger.error("Failed to get client count", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return 0 rather than throwing to maintain graceful degradation
      return 0;
    }
  };
}

/**
 * Creates an IPC handler function for CLIENTS_GET_LIST channel.
 * Returns an array of client summaries.
 *
 * @param getRegistry - Function to get the client registry service
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createClientListHandler(
  getRegistry: () => ClientRegistryService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => ClientSummary[] {
  return (_event: IpcMainInvokeEvent): ClientSummary[] => {
    try {
      const registry = getRegistry();
      const clients = registry.getAllClients();
      const summaries = clients.map(toClientSummary);

      ipcLogger.debug("Client list requested", { count: summaries.length });

      return summaries;
    } catch (error) {
      ipcLogger.error("Failed to get client list", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty array rather than throwing
      return [];
    }
  };
}

/**
 * Creates an IPC handler function for CLIENTS_GET_DETAILS channel.
 * Returns detailed info for a specific client, or null if not found.
 *
 * @param getRegistry - Function to get the client registry service
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createClientDetailsHandler(
  getRegistry: () => ClientRegistryService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, clientName: string) => ClientDetails | null {
  return (_event: IpcMainInvokeEvent, clientName: string): ClientDetails | null => {
    try {
      const registry = getRegistry();
      const client = registry.getClient(clientName);

      if (!client) {
        ipcLogger.debug("Client details requested for unknown client", { clientName });
        return null;
      }

      const details = toClientDetails(client);

      ipcLogger.debug("Client details requested", { clientName });

      return details;
    } catch (error) {
      ipcLogger.error("Failed to get client details", {
        clientName,
        error: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  };
}

/**
 * Broadcasts client status change to all renderer windows.
 *
 * @param payload - The status change payload
 */
export function broadcastClientStatusChange(payload: ClientStatusChangedPayload): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.CLIENTS_STATUS_CHANGED, payload);
    }
  }
}

/**
 * Creates a callback for registry 'registered' events that broadcasts to renderer.
 *
 * @param getRegistry - Function to get the client registry service
 * @returns Callback function for registry 'registered' events
 */
export function createRegisteredEventHandler(
  getRegistry: () => ClientRegistryService
): (event: { client: { name: string; description: string } }) => void {
  return (event): void => {
    const registry = getRegistry();
    const payload: ClientStatusChangedPayload = {
      event: "registered",
      client: toClientSummary(event.client),
      count: registry.getClientCount(),
    };
    broadcastClientStatusChange(payload);
  };
}

/**
 * Creates a callback for registry 'unregistered' events that broadcasts to renderer.
 *
 * @param getRegistry - Function to get the client registry service
 * @returns Callback function for registry 'unregistered' events
 */
export function createUnregisteredEventHandler(
  getRegistry: () => ClientRegistryService
): (event: { client: { name: string; description: string } }) => void {
  return (event): void => {
    const registry = getRegistry();
    const payload: ClientStatusChangedPayload = {
      event: "unregistered",
      client: toClientSummary(event.client),
      count: registry.getClientCount(),
    };
    broadcastClientStatusChange(payload);
  };
}
