/**
 * Renderer-side audio capture module using Web Audio API.
 * Captures microphone audio and converts it to WAV format suitable for Whisper STT.
 *
 * @see F-voice-recording-service feature specification
 */

import {
  AudioCapturePermission,
  AudioCaptureResult,
  AudioCaptureConfig,
  DEFAULT_AUDIO_CAPTURE_CONFIG,
  AudioBuffer as AppAudioBuffer,
  AudioErrorCode,
} from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Error thrown during audio capture operations.
 */
export class AudioCaptureError extends Error {
  constructor(
    message: string,
    public readonly code: AudioErrorCode
  ) {
    super(message);
    this.name = "AudioCaptureError";
  }
}

/**
 * Internal state for tracking recording session.
 */
interface RecordingSession {
  /** MediaRecorder instance */
  mediaRecorder: MediaRecorder;
  /** MediaStream from getUserMedia */
  stream: MediaStream;
  /** Collected audio chunks */
  chunks: Blob[];
  /** ISO timestamp when recording started */
  startedAt: string;
  /** AudioContext for processing */
  audioContext: AudioContext;
}

// ============================================================================
// WAV Encoding Utilities
// ============================================================================

/**
 * Writes a string to a DataView at the specified offset.
 *
 * @param view - DataView to write to
 * @param offset - Byte offset to start writing
 * @param str - String to write (ASCII only)
 */
export function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Encodes raw PCM audio samples to WAV format.
 *
 * @param samples - Float32Array of audio samples (-1 to 1 range)
 * @param sampleRate - Sample rate in Hz
 * @param numChannels - Number of audio channels
 * @returns ArrayBuffer containing WAV file data
 */
export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
  numChannels: number
): ArrayBuffer {
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true); // File size - 8
  writeString(view, 8, "WAVE");

  // fmt subchunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1 size (16 for PCM)
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write audio samples as 16-bit PCM
  const offset = headerSize;
  for (let i = 0; i < samples.length; i++) {
    // Clamp sample to [-1, 1] range and convert to 16-bit signed integer
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const int16Sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset + i * bytesPerSample, int16Sample, true);
  }

  return buffer;
}

/**
 * Resamples audio data from source sample rate to target sample rate.
 * Uses linear interpolation for simplicity and efficiency.
 *
 * @param samples - Input audio samples
 * @param sourceSampleRate - Original sample rate
 * @param targetSampleRate - Desired sample rate
 * @returns Resampled audio samples
 */
export function resampleAudio(
  samples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return samples;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    // Linear interpolation between adjacent samples
    result[i] = samples[srcIndexFloor] * (1 - fraction) + samples[srcIndexCeil] * fraction;
  }

  return result;
}

/**
 * Converts stereo audio to mono by averaging channels.
 *
 * @param audioBuffer - AudioBuffer with potentially multiple channels
 * @returns Float32Array of mono samples
 */
export function convertToMono(audioBuffer: globalThis.AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  const numChannels = audioBuffer.numberOfChannels;

  // Average all channels
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i];
    }
  }

  // Divide by number of channels to get average
  for (let i = 0; i < length; i++) {
    mono[i] /= numChannels;
  }

  return mono;
}

// ============================================================================
// Audio Capture Implementation
// ============================================================================

/** Current recording session, null when not recording */
let currentSession: RecordingSession | null = null;

/** Configuration for audio capture */
let config: AudioCaptureConfig = { ...DEFAULT_AUDIO_CAPTURE_CONFIG };

/**
 * Checks if the browser supports required audio APIs.
 *
 * @returns true if all required APIs are available
 */
export function isSupported(): boolean {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    typeof AudioContext !== "undefined"
  );
}

/**
 * Gets the current microphone permission status.
 *
 * @returns Promise resolving to the current permission state
 */
export async function getPermissionStatus(): Promise<AudioCapturePermission> {
  // Check if permissions API is available
  if (typeof navigator === "undefined" || !navigator.permissions) {
    return AudioCapturePermission.UNKNOWN;
  }

  try {
    const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
    switch (result.state) {
      case "granted":
        return AudioCapturePermission.GRANTED;
      case "denied":
        return AudioCapturePermission.DENIED;
      case "prompt":
        return AudioCapturePermission.PROMPT;
      default:
        return AudioCapturePermission.UNKNOWN;
    }
  } catch {
    // Some browsers don't support microphone permission query
    return AudioCapturePermission.UNKNOWN;
  }
}

/**
 * Checks if currently recording.
 *
 * @returns true if recording is in progress
 */
export function isRecording(): boolean {
  return currentSession !== null;
}

/**
 * Gets the best supported MIME type for MediaRecorder.
 *
 * @returns MIME type string or undefined if none supported
 */
