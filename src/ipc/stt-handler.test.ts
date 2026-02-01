import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserWindow } from "electron";
import { broadcastSttTranscribing, broadcastSttResult, broadcastSttError } from "./stt-handler";
import { SttTranscribingPayload, TranscriptionReadyEvent, TranscriptionErrorEvent } from "../types";

// Mock BrowserWindow
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
}));

describe("stt-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("broadcastSttTranscribing", () => {
    it("broadcasts to all windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      const payload: SttTranscribingPayload = {
        audioId: "2024-01-01T00:00:00Z",
      };

      broadcastSttTranscribing(payload);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith("stt:transcribing", payload);
    });

    it("broadcasts to multiple windows", () => {
      const mockWindow1 = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      const mockWindow2 = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow1 as unknown as BrowserWindow,
        mockWindow2 as unknown as BrowserWindow,
      ]);

      const payload: SttTranscribingPayload = {
        audioId: "2024-01-01T00:00:00Z",
      };

      broadcastSttTranscribing(payload);

      expect(mockWindow1.webContents.send).toHaveBeenCalledWith("stt:transcribing", payload);
      expect(mockWindow2.webContents.send).toHaveBeenCalledWith("stt:transcribing", payload);
    });

    it("skips destroyed windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      broadcastSttTranscribing({ audioId: "2024-01-01T00:00:00Z" });

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe("broadcastSttResult", () => {
    it("broadcasts to all windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      const result: TranscriptionReadyEvent = {
        text: "Hello world",
        inputMethod: "voice",
        audioMetadata: {
          durationMs: 1000,
          startedAt: "2024-01-01T00:00:00Z",
          stoppedAt: "2024-01-01T00:00:01Z",
        },
        sttMetadata: {
          backendUsed: "cloud",
          processingTimeMs: 500,
        },
      };

      broadcastSttResult(result);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith("stt:result", result);
    });

    it("broadcasts to multiple windows", () => {
      const mockWindow1 = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      const mockWindow2 = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow1 as unknown as BrowserWindow,
        mockWindow2 as unknown as BrowserWindow,
      ]);

      const result: TranscriptionReadyEvent = {
        text: "Hello world",
        confidence: 0.95,
        inputMethod: "voice",
        audioMetadata: {
          durationMs: 1000,
          startedAt: "2024-01-01T00:00:00Z",
          stoppedAt: "2024-01-01T00:00:01Z",
        },
        sttMetadata: {
          backendUsed: "cloud",
          processingTimeMs: 500,
        },
      };

      broadcastSttResult(result);

      expect(mockWindow1.webContents.send).toHaveBeenCalledWith("stt:result", result);
      expect(mockWindow2.webContents.send).toHaveBeenCalledWith("stt:result", result);
    });

    it("skips destroyed windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      const result: TranscriptionReadyEvent = {
        text: "Hello world",
        inputMethod: "voice",
        audioMetadata: {
          durationMs: 1000,
          startedAt: "2024-01-01T00:00:00Z",
          stoppedAt: "2024-01-01T00:00:01Z",
        },
        sttMetadata: {
          backendUsed: "cloud",
          processingTimeMs: 500,
        },
      };

      broadcastSttResult(result);

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe("broadcastSttError", () => {
    it("broadcasts to all windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      const error: TranscriptionErrorEvent = {
        code: "NETWORK_ERROR",
        message: "Could not reach transcription service",
      };

      broadcastSttError(error);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith("stt:error", error);
    });

    it("broadcasts to multiple windows", () => {
      const mockWindow1 = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      const mockWindow2 = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow1 as unknown as BrowserWindow,
        mockWindow2 as unknown as BrowserWindow,
      ]);

      const error: TranscriptionErrorEvent = {
        code: "NO_API_KEY",
        message: "API key not configured",
      };

      broadcastSttError(error);

      expect(mockWindow1.webContents.send).toHaveBeenCalledWith("stt:error", error);
      expect(mockWindow2.webContents.send).toHaveBeenCalledWith("stt:error", error);
    });

    it("skips destroyed windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      const error: TranscriptionErrorEvent = {
        code: "TRANSCRIPTION_FAILED",
        message: "An error occurred",
        cause: new Error("Test error"),
      };

      broadcastSttError(error);

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it("includes cause when present", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      const cause = new Error("Original error");
      const error: TranscriptionErrorEvent = {
        code: "RATE_LIMIT",
        message: "Too many requests",
        cause,
      };

      broadcastSttError(error);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith("stt:error", error);
    });
  });
});
