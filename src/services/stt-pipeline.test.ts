import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initializeSttPipeline, getSttPipeline, resetSttPipeline } from "./stt-pipeline";
import { initializeLogger, resetLogger } from "./logger";
import { initializeInputState, resetInputState, getInputState } from "./input-state";
import { initializeNotificationService, resetNotificationService } from "./notifications";
import { LogLevel, InputState, DEFAULT_CONFIG, AppConfig } from "../types";
import type { AudioCaptureResult } from "../types/audio";
import type { SttResult } from "../types/stt";

// Mock keytar module (needed by credential-manager)
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
    this._data = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  },
};

// Mock Electron's Notification and BrowserWindow
vi.mock("electron", () => ({
  Notification: {
    isSupported: vi.fn().mockReturnValue(true),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
  },
}));

// Create mock functions for STT service
const mockTranscribe = vi.fn();
const mockIsReady = vi.fn();
const mockGetActiveBackend = vi.fn();

// Mock the STT service
vi.mock("./stt-service", () => ({
  getSttService: vi.fn(() => ({
    transcribe: mockTranscribe,
    isReady: mockIsReady,
    getActiveBackend: mockGetActiveBackend,
  })),
}));

// Mock notification service show methods
const mockShowError = vi.fn();

vi.mock("./notifications", async (importOriginal) => {
  const original = await importOriginal<typeof import("./notifications")>();
  return {
    ...original,
    getNotificationService: vi.fn(() => ({
      showError: mockShowError,
      showInfo: vi.fn(),
      showWarning: vi.fn(),
      showSuccess: vi.fn(),
      show: vi.fn(),
      isSupported: vi.fn().mockReturnValue(true),
    })),
  };
});

