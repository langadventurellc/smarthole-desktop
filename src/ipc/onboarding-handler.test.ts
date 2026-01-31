import { describe, it, expect, vi, beforeEach } from "vitest";
import { IpcMainEvent } from "electron";
import { createOnboardingCloseHandler, registerOnboardingHandlers } from "./onboarding-handler";
import { OnboardingWindowService } from "../windows/onboarding-window";
import { Logger } from "../services/logger";
import { IPC_CHANNELS } from "../types";

describe("onboarding-handler", () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger;

  const mockOnboarding = {
    show: vi.fn(),
    hide: vi.fn(),
    isVisible: vi.fn(),
    getWindow: vi.fn(),
  } as unknown as OnboardingWindowService;

  const mockEvent = {} as IpcMainEvent;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createOnboardingCloseHandler", () => {
    it("hides onboarding window when close is requested", () => {
      const handler = createOnboardingCloseHandler(() => mockOnboarding, mockLogger);

      handler(mockEvent);

      expect(mockOnboarding.hide).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("Onboarding close requested via IPC");
    });

    it("calls getter function to get onboarding service", () => {
      const getter = vi.fn(() => mockOnboarding);
      const handler = createOnboardingCloseHandler(getter, mockLogger);

      handler(mockEvent);

      expect(getter).toHaveBeenCalled();
    });
  });

  describe("registerOnboardingHandlers", () => {
    it("registers handler on ONBOARDING_CLOSE channel", () => {
      const mockIpcMain = {
        on: vi.fn(),
      } as unknown as Electron.IpcMain;

      registerOnboardingHandlers(mockIpcMain, () => mockOnboarding, mockLogger);

      expect(mockIpcMain.on).toHaveBeenCalledWith(
        IPC_CHANNELS.ONBOARDING_CLOSE,
        expect.any(Function)
      );
    });

    it("logs that handlers were registered", () => {
      const mockIpcMain = {
        on: vi.fn(),
      } as unknown as Electron.IpcMain;

      registerOnboardingHandlers(mockIpcMain, () => mockOnboarding, mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith("Onboarding IPC handlers registered");
    });

    it("registered handler hides onboarding when invoked", () => {
      let capturedHandler: ((event: IpcMainEvent) => void) | null = null;

      const mockIpcMain = {
        on: vi.fn((channel: string, handler: (event: IpcMainEvent) => void) => {
          if (channel === IPC_CHANNELS.ONBOARDING_CLOSE) {
            capturedHandler = handler;
          }
        }),
      } as unknown as Electron.IpcMain;

      registerOnboardingHandlers(mockIpcMain, () => mockOnboarding, mockLogger);

      expect(capturedHandler).not.toBeNull();
      capturedHandler!(mockEvent);

      expect(mockOnboarding.hide).toHaveBeenCalled();
    });
  });
});
