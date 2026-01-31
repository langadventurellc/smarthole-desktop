/**
 * IPC handlers for audio capture communication.
 * Bridges the AudioCaptureService to IPC channels for renderer communication.
 *
 * @see F-voice-recording-service feature specification
 */

import { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import {
  IPC_CHANNELS,
  AudioStartPayload,
  AudioStateChangedEvent,
  AudioPermissionChangedEvent,
  AudioPermissionStatus,
  AudioCapturePermission,
  isAudioCaptureResult,
} from "../types";
import { AudioCaptureService } from "../services/audio-capture";
import {
  HotkeyManagerService,
  HotkeyActivatedEvent,
  HotkeyReleasedEvent,
} from "../services/hotkey-manager";
import { Logger } from "../services/logger";

// ============================================================================
// Broadcast Functions
// ============================================================================

/**
 * Broadcasts an audio state changed event to all renderer windows.
 *
 * @param event - The audio state changed event
 */
export function broadcastAudioStateChanged(event: AudioStateChangedEvent): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.AUDIO_STATE_CHANGED, event);
    }
  }
}

/**
 * Broadcasts an audio permission changed event to all renderer windows.
 *
 * @param event - The audio permission changed event
 */
export function broadcastAudioPermissionChanged(event: AudioPermissionChangedEvent): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.AUDIO_PERMISSION_CHANGED, event);
    }
  }
}

/**
 * Sends an audio start signal to all renderer windows.
 * The renderer should begin capturing microphone audio when it receives this.
 *
 * @param payload - Optional audio start configuration
 */
export function broadcastAudioStart(payload?: AudioStartPayload): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.AUDIO_START, payload ?? {});
    }
  }
}

/**
 * Sends an audio stop signal to all renderer windows.
 * The renderer should stop capturing and send back the audio data.
 */
export function broadcastAudioStop(): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.AUDIO_STOP);
    }
  }
}

// ============================================================================
// IPC Handler Creators
// ============================================================================

/**
 * Creates an IPC handler for AUDIO_DATA channel.
 * Receives captured audio data from renderer and forwards to AudioCaptureService.
 *
 * @param getAudioCapture - Function to get the audio capture service
 * @param logger - Logger for debug output
 * @returns Handler function compatible with ipcMain.on()
 */
export function createAudioDataHandler(
  getAudioCapture: () => AudioCaptureService,
  logger: Logger
): (event: IpcMainEvent, payload: unknown) => void {
  return (_event: IpcMainEvent, payload: unknown): void => {
    // Validate payload structure
    if (typeof payload !== "object" || payload === null) {
      logger.warn("Invalid audio data payload received: not an object", { payload });
      return;
    }

    const dataPayload = payload as { result?: unknown };

    // Validate AudioCaptureResult
    if (!isAudioCaptureResult(dataPayload.result)) {
      logger.warn("Invalid audio data payload: invalid result structure", { payload });
      return;
    }

    const audioCapture = getAudioCapture();

    logger.info("Audio data received from renderer", {
      durationMs: dataPayload.result.audio.durationMs,
      format: dataPayload.result.audio.format,
    });

    // Forward to the service
    audioCapture.handleAudioData(dataPayload.result);
  };
}

/**
 * Creates an IPC handler for AUDIO_PERMISSION_GET channel.
 * Returns the current microphone permission status.
 *
 * @param getAudioCapture - Function to get the audio capture service
 * @param logger - Logger for debug output
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createAudioPermissionHandler(
  getAudioCapture: () => AudioCaptureService,
  logger: Logger
): (_event: IpcMainInvokeEvent) => Promise<AudioPermissionStatus> {
  return async (_event: IpcMainInvokeEvent): Promise<AudioPermissionStatus> => {
    try {
      const audioCapture = getAudioCapture();
      const status = await audioCapture.getPermissionStatus();

      logger.debug("Audio permission status requested", {
        permission: status.permission,
        canRequest: status.canRequest,
      });

      return status;
    } catch (error) {
      logger.error("Failed to get audio permission status", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return a default unknown status rather than throwing
      return {
        permission: AudioCapturePermission.UNKNOWN,
        canRequest: false,
      };
    }
  };
}

// ============================================================================
// Service Wiring Functions
// ============================================================================

/**
 * Wires up audio capture service events to IPC broadcasts.
 * Call this after initializing the audio capture service to enable IPC broadcasting.
 *
 * @param audioCapture - The initialized audio capture service
 * @param logger - Logger for debug output
 */