describe("SttPipelineService", () => {
  const testAudioResult: AudioCaptureResult = {
    audio: {
      data: new ArrayBuffer(1024),
      format: "wav",
      sampleRate: 16000,
      channels: 1,
      durationMs: 1000,
    },
    startedAt: "2026-01-31T10:00:00.000Z",
    stoppedAt: "2026-01-31T10:00:01.000Z",
  };

  const testSttResult: SttResult = {
    text: "Hello, world!",
    confidence: 0.95,
    durationMs: 1000,
    backendUsed: "cloud",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTranscribe.mockReset();
    mockIsReady.mockReset();
    mockGetActiveBackend.mockReset();
    mockShowError.mockReset();

    // Initialize required services
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    initializeInputState();
    initializeNotificationService();

    // Default mock returns
    mockGetActiveBackend.mockReturnValue("cloud");
    mockIsReady.mockResolvedValue(true);
  });

  afterEach(() => {
    resetSttPipeline();
    resetNotificationService();
    resetInputState();
    resetLogger();
  });

  describe("singleton initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeSttPipeline();
      const instance2 = initializeSttPipeline();

      expect(instance1).toBe(instance2);
    });

    it("throws if getSttPipeline called before initialization", () => {
      expect(() => getSttPipeline()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", () => {
      const instance1 = initializeSttPipeline();
      resetSttPipeline();
      const instance2 = initializeSttPipeline();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("processAudio", () => {
    describe("success path", () => {
      it("transcribes audio and emits transcriptionReady event", async () => {
        mockTranscribe.mockResolvedValue(testSttResult);

        const pipeline = initializeSttPipeline();
        const transcriptionReadyHandler = vi.fn();
        pipeline.on("transcriptionReady", transcriptionReadyHandler);

        await pipeline.processAudio(testAudioResult);

        expect(mockTranscribe).toHaveBeenCalledWith(testAudioResult.audio);
        expect(transcriptionReadyHandler).toHaveBeenCalledTimes(1);

        const event = transcriptionReadyHandler.mock.calls[0][0];
        expect(event.text).toBe("Hello, world!");
        expect(event.confidence).toBe(0.95);
        expect(event.inputMethod).toBe("voice");
        expect(event.audioMetadata.durationMs).toBe(1000);
        expect(event.audioMetadata.startedAt).toBe("2026-01-31T10:00:00.000Z");
        expect(event.audioMetadata.stoppedAt).toBe("2026-01-31T10:00:01.000Z");
        expect(event.sttMetadata.backendUsed).toBe("cloud");
        expect(event.sttMetadata.processingTimeMs).toBeGreaterThanOrEqual(0);
      });

      it("transitions InputState to PROCESSING and back to IDLE", async () => {
        mockTranscribe.mockResolvedValue(testSttResult);

        const pipeline = initializeSttPipeline();
        const inputStateService = getInputState();
        const stateChanges: InputState[] = [];

        inputStateService.on("stateChanged", (event) => {
          stateChanges.push(event.newState);
        });

        await pipeline.processAudio(testAudioResult);

        expect(stateChanges).toContain(InputState.PROCESSING);
        expect(stateChanges[stateChanges.length - 1]).toBe(InputState.IDLE);
      });
    });

    describe("error handling", () => {
      it("handles empty transcription result", async () => {
        mockTranscribe.mockResolvedValue({ ...testSttResult, text: "" });

        const pipeline = initializeSttPipeline();
        const errorHandler = vi.fn();
        pipeline.on("transcriptionError", errorHandler);

        await pipeline.processAudio(testAudioResult);

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].code).toBe("EMPTY_RESULT");
        expect(mockShowError).toHaveBeenCalledWith(
          "No Speech Detected",
          "Try speaking more clearly or closer to the microphone."
        );
      });

      it("handles whitespace-only transcription result", async () => {
        mockTranscribe.mockResolvedValue({ ...testSttResult, text: "   \n\t  " });

        const pipeline = initializeSttPipeline();
        const errorHandler = vi.fn();
        pipeline.on("transcriptionError", errorHandler);

        await pipeline.processAudio(testAudioResult);

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].code).toBe("EMPTY_RESULT");
      });

      it("handles API key errors", async () => {
        mockTranscribe.mockRejectedValue(new Error("API key not found"));

        const pipeline = initializeSttPipeline();
        const errorHandler = vi.fn();
        pipeline.on("transcriptionError", errorHandler);

        await pipeline.processAudio(testAudioResult);

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].code).toBe("NO_API_KEY");
        expect(mockShowError).toHaveBeenCalledWith(
          "STT Not Configured",
          "Please add your API key in Settings"
        );
      });

      it("handles network errors", async () => {
        mockTranscribe.mockRejectedValue(new Error("Network request failed: ECONNREFUSED"));

        const pipeline = initializeSttPipeline();
        const errorHandler = vi.fn();
        pipeline.on("transcriptionError", errorHandler);

        await pipeline.processAudio(testAudioResult);

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].code).toBe("NETWORK_ERROR");
        expect(mockShowError).toHaveBeenCalledWith(
          "Transcription Failed",
          "Could not reach transcription service. Check your connection."
        );
      });

      it("handles rate limit errors", async () => {
        mockTranscribe.mockRejectedValue(new Error("Rate limit exceeded (429)"));

        const pipeline = initializeSttPipeline();
        const errorHandler = vi.fn();
        pipeline.on("transcriptionError", errorHandler);

        await pipeline.processAudio(testAudioResult);

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].code).toBe("RATE_LIMIT");
        expect(mockShowError).toHaveBeenCalledWith(
          "Too Many Requests",
          "Please wait a moment before trying again."
        );
      });

      it("handles audio format errors", async () => {
        mockTranscribe.mockRejectedValue(new Error("Invalid audio format"));

        const pipeline = initializeSttPipeline();
        const errorHandler = vi.fn();
        pipeline.on("transcriptionError", errorHandler);

        await pipeline.processAudio(testAudioResult);

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].code).toBe("INVALID_AUDIO");
        expect(mockShowError).toHaveBeenCalledWith(
          "Audio Error",
          "Recording format issue. Please try again."
        );
      });

      it("handles generic transcription errors", async () => {
        mockTranscribe.mockRejectedValue(new Error("Unknown service error"));

        const pipeline = initializeSttPipeline();
        const errorHandler = vi.fn();
        pipeline.on("transcriptionError", errorHandler);

        await pipeline.processAudio(testAudioResult);

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].code).toBe("TRANSCRIPTION_FAILED");
        expect(mockShowError).toHaveBeenCalledWith(
          "Transcription Failed",
          "An error occurred. Try text input instead."
        );
      });

      it("transitions to IDLE even on error", async () => {
        mockTranscribe.mockRejectedValue(new Error("Test error"));

        const pipeline = initializeSttPipeline();
        const inputStateService = getInputState();

        await pipeline.processAudio(testAudioResult);

        expect(inputStateService.getCurrentState()).toBe(InputState.IDLE);
      });

      it("includes cause in error event", async () => {
        const originalError = new Error("Original cause");
        mockTranscribe.mockRejectedValue(originalError);

        const pipeline = initializeSttPipeline();
        const errorHandler = vi.fn();
        pipeline.on("transcriptionError", errorHandler);

        await pipeline.processAudio(testAudioResult);

        expect(errorHandler.mock.calls[0][0].cause).toBe(originalError);
      });
    });
  });

  describe("isReady", () => {
    it("returns true when STT service is ready", async () => {
      mockIsReady.mockResolvedValue(true);

      const pipeline = initializeSttPipeline();
      const ready = await pipeline.isReady();

      expect(ready).toBe(true);
    });

    it("returns false when STT service is not ready", async () => {
      mockIsReady.mockResolvedValue(false);

      const pipeline = initializeSttPipeline();
      const ready = await pipeline.isReady();

      expect(ready).toBe(false);
    });

    it("returns false when STT service throws", async () => {
      mockIsReady.mockRejectedValue(new Error("Service error"));

      const pipeline = initializeSttPipeline();
      const ready = await pipeline.isReady();

      expect(ready).toBe(false);
    });
  });

  describe("event subscription", () => {
    it("allows subscribing and unsubscribing to events", async () => {
      mockTranscribe.mockResolvedValue(testSttResult);

      const pipeline = initializeSttPipeline();
      const handler = vi.fn();

      pipeline.on("transcriptionReady", handler);
      await pipeline.processAudio(testAudioResult);
      expect(handler).toHaveBeenCalledTimes(1);

      pipeline.off("transcriptionReady", handler);
      await pipeline.processAudio(testAudioResult);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, handler was removed
    });
  });

  describe("reset", () => {
    it("removes all event listeners", async () => {
      mockTranscribe.mockResolvedValue(testSttResult);

      const pipeline = initializeSttPipeline();
      const handler = vi.fn();
      pipeline.on("transcriptionReady", handler);

      pipeline.reset();

      await pipeline.processAudio(testAudioResult);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
