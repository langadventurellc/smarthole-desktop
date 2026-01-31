import { describe, it, expect, vi, beforeEach } from "vitest";
import { IpcMainEvent } from "electron";
import {
  createTextInputSubmitHandler,
  createTextInputDismissedHandler,
  createTextInputFocusedHandler,
  wireTextInputToHotkey,
} from "./text-input-handler";
import { TextInputPopupService } from "../windows/text-input-popup";
import { HotkeyManagerService, HotkeyActivatedEvent } from "../services/hotkey-manager";
import { Logger } from "../services/logger";

// Mock the getTextInputPopupImpl function
vi.mock("../windows/text-input-popup", async (importOriginal) => {
  const original = await importOriginal<typeof import("../windows/text-input-popup")>();
  return {
    ...original,
    getTextInputPopupImpl: vi.fn(() => ({
      emitSubmitted: vi.fn(),
    })),
  };
});

describe("text-input-handler", () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger;

  const mockPopup = {
    show: vi.fn(),
    hide: vi.fn(),
    isVisible: vi.fn(),
    getWindow: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as TextInputPopupService;

  const mockEvent = {} as IpcMainEvent;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTextInputSubmitHandler", () => {
    it("hides popup on valid submit", () => {
      const handler = createTextInputSubmitHandler(() => mockPopup, mockLogger);

      handler(mockEvent, {
        text: "hello world",
        timestamp: "2024-01-01T00:00:00Z",
      });

      expect(mockPopup.hide).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Text input submitted",
        expect.objectContaining({ textLength: 11 })
      );
    });

    it("warns on invalid payload - missing text", () => {
      const handler = createTextInputSubmitHandler(() => mockPopup, mockLogger);

      handler(mockEvent, { timestamp: "2024-01-01T00:00:00Z" });

      expect(mockPopup.hide).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invalid text input submit payload received",
        expect.any(Object)
      );
    });

    it("warns on invalid payload - missing timestamp", () => {
      const handler = createTextInputSubmitHandler(() => mockPopup, mockLogger);

      handler(mockEvent, { text: "hello" });

      expect(mockPopup.hide).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("warns on invalid payload - wrong types", () => {
      const handler = createTextInputSubmitHandler(() => mockPopup, mockLogger);

      handler(mockEvent, { text: 123, timestamp: true });

      expect(mockPopup.hide).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("warns on null payload", () => {
      const handler = createTextInputSubmitHandler(() => mockPopup, mockLogger);

      handler(mockEvent, null);

      expect(mockPopup.hide).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("createTextInputDismissedHandler", () => {
    it("hides popup on dismiss", () => {
      const handler = createTextInputDismissedHandler(() => mockPopup, mockLogger);

      handler(mockEvent);

      expect(mockPopup.hide).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("Text input dismissed");
    });
  });

  describe("createTextInputFocusedHandler", () => {
    it("logs focus event", () => {
      const handler = createTextInputFocusedHandler(mockLogger);

      handler(mockEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith("Text input popup focused");
    });
  });

  describe("wireTextInputToHotkey", () => {
    it("opens popup when textInput hotkey is activated", () => {
      let capturedListener: ((event: HotkeyActivatedEvent) => void) | null = null;

      const mockHotkeyManager = {
        on: vi.fn((event: string, listener: (event: HotkeyActivatedEvent) => void) => {
          if (event === "hotkey:activated") {
            capturedListener = listener;
          }
        }),
        off: vi.fn(),
      } as unknown as HotkeyManagerService;

      vi.mocked(mockPopup.isVisible).mockReturnValue(false);

      wireTextInputToHotkey(mockHotkeyManager, () => mockPopup, mockLogger);

      expect(mockHotkeyManager.on).toHaveBeenCalledWith("hotkey:activated", expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith("Text input popup wired to hotkey manager");

      // Simulate hotkey activation
      expect(capturedListener).not.toBeNull();
      capturedListener!({
        accelerator: "CommandOrControl+Shift+T",
        hotkeyType: "textInput",
      });

      expect(mockPopup.show).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Text input popup opened via hotkey",
        expect.objectContaining({ accelerator: "CommandOrControl+Shift+T" })
      );
    });

    it("focuses existing popup when already visible", () => {
      let capturedListener: ((event: HotkeyActivatedEvent) => void) | null = null;

      const mockWindow = { focus: vi.fn() };
      const mockHotkeyManager = {
        on: vi.fn((event: string, listener: (event: HotkeyActivatedEvent) => void) => {
          if (event === "hotkey:activated") {
            capturedListener = listener;
          }
        }),
        off: vi.fn(),
      } as unknown as HotkeyManagerService;

      vi.mocked(mockPopup.isVisible).mockReturnValue(true);
      vi.mocked(mockPopup.getWindow).mockReturnValue(
        mockWindow as unknown as Electron.BrowserWindow
      );

      wireTextInputToHotkey(mockHotkeyManager, () => mockPopup, mockLogger);

      capturedListener!({
        accelerator: "CommandOrControl+Shift+T",
        hotkeyType: "textInput",
      });

      expect(mockPopup.show).not.toHaveBeenCalled();
      expect(mockWindow.focus).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Text input popup already visible, focused",
        expect.objectContaining({ accelerator: "CommandOrControl+Shift+T" })
      );
    });

    it("ignores non-textInput hotkey activations", () => {
      let capturedListener: ((event: HotkeyActivatedEvent) => void) | null = null;

      const mockHotkeyManager = {
        on: vi.fn((event: string, listener: (event: HotkeyActivatedEvent) => void) => {
          if (event === "hotkey:activated") {
            capturedListener = listener;
          }
        }),
        off: vi.fn(),
      } as unknown as HotkeyManagerService;

      wireTextInputToHotkey(mockHotkeyManager, () => mockPopup, mockLogger);

      capturedListener!({
        accelerator: "CommandOrControl+Shift+Space",
        hotkeyType: "voiceInput",
      });

      expect(mockPopup.show).not.toHaveBeenCalled();
      expect(mockPopup.isVisible).not.toHaveBeenCalled();
    });
  });
});
