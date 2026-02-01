/**
 * IPC handlers for message routing operations.
 * Bridges the RoutingAgentService to IPC channels for renderer access.
 */

import { IpcMainInvokeEvent } from "electron";
import { Logger } from "../services/logger";
import { ClientRegistryService } from "../services/client-registry";
import { CredentialManagerService } from "../services/credential-manager";
import { RoutingAgentService } from "../types";
import {
  RoutingSubmitMessagePayload,
  RoutingSubmitMessageResponse,
  RoutingStatusResponse,
  isRoutingSubmitMessagePayload,
} from "../types/ipc";

/**
 * Creates an IPC handler for ROUTING_SUBMIT_MESSAGE channel.
 * Routes a message through the RoutingAgentService.
 *
 * @param getRoutingAgent - Function to get the routing agent service
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createRoutingSubmitHandler(
  getRoutingAgent: () => RoutingAgentService,
  ipcLogger: Logger
): (
  _event: IpcMainInvokeEvent,
  payload: RoutingSubmitMessagePayload
) => Promise<RoutingSubmitMessageResponse> {
  return async (
    _event: IpcMainInvokeEvent,
    payload: unknown
  ): Promise<RoutingSubmitMessageResponse> => {
    // Validate payload structure
    if (!isRoutingSubmitMessagePayload(payload)) {
      const rawPayload = payload as Record<string, unknown> | null | undefined;
      ipcLogger.warn("Invalid routing submit payload received", {
        hasMessage: typeof rawPayload?.message === "string",
        hasSource: typeof rawPayload?.source === "string",
      });

      return {
        success: false,
        outcomeType: "routing_failed",
        error: "Invalid payload: message and source are required",
      };
    }

    // After type guard, payload is guaranteed to be RoutingSubmitMessagePayload
    ipcLogger.debug("Routing message via IPC", {
      source: payload.source,
      messageLength: payload.message.length,
      hasMetadata: !!payload.metadata,
    });

    try {
      const routingAgent = getRoutingAgent();
      const outcome = await routingAgent.routeMessage({
        message: payload.message,
        source: payload.source,
        metadata: payload.metadata,
      });

      // Map RoutingOutcome to RoutingSubmitMessageResponse
      switch (outcome.type) {
        case "routed":
          ipcLogger.info("Message routed successfully via IPC", {
            deliveryCount: outcome.deliveries.length,
            source: payload.source,
          });
          return {
            success: true,
            outcomeType: "routed",
            deliveryCount: outcome.deliveries.length,
          };

        case "no_clients":
          ipcLogger.info("No clients available for routing via IPC", {
            source: payload.source,
          });
          return {
            success: false,
            outcomeType: "no_clients",
            error: outcome.message,
          };

        case "routing_failed":
          ipcLogger.warn("Routing failed via IPC", {
            source: payload.source,
            error: outcome.error,
            fallbackAttempted: outcome.fallbackAttempted,
          });
          return {
            success: false,
            outcomeType: "routing_failed",
            error: outcome.error,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ipcLogger.error("Unexpected error during routing via IPC", {
        error: errorMessage,
        source: payload.source,
      });

      return {
        success: false,
        outcomeType: "routing_failed",
        error: `Unexpected error: ${errorMessage}`,
      };
    }
  };
}

/**
 * Creates an IPC handler for ROUTING_GET_STATUS channel.
 * Returns the current status of the routing service.
 *
 * @param getClientRegistry - Function to get the client registry service
 * @param getCredentialManager - Function to get the credential manager service
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createRoutingStatusHandler(
  getClientRegistry: () => ClientRegistryService,
  getCredentialManager: () => CredentialManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => Promise<RoutingStatusResponse> {
  return async (_event: IpcMainInvokeEvent): Promise<RoutingStatusResponse> => {
    try {
      const registry = getClientRegistry();
      const credentialManager = getCredentialManager();

      // Check if the Anthropic API key is configured (required for LLM routing)
      const hasApiKey = await credentialManager.hasCredential("anthropic-api-key");
      const clientCount = registry.getClientCount();

      ipcLogger.debug("Routing status requested via IPC", {
        available: hasApiKey,
        clientCount,
      });

      return {
        available: hasApiKey,
        clientCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ipcLogger.error("Failed to get routing status via IPC", {
        error: errorMessage,
      });

      // Return a safe default if status check fails
      return {
        available: false,
        clientCount: 0,
      };
    }
  };
}
