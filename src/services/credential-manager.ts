import keytar from "keytar";
import { getLogger, Logger } from "./logger";

// ============================================================================
// Types
// ============================================================================

export type CredentialKey = "anthropic-api-key" | "stt-api-key" | "openai-api-key" | "groq-api-key";

export class CredentialManagerError extends Error {
  constructor(
    public readonly operation: string,
    public readonly key: CredentialKey,
    public readonly cause?: Error
  ) {
    super(`Credential ${operation} failed for key "${key}": ${cause?.message ?? "Unknown error"}`);
    this.name = "CredentialManagerError";
  }
}

export interface CredentialManagerService {
  storeCredential(key: CredentialKey, value: string): Promise<void>;
  getCredential(key: CredentialKey): Promise<string | null>;
  deleteCredential(key: CredentialKey): Promise<void>;
  hasCredential(key: CredentialKey): Promise<boolean>;
}

// ============================================================================
// Constants
// ============================================================================

/** Service name used for all keychain entries. */
const SERVICE_NAME = "SmartHole";

// ============================================================================
// Implementation
// ============================================================================

class CredentialManagerServiceImpl implements CredentialManagerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = getLogger().child({ component: "CredentialManager" });
    this.logger.debug("CredentialManager initialized");
  }

  async storeCredential(key: CredentialKey, value: string): Promise<void> {
    this.logger.debug("Storing credential", { key });

    try {
      await keytar.setPassword(SERVICE_NAME, key, value);
      this.logger.info("Credential stored successfully", { key });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Failed to store credential", { key, error: err.message });
      throw new CredentialManagerError("store", key, err);
    }
  }

  async getCredential(key: CredentialKey): Promise<string | null> {
    this.logger.debug("Retrieving credential", { key });

    try {
      const value = await keytar.getPassword(SERVICE_NAME, key);
      this.logger.debug("Credential retrieval completed", {
        key,
        found: value !== null,
      });
      return value;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Failed to retrieve credential", { key, error: err.message });
      throw new CredentialManagerError("retrieve", key, err);
    }
  }

  async deleteCredential(key: CredentialKey): Promise<void> {
    this.logger.debug("Deleting credential", { key });

    try {
      const deleted = await keytar.deletePassword(SERVICE_NAME, key);
      if (deleted) {
        this.logger.info("Credential deleted successfully", { key });
      } else {
        this.logger.debug("Credential not found for deletion", { key });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Failed to delete credential", { key, error: err.message });
      throw new CredentialManagerError("delete", key, err);
    }
  }

  async hasCredential(key: CredentialKey): Promise<boolean> {
    this.logger.debug("Checking credential existence", { key });

    try {
      const value = await keytar.getPassword(SERVICE_NAME, key);
      const exists = value !== null;
      this.logger.debug("Credential existence check completed", { key, exists });
      return exists;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Failed to check credential existence", { key, error: err.message });
      throw new CredentialManagerError("check", key, err);
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let credentialManagerInstance: CredentialManagerServiceImpl | null = null;

/** Must be called inside `app.whenReady()` after the logger has been initialized. */
export function initializeCredentialManager(): CredentialManagerService {
  if (credentialManagerInstance) {
    return credentialManagerInstance;
  }

  credentialManagerInstance = new CredentialManagerServiceImpl();
  return credentialManagerInstance;
}

export function getCredentialManager(): CredentialManagerService {
  if (!credentialManagerInstance) {
    throw new Error(
      "CredentialManager not initialized. Call initializeCredentialManager() before using getCredentialManager()."
    );
  }
  return credentialManagerInstance;
}

export function resetCredentialManager(): void {
  credentialManagerInstance = null;
}
