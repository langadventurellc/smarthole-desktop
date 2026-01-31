/**
 * Renderer-side modules barrel export.
 *
 * This directory contains modules that run in the Electron renderer context
 * and provide functionality using browser/Web APIs (MediaRecorder, Web Audio, etc.).
 *
 * These modules are imported by renderer entry points or components and must
 * execute in the renderer process context.
 *
 * @example
 * ```ts
 * import { startRecording, stopRecording } from '../renderer';
 * ```
 */

// Audio capture module
export {
  startRecording,
  stopRecording,
  cancelRecording,
  isRecording,
  getPermissionStatus,
  isSupported,
  setConfig,
  getConfig,
  reset,
  AudioCaptureError,
  // WAV encoding utilities (exported for testing)
  writeString,
  encodeWav,
  resampleAudio,
  convertToMono,
} from "./audio-capture";
