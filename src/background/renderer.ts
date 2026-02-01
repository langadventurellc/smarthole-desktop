/**
 * Background window renderer for audio capture.
 * Listens for audio start/stop IPC events and handles recording via Web Audio API.
 *
 * This runs in a hidden BrowserWindow that stays alive while the app is running,
 * providing a renderer context for Web Audio API-based audio capture.
 */

import { startRecording, stopRecording, isRecording } from "../audio";

// Wire IPC events to audio capture
window.electronAPI.onAudioStart(async () => {
  try {
    await startRecording();
    window.electronAPI.logDebug("Background: Started recording");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.electronAPI.logError("Background: Failed to start recording", { error: message });
    // Notify user of error
    window.electronAPI.notify({
      title: "Recording Failed",
      body: message,
      type: "error",
    });
  }
});

window.electronAPI.onAudioStop(async () => {
  if (!isRecording()) {
    window.electronAPI.logDebug("Background: Stop received but not recording, ignoring");
    return;
  }

  try {
    const result = await stopRecording();
    window.electronAPI.sendAudioData(result);
    window.electronAPI.logDebug("Background: Sent audio data", {
      durationMs: result.audio.durationMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.electronAPI.logError("Background: Failed to stop recording", { error: message });
    window.electronAPI.notify({
      title: "Recording Error",
      body: message,
      type: "error",
    });
  }
});

// Log that the background window has loaded successfully
window.electronAPI.logInfo("Background window renderer loaded and ready for audio capture");