export function wireAudioCaptureToIpc(audioCapture: AudioCaptureService, logger: Logger): void {
  audioCapture.on("stateChanged", (event) => {
    logger.debug("Broadcasting audio:stateChanged to renderer", {
      previousState: event.previousState,
      newState: event.newState,
    });
    broadcastAudioStateChanged(event);
  });

  audioCapture.on("permissionChanged", (event) => {
    logger.debug("Broadcasting audio:permissionChanged to renderer", {
      previousPermission: event.previousPermission,
      newPermission: event.newPermission,
    });
    broadcastAudioPermissionChanged(event);
  });

  audioCapture.on("error", (event) => {
    logger.warn("Audio capture error", {
      message: event.message,
      code: event.code,
    });
  });

  logger.info("Audio capture service wired to IPC");
}

/**
 * Wires the audio capture service to the hotkey manager for voice input.
 * Handles push-to-talk and toggle modes based on service configuration.
 *
 * @param hotkeyManager - The hotkey manager service
 * @param getAudioCapture - Function to get the audio capture service
 * @param logger - Logger for debug output
 */
export function wireAudioCaptureToHotkey(
  hotkeyManager: HotkeyManagerService,
  getAudioCapture: () => AudioCaptureService,
  logger: Logger
): void {
  hotkeyManager.on("hotkey:activated", async (event: HotkeyActivatedEvent) => {
    if (event.hotkeyType !== "voiceInput") {
      return;
    }

    const audioCapture = getAudioCapture();
    const mode = audioCapture.getMode();

    if (mode === "push-to-talk") {
      // Push-to-talk: Start recording on activation
      const started = await audioCapture.startRecording();
      if (started) {
        logger.debug("Push-to-talk: Started recording via hotkey", {
          accelerator: event.accelerator,
        });
        broadcastAudioStart();
      }
    } else {
      // Toggle mode: Toggle recording state
      if (audioCapture.isRecording()) {
        await audioCapture.stopRecording();
        logger.debug("Toggle mode: Stopped recording via hotkey", {
          accelerator: event.accelerator,
        });
        broadcastAudioStop();
      } else {
        const started = await audioCapture.startRecording();
        if (started) {
          logger.debug("Toggle mode: Started recording via hotkey", {
            accelerator: event.accelerator,
          });
          broadcastAudioStart();
        }
      }
    }
  });

  hotkeyManager.on("hotkey:released", async (event: HotkeyReleasedEvent) => {
    if (event.hotkeyType !== "voiceInput") {
      return;
    }

    const audioCapture = getAudioCapture();
    const mode = audioCapture.getMode();

    // Push-to-talk: Stop recording on release
    if (mode === "push-to-talk" && audioCapture.isRecording()) {
      await audioCapture.stopRecording();
      logger.debug("Push-to-talk: Stopped recording via hotkey release", {
        accelerator: event.accelerator,
      });
      broadcastAudioStop();
    }
  });

  logger.info("Audio capture wired to hotkey manager");
}

/**
 * Registers all audio-related IPC handlers with ipcMain.
 * Call this after initializing the audio capture service.
 *
 * @param ipcMain - The Electron ipcMain module
 * @param getAudioCapture - Function to get the audio capture service
 * @param logger - Logger for debug output
 */
export function registerAudioHandlers(
  ipcMain: Electron.IpcMain,
  getAudioCapture: () => AudioCaptureService,
  logger: Logger
): void {
  // Register handler for receiving audio data from renderer
  ipcMain.on(IPC_CHANNELS.AUDIO_DATA, createAudioDataHandler(getAudioCapture, logger));

  // Register handler for permission status queries
  ipcMain.handle(
    IPC_CHANNELS.AUDIO_PERMISSION_GET,
    createAudioPermissionHandler(getAudioCapture, logger)
  );

  logger.info("Audio IPC handlers registered");
}
