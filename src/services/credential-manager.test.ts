import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initializeCredentialManager,
  getCredentialManager,
  resetCredentialManager,
  CredentialManagerService,
  CredentialManagerError,
  CredentialKey,
} from "./credential-manager";
import { initializeLogger, resetLogger } from "./logger";
import { LogLevel } from "../types";

// Mock keytar module
vi.mock("keytar", () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

import keytar from "keytar";

const mockedKeytar = vi.mocked(keytar);

describe("CredentialManagerService", () => {
  let credentialManager: CredentialManagerService;

  beforeEach(() => {
    vi.clearAllMocks();
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    credentialManager = initializeCredentialManager();
  });

  afterEach(() => {
    resetCredentialManager();
    resetLogger();
  });

  describe("singleton initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeCredentialManager();
      const instance2 = initializeCredentialManager();
      expect(instance1).toBe(instance2);
    });

    it("throws if getCredentialManager called before initialization", () => {
      resetCredentialManager();
      expect(() => getCredentialManager()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", () => {
      const instance1 = initializeCredentialManager();
      resetCredentialManager();
      resetLogger();
      initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
      const instance2 = initializeCredentialManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("storeCredential", () => {
    it("stores a credential in the keychain", async () => {
      mockedKeytar.setPassword.mockResolvedValue(undefined);

      await credentialManager.storeCredential("anthropic-api-key", "sk-test-123");

      expect(mockedKeytar.setPassword).toHaveBeenCalledWith(
        "SmartHole",
        "anthropic-api-key",
        "sk-test-123"
      );
    });

    it("throws CredentialManagerError on keytar failure", async () => {
      mockedKeytar.setPassword.mockRejectedValue(new Error("Keychain access denied"));

      await expect(
        credentialManager.storeCredential("anthropic-api-key", "sk-test-123")
      ).rejects.toThrow(CredentialManagerError);

      await expect(
        credentialManager.storeCredential("anthropic-api-key", "sk-test-123")
      ).rejects.toMatchObject({
        operation: "store",
        key: "anthropic-api-key",
      });
    });
  });

  describe("getCredential", () => {
    it("retrieves an existing credential", async () => {
      mockedKeytar.getPassword.mockResolvedValue("sk-test-123");

      const result = await credentialManager.getCredential("anthropic-api-key");

      expect(result).toBe("sk-test-123");
      expect(mockedKeytar.getPassword).toHaveBeenCalledWith("SmartHole", "anthropic-api-key");
    });

    it("returns null for non-existent credential", async () => {
      mockedKeytar.getPassword.mockResolvedValue(null);

      const result = await credentialManager.getCredential("openai-api-key");

      expect(result).toBeNull();
    });

    it("throws CredentialManagerError on keytar failure", async () => {
      mockedKeytar.getPassword.mockRejectedValue(new Error("Keychain locked"));

      await expect(credentialManager.getCredential("anthropic-api-key")).rejects.toThrow(
        CredentialManagerError
      );

      await expect(credentialManager.getCredential("anthropic-api-key")).rejects.toMatchObject({
        operation: "retrieve",
        key: "anthropic-api-key",
      });
    });
  });

  describe("deleteCredential", () => {
    it("deletes an existing credential", async () => {
      mockedKeytar.deletePassword.mockResolvedValue(true);

      await credentialManager.deleteCredential("anthropic-api-key");

      expect(mockedKeytar.deletePassword).toHaveBeenCalledWith("SmartHole", "anthropic-api-key");
    });

    it("succeeds silently when credential does not exist", async () => {
      mockedKeytar.deletePassword.mockResolvedValue(false);

      await expect(credentialManager.deleteCredential("openai-api-key")).resolves.not.toThrow();
    });

    it("throws CredentialManagerError on keytar failure", async () => {
      mockedKeytar.deletePassword.mockRejectedValue(new Error("Permission denied"));

      await expect(credentialManager.deleteCredential("anthropic-api-key")).rejects.toThrow(
        CredentialManagerError
      );

      await expect(credentialManager.deleteCredential("anthropic-api-key")).rejects.toMatchObject({
        operation: "delete",
        key: "anthropic-api-key",
      });
    });
  });

  describe("hasCredential", () => {
    it("returns true when credential exists", async () => {
      mockedKeytar.getPassword.mockResolvedValue("sk-test-123");

      const result = await credentialManager.hasCredential("anthropic-api-key");

      expect(result).toBe(true);
    });

    it("returns false when credential does not exist", async () => {
      mockedKeytar.getPassword.mockResolvedValue(null);

      const result = await credentialManager.hasCredential("openai-api-key");

      expect(result).toBe(false);
    });

    it("throws CredentialManagerError on keytar failure", async () => {
      mockedKeytar.getPassword.mockRejectedValue(new Error("System error"));

      await expect(credentialManager.hasCredential("anthropic-api-key")).rejects.toThrow(
        CredentialManagerError
      );

      await expect(credentialManager.hasCredential("anthropic-api-key")).rejects.toMatchObject({
        operation: "check",
        key: "anthropic-api-key",
      });
    });
  });

  describe("CredentialKey type coverage", () => {
    it.each<CredentialKey>(["anthropic-api-key", "stt-api-key", "openai-api-key", "groq-api-key"])(
      "can store and retrieve %s",
      async (key) => {
        mockedKeytar.setPassword.mockResolvedValue(undefined);
        mockedKeytar.getPassword.mockResolvedValue("test-value");

        await credentialManager.storeCredential(key, "test-value");
        const result = await credentialManager.getCredential(key);

        expect(mockedKeytar.setPassword).toHaveBeenCalledWith("SmartHole", key, "test-value");
        expect(result).toBe("test-value");
      }
    );
  });
});
