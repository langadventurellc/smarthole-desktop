import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GroqSttBackend, GroqSttError } from "./groq-backend";
import { initializeLogger, resetLogger } from "../logger";
import { initializeCredentialManager, resetCredentialManager } from "../credential-manager";
import { LogLevel } from "../../types";
import { ErrorCode } from "../../types/errors";
import type { AudioBuffer } from "../../types/audio";

// Mock keytar module
vi.mock("keytar", () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

// Create mock function at module level for the transcription API
const mockTranscriptionCreate = vi.fn();

// Mock the groq-sdk module with a class constructor
vi.mock("groq-sdk", () => {
  // Create a class that vitest can recognize as a constructor
  const MockGroq = class {
    audio = {
      transcriptions: {
        create: mockTranscriptionCreate,
      },
    };
    constructor(_options: unknown) {
      // Store constructor calls for assertions
      MockGroq.constructorCalls.push(_options);
    }
    static constructorCalls: unknown[] = [];
    static reset() {
      MockGroq.constructorCalls = [];
    }
  };

  return { default: MockGroq };
});

import Groq from "groq-sdk";
import keytar from "keytar";

const mockedKeytar = vi.mocked(keytar);
const MockedGroq = Groq as unknown as {
  constructorCalls: unknown[];
  reset: () => void;
};

describe("GroqSttBackend", () => {
  let backend: GroqSttBackend;
  const testAudioBuffer: AudioBuffer = {
    data: new ArrayBuffer(1024),
    format: "wav",
    sampleRate: 16000,
    channels: 1,
    durationMs: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTranscriptionCreate.mockReset();
    MockedGroq.reset();
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    initializeCredentialManager();
    backend = new GroqSttBackend();
  });

  afterEach(() => {
    resetCredentialManager();
    resetLogger();
  });

  describe("name property", () => {
    it("returns 'cloud' as the backend type", () => {
      expect(backend.name).toBe("cloud");
    });
  });

  describe("isAvailable", () => {
    it("returns true when stt-api-key credential exists", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");

      const result = await backend.isAvailable();

      expect(result).toBe(true);
      expect(mockedKeytar.getPassword).toHaveBeenCalledWith("SmartHole", "stt-api-key");
    });

    it("returns false when stt-api-key credential does not exist", async () => {
      mockedKeytar.getPassword.mockResolvedValue(null);

      const result = await backend.isAvailable();

      expect(result).toBe(false);
    });

    it("returns false when credential manager throws an error", async () => {
      mockedKeytar.getPassword.mockRejectedValue(new Error("Keychain locked"));

      const result = await backend.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe("transcribe", () => {
    it("successfully transcribes audio and returns SttResult", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");
      mockTranscriptionCreate.mockResolvedValue({ text: "Hello, world!" });

      const result = await backend.transcribe(testAudioBuffer);

      expect(result).toEqual({
        text: "Hello, world!",
        durationMs: testAudioBuffer.durationMs,
        backendUsed: "cloud",
      });
    });

    it("uses whisper-large-v3 model", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");
      mockTranscriptionCreate.mockResolvedValue({ text: "Test" });

      await backend.transcribe(testAudioBuffer);

      expect(mockTranscriptionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "whisper-large-v3",
        })
      );
    });

    it("converts audio buffer to File with correct mime type for wav", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");
      mockTranscriptionCreate.mockResolvedValue({ text: "Test" });

      await backend.transcribe(testAudioBuffer);

      expect(mockTranscriptionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.any(File),
        })
      );

      const call = mockTranscriptionCreate.mock.calls[0][0];
      expect(call.file.type).toBe("audio/wav");
      expect(call.file.name).toBe("audio.wav");
    });

    it("converts audio buffer to File with correct mime type for pcm", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");
      mockTranscriptionCreate.mockResolvedValue({ text: "Test" });

      const pcmBuffer: AudioBuffer = {
        ...testAudioBuffer,
        format: "pcm",
      };

      await backend.transcribe(pcmBuffer);

      const call = mockTranscriptionCreate.mock.calls[0][0];
      expect(call.file.type).toBe("audio/pcm");
      expect(call.file.name).toBe("audio.raw");
    });

    it("initializes Groq client with API key from credential manager", async () => {
      mockedKeytar.getPassword.mockResolvedValue("my-secret-api-key");
      mockTranscriptionCreate.mockResolvedValue({ text: "Test" });

      await backend.transcribe(testAudioBuffer);

      expect(MockedGroq.constructorCalls).toHaveLength(1);
      expect(MockedGroq.constructorCalls[0]).toEqual({
        apiKey: "my-secret-api-key",
        timeout: 30000,
      });
    });

    it("reuses existing Groq client on subsequent calls", async () => {
      mockedKeytar.getPassword.mockResolvedValue("test-api-key");
      mockTranscriptionCreate.mockResolvedValue({ text: "Test" });

      await backend.transcribe(testAudioBuffer);
      await backend.transcribe(testAudioBuffer);

      // Groq constructor should only be called once
      expect(MockedGroq.constructorCalls).toHaveLength(1);
    });

    describe("error handling", () => {
      it("throws STT_INITIALIZATION_FAILED when API key is not found", async () => {
        mockedKeytar.getPassword.mockResolvedValue(null);

        const error = await backend.transcribe(testAudioBuffer).catch((e) => e);
        expect(error).toBeInstanceOf(GroqSttError);
        expect(error.code).toBe(ErrorCode.STT_INITIALIZATION_FAILED);
        expect(error.message).toContain("STT API key not found");
      });

      it("throws STT_INITIALIZATION_FAILED on 401 authentication error", async () => {
        mockedKeytar.getPassword.mockResolvedValue("invalid-key");
        mockTranscriptionCreate.mockRejectedValue(new Error("401 Unauthorized - Invalid API key"));

        const error = await backend.transcribe(testAudioBuffer).catch((e) => e);
        expect(error).toBeInstanceOf(GroqSttError);
        expect(error.code).toBe(ErrorCode.STT_INITIALIZATION_FAILED);
        expect(error.message).toContain("Authentication failed");
      });

      it("throws STT_TRANSCRIPTION_FAILED on 429 rate limit error", async () => {
        mockedKeytar.getPassword.mockResolvedValue("test-api-key");
        mockTranscriptionCreate.mockRejectedValue(new Error("429 Rate limit exceeded"));

        const error = await backend.transcribe(testAudioBuffer).catch((e) => e);
        expect(error).toBeInstanceOf(GroqSttError);
        expect(error.code).toBe(ErrorCode.STT_TRANSCRIPTION_FAILED);
        expect(error.message).toContain("Rate limit exceeded");
      });

      it("throws STT_TRANSCRIPTION_FAILED on network error", async () => {
        mockedKeytar.getPassword.mockResolvedValue("test-api-key");
        mockTranscriptionCreate.mockRejectedValue(new Error("Network error: ECONNREFUSED"));

        const error = await backend.transcribe(testAudioBuffer).catch((e) => e);
        expect(error).toBeInstanceOf(GroqSttError);
        expect(error.code).toBe(ErrorCode.STT_TRANSCRIPTION_FAILED);
        expect(error.message).toContain("Network error");
      });

      it("throws STT_TRANSCRIPTION_FAILED on timeout", async () => {
        mockedKeytar.getPassword.mockResolvedValue("test-api-key");
        mockTranscriptionCreate.mockRejectedValue(new Error("Request timed out"));

        const error = await backend.transcribe(testAudioBuffer).catch((e) => e);
        expect(error).toBeInstanceOf(GroqSttError);
        expect(error.code).toBe(ErrorCode.STT_TRANSCRIPTION_FAILED);
        expect(error.message).toContain("timed out");
      });

      it("throws STT_TRANSCRIPTION_FAILED on unknown API error", async () => {
        mockedKeytar.getPassword.mockResolvedValue("test-api-key");
        mockTranscriptionCreate.mockRejectedValue(new Error("Unknown API error"));

        const error = await backend.transcribe(testAudioBuffer).catch((e) => e);
        expect(error).toBeInstanceOf(GroqSttError);
        expect(error.code).toBe(ErrorCode.STT_TRANSCRIPTION_FAILED);
        expect(error.message).toContain("Transcription failed");
      });
    });
  });

  describe("GroqSttError", () => {
    it("includes error code and cause", () => {
      const cause = new Error("Original error");
      const error = new GroqSttError(
        "Test error message",
        ErrorCode.STT_TRANSCRIPTION_FAILED,
        cause
      );

      expect(error.name).toBe("GroqSttError");
      expect(error.message).toBe("Test error message");
      expect(error.code).toBe(ErrorCode.STT_TRANSCRIPTION_FAILED);
      expect(error.cause).toBe(cause);
    });

    it("works without cause", () => {
      const error = new GroqSttError("Test error", ErrorCode.STT_INITIALIZATION_FAILED);

      expect(error.cause).toBeUndefined();
    });
  });
});
