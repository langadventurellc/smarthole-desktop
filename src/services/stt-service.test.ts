import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initializeSttService,
  getSttService,
  resetSttService,
  SttServiceError,
} from "./stt-service";
import { initializeLogger, resetLogger } from "./logger";
import { initializeConfigManager, resetConfigManager, getConfigManager } from "./config-manager";
import { initializeCredentialManager, resetCredentialManager } from "./credential-manager";
import { LogLevel, DEFAULT_CONFIG, AppConfig } from "../types";
import { ErrorCode } from "../types/errors";
import type { AudioBuffer } from "../types/audio";
import type { SttResult } from "../types/stt";

// Mock keytar module
vi.mock("keytar", () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

// Mock electron-store
vi.mock("electron-store", () => {
  return {
    default: vi.fn().mockImplementation(function (
      this: MockStore,
      options?: { defaults?: AppConfig }
    ) {
      const defaults = options?.defaults ?? {};
      this._data = JSON.parse(JSON.stringify(defaults));
      this.path = "/mock/path/to/config.json";
      return this;
    }),
  };
});

interface MockStore {
  _data: Record<string, unknown>;
  path: string;
  store: Record<string, unknown>;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  clear(): void;
}

// Get the mock constructor to add prototype methods
import Store from "electron-store";
const MockStore = Store as unknown as { prototype: MockStore };

MockStore.prototype = {
  _data: {},
  path: "/mock/path/to/config.json",
  get store() {
    return JSON.parse(JSON.stringify(this._data));
  },
  get(key: string): unknown {
    const keys = key.split(".");
    let current: unknown = this._data;
    for (const k of keys) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[k];
    }
    return current;
  },
  set(key: string, value: unknown): void {
    const keys = key.split(".");
    let current: Record<string, unknown> = this._data as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (current[k] === undefined || typeof current[k] !== "object") {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  },
  clear(): void {
    // Reset to defaults (mimics electron-store behavior)
    this._data = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  },
};

// Create mock function for transcription
const mockTranscribe = vi.fn();
const mockIsAvailable = vi.fn();

// Mock the GroqSttBackend
vi.mock("./stt-backends", () => ({
  GroqSttBackend: class MockGroqSttBackend {
    name = "cloud" as const;
    transcribe = mockTranscribe;
    isAvailable = mockIsAvailable;
  },
}));

import keytar from "keytar";

const mockedKeytar = vi.mocked(keytar);

describe("SttService", () => {
  const testAudioBuffer: AudioBuffer = {
    data: new ArrayBuffer(1024),
    format: "wav",
    sampleRate: 16000,
    channels: 1,
    durationMs: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTranscribe.mockReset();
    mockIsAvailable.mockReset();
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    initializeConfigManager();
    initializeCredentialManager();
  });

  afterEach(() => {
    resetSttService();
    resetCredentialManager();
    resetConfigManager();
    resetLogger();
  });

  describe("singleton initialization", () => {
    it("returns same instance on multiple initialize calls", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");

      const instance1 = await initializeSttService();
      const instance2 = await initializeSttService();

      expect(instance1).toBe(instance2);
    });

    it("throws if getSttService called before initialization", () => {
      expect(() => getSttService()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");

      const instance1 = await initializeSttService();
      resetSttService();
      const instance2 = await initializeSttService();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("backend selection", () => {
    it("uses cloud backend when config is 'cloud'", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");

      const service = await initializeSttService();

      expect(service.getActiveBackend()).toBe("cloud");
    });

    it("throws STT_INITIALIZATION_FAILED when local backend requested", async () => {
      // Set config to local backend
      const configManager = getConfigManager();
      configManager.setConfig({ stt: { backend: "local" } });

      const error = await initializeSttService().catch((e) => e);

      expect(error).toBeInstanceOf(SttServiceError);
      expect(error.code).toBe(ErrorCode.STT_INITIALIZATION_FAILED);
      expect(error.message).toContain("not yet implemented");
    });

    it("throws STT_INITIALIZATION_FAILED when no API key available for cloud", async () => {
      mockedKeytar.getPassword.mockResolvedValue(null);

      const error = await initializeSttService().catch((e) => e);

      expect(error).toBeInstanceOf(SttServiceError);
      expect(error.code).toBe(ErrorCode.STT_INITIALIZATION_FAILED);
      expect(error.message).toContain("API key not found");
    });
  });

  describe("transcribe", () => {
    it("delegates transcription to the active backend", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");
      const expectedResult: SttResult = {
        text: "Hello, world!",
        durationMs: 1000,
        backendUsed: "cloud",
      };
      mockTranscribe.mockResolvedValue(expectedResult);

      const service = await initializeSttService();
      const result = await service.transcribe(testAudioBuffer);

      expect(mockTranscribe).toHaveBeenCalledWith(testAudioBuffer);
      expect(result).toEqual(expectedResult);
    });

    it("propagates errors from the backend", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");
      const backendError = new Error("Transcription failed");
      mockTranscribe.mockRejectedValue(backendError);

      const service = await initializeSttService();

      await expect(service.transcribe(testAudioBuffer)).rejects.toThrow("Transcription failed");
    });
  });

  describe("getActiveBackend", () => {
    it("returns the current backend type", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");

      const service = await initializeSttService();

      expect(service.getActiveBackend()).toBe("cloud");
    });
  });

  describe("isReady", () => {
    it("returns true when backend is available", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");
      mockIsAvailable.mockResolvedValue(true);

      const service = await initializeSttService();
      const ready = await service.isReady();

      expect(ready).toBe(true);
      expect(mockIsAvailable).toHaveBeenCalled();
    });

    it("returns false when backend is not available", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");
      mockIsAvailable.mockResolvedValue(false);

      const service = await initializeSttService();
      const ready = await service.isReady();

      expect(ready).toBe(false);
    });
  });

  describe("SttServiceError", () => {
    it("includes error code and cause", () => {
      const cause = new Error("Original error");
      const error = new SttServiceError(
        "Test error message",
        ErrorCode.STT_INITIALIZATION_FAILED,
        cause
      );

      expect(error.name).toBe("SttServiceError");
      expect(error.message).toBe("Test error message");
      expect(error.code).toBe(ErrorCode.STT_INITIALIZATION_FAILED);
      expect(error.cause).toBe(cause);
    });

    it("works without cause", () => {
      const error = new SttServiceError("Test error", ErrorCode.STT_INITIALIZATION_FAILED);

      expect(error.cause).toBeUndefined();
    });
  });
});
