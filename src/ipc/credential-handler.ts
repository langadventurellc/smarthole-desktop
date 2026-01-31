// IPC credential handlers - getCredential intentionally not exposed to renderer.

import { IpcMainInvokeEvent } from "electron";
import { CredentialStorePayload, CredentialKeyPayload } from "../types";
import { CredentialManagerService } from "../services/credential-manager";
import { Logger } from "../services/logger";

/** Creates an IPC handler for CREDENTIAL_STORE channel. */
export function createCredentialStoreHandler(
  getCredentialManager: () => CredentialManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, payload: CredentialStorePayload) => Promise<void> {
  return async (_event: IpcMainInvokeEvent, payload: CredentialStorePayload): Promise<void> => {
    try {
      const credentialManager = getCredentialManager();
      await credentialManager.storeCredential(payload.key, payload.value);

      ipcLogger.debug("Credential stored via IPC", { key: payload.key });
    } catch (error) {
      ipcLogger.error("Failed to store credential via IPC", {
        key: payload.key,
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw to let the renderer handle the error
      throw error;
    }
  };
}

/** Creates an IPC handler for CREDENTIAL_DELETE channel. */
export function createCredentialDeleteHandler(
  getCredentialManager: () => CredentialManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, payload: CredentialKeyPayload) => Promise<void> {
  return async (_event: IpcMainInvokeEvent, payload: CredentialKeyPayload): Promise<void> => {
    try {
      const credentialManager = getCredentialManager();
      await credentialManager.deleteCredential(payload.key);

      ipcLogger.debug("Credential deleted via IPC", { key: payload.key });
    } catch (error) {
      ipcLogger.error("Failed to delete credential via IPC", {
        key: payload.key,
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw to let the renderer handle the error
      throw error;
    }
  };
}

/** Creates an IPC handler for CREDENTIAL_HAS channel. */
export function createCredentialHasHandler(
  getCredentialManager: () => CredentialManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, payload: CredentialKeyPayload) => Promise<boolean> {
  return async (_event: IpcMainInvokeEvent, payload: CredentialKeyPayload): Promise<boolean> => {
    try {
      const credentialManager = getCredentialManager();
      const exists = await credentialManager.hasCredential(payload.key);

      ipcLogger.debug("Credential existence checked via IPC", { key: payload.key, exists });

      return exists;
    } catch (error) {
      ipcLogger.error("Failed to check credential existence via IPC", {
        key: payload.key,
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw to let the renderer handle the error
      throw error;
    }
  };
}
