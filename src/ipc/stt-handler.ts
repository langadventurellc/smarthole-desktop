/**
 * IPC handlers for STT (Speech-to-Text) communication.
 * Broadcasts STT pipeline events to renderer processes for UI feedback.
 */

import { BrowserWindow } from "electron";
import {
  IPC_CHANNELS,
  SttTranscribingPayload,
  TranscriptionReadyEvent,
  TranscriptionErrorEvent,
} from "../types";

// ============================================================================
// Broadcast Functions
// ============================================================================

/**
 * Broadcasts an STT transcribing event to all renderer windows.
 * Called when STT processing starts.
 *
 * @param payload - The transcribing payload with audio identifier
 */
export function broadcastSttTranscribing(payload: SttTranscribingPayload): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.STT_TRANSCRIBING, payload);
    }
  }
}

/**
 * Broadcasts an STT result event to all renderer windows.
 * Called when transcription completes successfully.
 *
 * @param result - The transcription result event
 */
export function broadcastSttResult(result: TranscriptionReadyEvent): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.STT_RESULT, result);
    }
  }
}

/**
 * Broadcasts an STT error event to all renderer windows.
 * Called when transcription fails.
 *
 * @param error - The transcription error event
 */
export function broadcastSttError(error: TranscriptionErrorEvent): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.STT_ERROR, error);
    }
  }
}
