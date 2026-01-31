import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import {
  createAudioDataHandler,
  createAudioPermissionHandler,
  broadcastAudioStateChanged,
  broadcastAudioPermissionChanged,
  broadcastAudioStart,
  broadcastAudioStop,
  wireAudioCaptureToIpc,
  wireAudioCaptureToHotkey,
} from "./audio-handler";
import { AudioCaptureService } from "../services/audio-capture";
import {
  HotkeyManagerService,
  HotkeyActivatedEvent,
  HotkeyReleasedEvent,
} from "../services/hotkey-manager";
import { Logger } from "../services/logger";
import {
  AudioCaptureState,
  AudioCapturePermission,
  AudioStateChangedEvent,
  AudioPermissionChangedEvent,
  AudioCaptureResult,
} from "../types";

// Mock BrowserWindow
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
}));

describe("audio-handler", () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger;

  const mockAudioCapture = {
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    isRecording: vi.fn(),
    getState: vi.fn(),
    getPermissionStatus: vi.fn(),
    getMode: vi.fn(),
    setMode: vi.fn(),
    handleAudioData: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    reset: vi.fn(),
  } as unknown as AudioCaptureService;

  const mockEvent = {} as IpcMainEvent;
  const mockInvokeEvent = {} as IpcMainInvokeEvent;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("broadcastAudioStateChanged", () => {
    it("broadcasts to all windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      const event: AudioStateChangedEvent = {
        previousState: AudioCaptureState.IDLE,
        newState: AudioCaptureState.RECORDING,
        timestamp: Date.now(),
      };

      broadcastAudioStateChanged(event);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith("audio:stateChanged", event);
    });

    it("skips destroyed windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      broadcastAudioStateChanged({
        previousState: AudioCaptureState.IDLE,
        newState: AudioCaptureState.RECORDING,
        timestamp: Date.now(),
      });

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe("broadcastAudioPermissionChanged", () => {
    it("broadcasts permission changes to all windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      const event: AudioPermissionChangedEvent = {
        previousPermission: AudioCapturePermission.PROMPT,
        newPermission: AudioCapturePermission.GRANTED,
      };

      broadcastAudioPermissionChanged(event);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith("audio:permission:changed", event);
    });
  });

  describe("broadcastAudioStart", () => {
    it("broadcasts start signal to all windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      broadcastAudioStart();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith("audio:start", {});
    });

    it("includes payload when provided", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      broadcastAudioStart({ config: { sampleRate: 16000 } });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith("audio:start", {
        config: { sampleRate: 16000 },
      });
    });
  });

  describe("broadcastAudioStop", () => {
    it("broadcasts stop signal to all windows", () => {
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow as unknown as BrowserWindow,
      ]);

      broadcastAudioStop();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith("audio:stop");
    });
  });

  describe("createAudioDataHandler", () => {
    it("forwards valid audio data to service", () => {
      const handler = createAudioDataHandler(() => mockAudioCapture, mockLogger);

      const validResult: AudioCaptureResult = {
        audio: {
          data: new ArrayBuffer(100),
          format: "wav",
          sampleRate: 16000,
          channels: 1,
          durationMs: 1000,
        },
        startedAt: "2024-01-01T00:00:00Z",
        stoppedAt: "2024-01-01T00:00:01Z",
      };

      handler(mockEvent, { result: validResult });

      expect(mockAudioCapture.handleAudioData).toHaveBeenCalledWith(validResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Audio data received from renderer",
        expect.objectContaining({ durationMs: 1000, format: "wav" })
      );
    });

    it("warns on non-object payload", () => {
      const handler = createAudioDataHandler(() => mockAudioCapture, mockLogger);

      handler(mockEvent, "not an object");

      expect(mockAudioCapture.handleAudioData).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invalid audio data payload received: not an object",
        expect.any(Object)
      );
    });

    it("warns on null payload", () => {
      const handler = createAudioDataHandler(() => mockAudioCapture, mockLogger);

      handler(mockEvent, null);

      expect(mockAudioCapture.handleAudioData).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("warns on invalid result structure", () => {
      const handler = createAudioDataHandler(() => mockAudioCapture, mockLogger);

      handler(mockEvent, { result: { invalid: true } });

      expect(mockAudioCapture.handleAudioData).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invalid audio data payload: invalid result structure",
        expect.any(Object)
      );
    });
  });

  describe("createAudioPermissionHandler", () => {
    it("returns permission status from service", async () => {
      vi.mocked(mockAudioCapture.getPermissionStatus).mockResolvedValue({
        permission: AudioCapturePermission.GRANTED,
        canRequest: false,
      });

      const handler = createAudioPermissionHandler(() => mockAudioCapture, mockLogger);
      const result = await handler(mockInvokeEvent);

      expect(result).toEqual({
        permission: AudioCapturePermission.GRANTED,
        canRequest: false,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Audio permission status requested",
        expect.objectContaining({ permission: "granted" })
      );
    });

    it("returns unknown status on error", async () => {
      vi.mocked(mockAudioCapture.getPermissionStatus).mockRejectedValue(new Error("test error"));

      const handler = createAudioPermissionHandler(() => mockAudioCapture, mockLogger);
      const result = await handler(mockInvokeEvent);

      expect(result).toEqual({
        permission: "unknown",
        canRequest: false,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to get audio permission status",
        expect.any(Object)
      );
    });
  });

  describe("wireAudioCaptureToIpc", () => {
    it("subscribes to service events", () => {
      wireAudioCaptureToIpc(mockAudioCapture, mockLogger);

      expect(mockAudioCapture.on).toHaveBeenCalledWith("stateChanged", expect.any(Function));
      expect(mockAudioCapture.on).toHaveBeenCalledWith("permissionChanged", expect.any(Function));
      expect(mockAudioCapture.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith("Audio capture service wired to IPC");
    });
  });

  describe("wireAudioCaptureToHotkey", () => {
    it("subscribes to hotkey events", () => {
      const mockHotkeyManager = {
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as HotkeyManagerService;

      wireAudioCaptureToHotkey(mockHotkeyManager, () => mockAudioCapture, mockLogger);

      expect(mockHotkeyManager.on).toHaveBeenCalledWith("hotkey:activated", expect.any(Function));
      expect(mockHotkeyManager.on).toHaveBeenCalledWith("hotkey:released", expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith("Audio capture wired to hotkey manager");
    });

    describe("push-to-talk mode", () => {
      it("starts recording on voiceInput activation", async () => {
        let activatedListener: ((event: HotkeyActivatedEvent) => void) | null = null;
        const mockHotkeyManager = {
          on: vi.fn(
            (
              event: string,
              listener: (event: HotkeyActivatedEvent | HotkeyReleasedEvent) => void
            ) => {
              if (event === "hotkey:activated") {
                activatedListener = listener as (event: HotkeyActivatedEvent) => void;
              }
            }
          ),
          off: vi.fn(),
        } as unknown as HotkeyManagerService;

        vi.mocked(mockAudioCapture.getMode).mockReturnValue("push-to-talk");
        vi.mocked(mockAudioCapture.startRecording).mockResolvedValue(true);

        const mockWindow = {
          isDestroyed: vi.fn().mockReturnValue(false),
          webContents: { send: vi.fn() },
        };
        vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
          mockWindow as unknown as BrowserWindow,
        ]);

        wireAudioCaptureToHotkey(mockHotkeyManager, () => mockAudioCapture, mockLogger);

        expect(activatedListener).not.toBeNull();
        await activatedListener!({
          accelerator: "CommandOrControl+Shift+Space",
          hotkeyType: "voiceInput",
        });

        expect(mockAudioCapture.startRecording).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith("audio:start", {});
      });

      it("stops recording on voiceInput release", async () => {
        let releasedListener: ((event: HotkeyReleasedEvent) => void) | null = null;
        const mockHotkeyManager = {
          on: vi.fn(
            (
              event: string,
              listener: (event: HotkeyActivatedEvent | HotkeyReleasedEvent) => void
            ) => {
              if (event === "hotkey:released") {
                releasedListener = listener as (event: HotkeyReleasedEvent) => void;
              }
            }
          ),
          off: vi.fn(),
        } as unknown as HotkeyManagerService;

        vi.mocked(mockAudioCapture.getMode).mockReturnValue("push-to-talk");
        vi.mocked(mockAudioCapture.isRecording).mockReturnValue(true);
        vi.mocked(mockAudioCapture.stopRecording).mockResolvedValue(undefined);

        const mockWindow = {
          isDestroyed: vi.fn().mockReturnValue(false),
          webContents: { send: vi.fn() },
        };
        vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
          mockWindow as unknown as BrowserWindow,
        ]);

        wireAudioCaptureToHotkey(mockHotkeyManager, () => mockAudioCapture, mockLogger);

        expect(releasedListener).not.toBeNull();
        await releasedListener!({
          accelerator: "CommandOrControl+Shift+Space",
          hotkeyType: "voiceInput",
        });

        expect(mockAudioCapture.stopRecording).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith("audio:stop");
      });
    });

    describe("toggle mode", () => {
      it("starts recording on first activation when not recording", async () => {
        let activatedListener: ((event: HotkeyActivatedEvent) => void) | null = null;
        const mockHotkeyManager = {
          on: vi.fn(
            (
              event: string,
              listener: (event: HotkeyActivatedEvent | HotkeyReleasedEvent) => void
            ) => {
              if (event === "hotkey:activated") {
                activatedListener = listener as (event: HotkeyActivatedEvent) => void;
              }
            }
          ),
          off: vi.fn(),
        } as unknown as HotkeyManagerService;

        vi.mocked(mockAudioCapture.getMode).mockReturnValue("toggle");
        vi.mocked(mockAudioCapture.isRecording).mockReturnValue(false);
        vi.mocked(mockAudioCapture.startRecording).mockResolvedValue(true);

        const mockWindow = {
          isDestroyed: vi.fn().mockReturnValue(false),
          webContents: { send: vi.fn() },
        };
        vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
          mockWindow as unknown as BrowserWindow,
        ]);

        wireAudioCaptureToHotkey(mockHotkeyManager, () => mockAudioCapture, mockLogger);

        await activatedListener!({
          accelerator: "CommandOrControl+Shift+Space",
          hotkeyType: "voiceInput",
        });

        expect(mockAudioCapture.startRecording).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith("audio:start", {});
      });

      it("stops recording on activation when already recording", async () => {
        let activatedListener: ((event: HotkeyActivatedEvent) => void) | null = null;
        const mockHotkeyManager = {
          on: vi.fn(
            (
              event: string,
              listener: (event: HotkeyActivatedEvent | HotkeyReleasedEvent) => void
            ) => {
              if (event === "hotkey:activated") {
                activatedListener = listener as (event: HotkeyActivatedEvent) => void;
              }
            }
          ),
          off: vi.fn(),
        } as unknown as HotkeyManagerService;

        vi.mocked(mockAudioCapture.getMode).mockReturnValue("toggle");
        vi.mocked(mockAudioCapture.isRecording).mockReturnValue(true);
        vi.mocked(mockAudioCapture.stopRecording).mockResolvedValue(undefined);

        const mockWindow = {
          isDestroyed: vi.fn().mockReturnValue(false),
          webContents: { send: vi.fn() },
        };
        vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
          mockWindow as unknown as BrowserWindow,
        ]);

        wireAudioCaptureToHotkey(mockHotkeyManager, () => mockAudioCapture, mockLogger);

        await activatedListener!({
          accelerator: "CommandOrControl+Shift+Space",
          hotkeyType: "voiceInput",
        });

        expect(mockAudioCapture.stopRecording).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith("audio:stop");
      });

      it("does not stop on release in toggle mode", async () => {
        let releasedListener: ((event: HotkeyReleasedEvent) => void) | null = null;
        const mockHotkeyManager = {
          on: vi.fn(
            (
              event: string,
              listener: (event: HotkeyActivatedEvent | HotkeyReleasedEvent) => void
            ) => {
              if (event === "hotkey:released") {
                releasedListener = listener as (event: HotkeyReleasedEvent) => void;
              }
            }
          ),
          off: vi.fn(),
        } as unknown as HotkeyManagerService;

        vi.mocked(mockAudioCapture.getMode).mockReturnValue("toggle");
        vi.mocked(mockAudioCapture.isRecording).mockReturnValue(true);

        wireAudioCaptureToHotkey(mockHotkeyManager, () => mockAudioCapture, mockLogger);

        await releasedListener!({
          accelerator: "CommandOrControl+Shift+Space",
          hotkeyType: "voiceInput",
        });

        expect(mockAudioCapture.stopRecording).not.toHaveBeenCalled();
      });
    });

    it("ignores non-voiceInput hotkeys", async () => {
      let activatedListener: ((event: HotkeyActivatedEvent) => void) | null = null;
      const mockHotkeyManager = {
        on: vi.fn(
          (
            event: string,
            listener: (event: HotkeyActivatedEvent | HotkeyReleasedEvent) => void
          ) => {
            if (event === "hotkey:activated") {
              activatedListener = listener as (event: HotkeyActivatedEvent) => void;
            }
          }
        ),
        off: vi.fn(),
      } as unknown as HotkeyManagerService;

      wireAudioCaptureToHotkey(mockHotkeyManager, () => mockAudioCapture, mockLogger);

      await activatedListener!({
        accelerator: "CommandOrControl+Shift+T",
        hotkeyType: "textInput",
      });

      expect(mockAudioCapture.startRecording).not.toHaveBeenCalled();
      expect(mockAudioCapture.stopRecording).not.toHaveBeenCalled();
    });
  });
});