function getSupportedMimeType(): string | undefined {
  // Prefer webm/opus for better quality and compression
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/wav",
  ];

  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return undefined;
}

/**
 * Starts recording audio from the microphone.
 *
 * @throws AudioCaptureError if recording cannot start
 */
export async function startRecording(): Promise<void> {
  if (currentSession) {
    throw new AudioCaptureError("Recording already in progress", "CAPTURE_FAILED");
  }

  if (!isSupported()) {
    throw new AudioCaptureError(
      "Audio capture not supported in this environment",
      "CAPTURE_FAILED"
    );
  }

  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    throw new AudioCaptureError("No supported audio format found", "CAPTURE_FAILED");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        sampleRate: { ideal: config.sampleRate },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
      },
    });
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        throw new AudioCaptureError("Microphone permission denied", "PERMISSION_DENIED");
      }
      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        throw new AudioCaptureError("No microphone device found", "DEVICE_NOT_FOUND");
      }
    }
    throw new AudioCaptureError(
      `Failed to access microphone: ${error instanceof Error ? error.message : String(error)}`,
      "CAPTURE_FAILED"
    );
  }

  const audioContext = new AudioContext();
  const mediaRecorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  currentSession = {
    mediaRecorder,
    stream,
    chunks,
    startedAt: new Date().toISOString(),
    audioContext,
  };

  // Request data every 100ms for better chunking
  mediaRecorder.start(100);
}

/**
 * Stops the current recording and returns the captured audio.
 *
 * @returns Promise resolving to the captured audio result
 * @throws AudioCaptureError if no recording is in progress or processing fails
 */
export async function stopRecording(): Promise<AudioCaptureResult> {
  if (!currentSession) {
    throw new AudioCaptureError("No recording in progress", "CAPTURE_FAILED");
  }

  const session = currentSession;
  currentSession = null;

  // Stop the MediaRecorder and wait for final data
  const recordingStopped = new Promise<void>((resolve) => {
    session.mediaRecorder.onstop = () => resolve();
  });

  session.mediaRecorder.stop();
  await recordingStopped;

  // Stop all tracks on the stream
  session.stream.getTracks().forEach((track) => track.stop());

  const stoppedAt = new Date().toISOString();

  // Combine chunks into a single blob
  const audioBlob = new Blob(session.chunks, { type: session.mediaRecorder.mimeType });

  // Clear the chunks array to free memory
  session.chunks.length = 0;

  // Convert blob to AudioBuffer for processing
  let audioBuffer: globalThis.AudioBuffer;
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    audioBuffer = await session.audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    await session.audioContext.close();
    throw new AudioCaptureError(
      `Failed to decode audio: ${error instanceof Error ? error.message : String(error)}`,
      "ENCODING_FAILED"
    );
  }

  // Convert to mono
  let samples = convertToMono(audioBuffer);

  // Resample to target sample rate
  const sourceSampleRate = audioBuffer.sampleRate;
  if (sourceSampleRate !== config.sampleRate) {
    samples = resampleAudio(samples, sourceSampleRate, config.sampleRate);
  }

  // Close the audio context
  await session.audioContext.close();

  // Encode to WAV
  const wavBuffer = encodeWav(samples, config.sampleRate, config.channels);

  // Calculate duration
  const durationMs = (samples.length / config.sampleRate) * 1000;

  const result: AudioCaptureResult = {
    audio: {
      data: wavBuffer,
      format: "wav",
      sampleRate: config.sampleRate,
      channels: config.channels,
      durationMs,
    } as AppAudioBuffer,
    startedAt: session.startedAt,
    stoppedAt,
  };

  return result;
}

/**
 * Cancels the current recording without returning data.
 * Use this when you want to abort a recording without processing.
 */
export function cancelRecording(): void {
  if (!currentSession) {
    return;
  }

  const session = currentSession;
  currentSession = null;

  // Stop the MediaRecorder
  if (session.mediaRecorder.state !== "inactive") {
    session.mediaRecorder.stop();
  }

  // Stop all tracks on the stream
  session.stream.getTracks().forEach((track) => track.stop());

  // Clear chunks
  session.chunks.length = 0;

  // Close audio context
  session.audioContext.close().catch(() => {
    // Ignore errors during cleanup
  });
}

/**
 * Updates the audio capture configuration.
 *
 * @param newConfig - Partial configuration to merge with current
 */
export function setConfig(newConfig: Partial<AudioCaptureConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Gets the current audio capture configuration.
 *
 * @returns Current configuration
 */
export function getConfig(): AudioCaptureConfig {
  return { ...config };
}

/**
 * Resets the module state (for testing).
 */
export function reset(): void {
  if (currentSession) {
    cancelRecording();
  }
  config = { ...DEFAULT_AUDIO_CAPTURE_CONFIG };
}
