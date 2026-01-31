/**
 * Tests for the credential IPC handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCredentialStoreHandler,
  createCredentialDeleteHandler,
  createCredentialHasHandler,
} from "./credential-handler";
import type { CredentialManagerService } from "../services/credential-manager";
import type { CredentialKey } from "../types";
import type { Logger } from "../services/logger";

// Mock CredentialManagerService
function createMockCredentialManager(
  overrides: Partial<CredentialManagerService> = {}
): CredentialManagerService {
  return {
    storeCredential: vi.fn().mockResolvedValue(undefined),
    getCredential: vi.fn().mockResolvedValue(null),
    deleteCredential: vi.fn().mockResolvedValue(undefined),
    hasCredential: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

// Mock Logger
function createMockLogger(): Logger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: "info",
    silent: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Logger;
}

describe("createCredentialStoreHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should store credential via manager", async () => {
    const credentialManager = createMockCredentialManager();

    const handler = createCredentialStoreHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    await handler(mockEvent, { key: "anthropic-api-key", value: "sk-test-123" });

    expect(credentialManager.storeCredential).toHaveBeenCalledWith(
      "anthropic-api-key",
      "sk-test-123"
    );
  });

  it("should log debug message when credential stored", async () => {
    const credentialManager = createMockCredentialManager();

    const handler = createCredentialStoreHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    await handler(mockEvent, { key: "openai-api-key", value: "test-value" });

    expect(mockLogger.debug).toHaveBeenCalledWith("Credential stored via IPC", {
      key: "openai-api-key",
    });
  });

  it("should throw and log error when manager throws", async () => {
    const credentialManager = createMockCredentialManager({
      storeCredential: vi.fn().mockRejectedValue(new Error("Keychain access denied")),
    });

    const handler = createCredentialStoreHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    await expect(handler(mockEvent, { key: "anthropic-api-key", value: "test" })).rejects.toThrow(
      "Keychain access denied"
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should work with all credential key types", async () => {
    const credentialManager = createMockCredentialManager();
    const handler = createCredentialStoreHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const keys: CredentialKey[] = [
      "anthropic-api-key",
      "stt-api-key",
      "openai-api-key",
      "groq-api-key",
    ];

    for (const key of keys) {
      await handler(mockEvent, { key, value: `value-for-${key}` });
      expect(credentialManager.storeCredential).toHaveBeenCalledWith(key, `value-for-${key}`);
    }
  });
});

describe("createCredentialDeleteHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should delete credential via manager", async () => {
    const credentialManager = createMockCredentialManager();

    const handler = createCredentialDeleteHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    await handler(mockEvent, { key: "anthropic-api-key" });

    expect(credentialManager.deleteCredential).toHaveBeenCalledWith("anthropic-api-key");
  });

  it("should log debug message when credential deleted", async () => {
    const credentialManager = createMockCredentialManager();

    const handler = createCredentialDeleteHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    await handler(mockEvent, { key: "groq-api-key" });

    expect(mockLogger.debug).toHaveBeenCalledWith("Credential deleted via IPC", {
      key: "groq-api-key",
    });
  });

  it("should throw and log error when manager throws", async () => {
    const credentialManager = createMockCredentialManager({
      deleteCredential: vi.fn().mockRejectedValue(new Error("Keychain locked")),
    });

    const handler = createCredentialDeleteHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    await expect(handler(mockEvent, { key: "stt-api-key" })).rejects.toThrow("Keychain locked");
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should work with all credential key types", async () => {
    const credentialManager = createMockCredentialManager();
    const handler = createCredentialDeleteHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const keys: CredentialKey[] = [
      "anthropic-api-key",
      "stt-api-key",
      "openai-api-key",
      "groq-api-key",
    ];

    for (const key of keys) {
      await handler(mockEvent, { key });
      expect(credentialManager.deleteCredential).toHaveBeenCalledWith(key);
    }
  });
});

describe("createCredentialHasHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should return true when credential exists", async () => {
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockResolvedValue(true),
    });

    const handler = createCredentialHasHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, { key: "anthropic-api-key" });

    expect(result).toBe(true);
    expect(credentialManager.hasCredential).toHaveBeenCalledWith("anthropic-api-key");
  });

  it("should return false when credential does not exist", async () => {
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockResolvedValue(false),
    });

    const handler = createCredentialHasHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, { key: "openai-api-key" });

    expect(result).toBe(false);
  });

  it("should log debug message with existence result", async () => {
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockResolvedValue(true),
    });

    const handler = createCredentialHasHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    await handler(mockEvent, { key: "stt-api-key" });

    expect(mockLogger.debug).toHaveBeenCalledWith("Credential existence checked via IPC", {
      key: "stt-api-key",
      exists: true,
    });
  });

  it("should throw and log error when manager throws", async () => {
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockRejectedValue(new Error("Keychain unavailable")),
    });

    const handler = createCredentialHasHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    await expect(handler(mockEvent, { key: "anthropic-api-key" })).rejects.toThrow(
      "Keychain unavailable"
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should work with all credential key types", async () => {
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockResolvedValue(true),
    });
    const handler = createCredentialHasHandler(() => credentialManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const keys: CredentialKey[] = [
      "anthropic-api-key",
      "stt-api-key",
      "openai-api-key",
      "groq-api-key",
    ];

    for (const key of keys) {
      const result = await handler(mockEvent, { key });
      expect(result).toBe(true);
      expect(credentialManager.hasCredential).toHaveBeenCalledWith(key);
    }
  });
});
