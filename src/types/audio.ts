/**
 * Audio capture types for voice input functionality.
 * These types support microphone audio capture for speech-to-text processing.
 *
 * @see F-voice-recording-service feature specification
 */

// ============================================================================
// Audio Capture State
// ============================================================================

/**
 * State of the audio capture system.
 * Uses const assertion pattern for type safety (consistent with InputState).
 */
export const AudioCaptureState = {
  /** Ready to start recording */
  IDLE: "idle",
  /** Actively recording audio from microphone */
  RECORDING: "recording",
  /** Recording completed, audio data available */
  STOPPED: "stopped",
  /** An error occurred during capture */
  ERROR: "error",
} as const;

export type AudioCaptureState = (typeof AudioCaptureState)[keyof typeof AudioCaptureState];

// ============================================================================
// Audio Capture Permission
// ============================================================================

/**
 * Microphone permission state.
 * Tracks the current status of microphone access authorization.
 */
export const AudioCapturePermission = {
  /** User has granted microphone access */
  GRANTED: "granted",
  /** User has denied microphone access */
  DENIED: "denied",
  /** Permission has not been requested yet (browser will prompt) */
  PROMPT: "prompt",
  /** Permission status cannot be determined */
  UNKNOWN: "unknown",
} as const;

export type AudioCapturePermission =
  (typeof AudioCapturePermission)[keyof typeof AudioCapturePermission];

// ============================================================================
// Audio Buffer
// ============================================================================

/**
 * Audio data buffer containing captured audio.
 * Represents raw audio data in a format suitable for STT processing.
 */
export interface AudioBuffer {
  /** Raw audio data as ArrayBuffer (PCM or WAV format) */
  data: ArrayBuffer;
  /** Audio format identifier */
  format: "wav" | "pcm";
  /** Sample rate in Hz (e.g., 16000 for 16kHz) */
  sampleRate: number;
  /** Number of audio channels (1 for mono, 2 for stereo) */
  channels: number;
  /** Duration of the audio in milliseconds */
  durationMs: number;
}

// ============================================================================
// Audio Capture Configuration
// ============================================================================

/**
 * Configuration for audio capture.
 * Specifies audio format parameters suitable for Whisper STT input.
 */
export interface AudioCaptureConfig {
  /** Target sample rate in Hz (default: 16000 for Whisper compatibility) */
  sampleRate: number;
  /** Number of channels (default: 1 for mono) */
  channels: number;
  /** Audio format to capture */
  format: "wav" | "pcm";
}

/**
 * Default audio capture configuration optimized for Whisper STT.
 */
export const DEFAULT_AUDIO_CAPTURE_CONFIG: AudioCaptureConfig = {
  sampleRate: 16000,
  channels: 1,
  format: "wav",
};

// ============================================================================
// Audio Capture Result
// ============================================================================

/**
 * Result of an audio capture operation.
 * Contains the captured audio data and metadata about the recording session.
 */
export interface AudioCaptureResult {
  /** Captured audio buffer */
  audio: AudioBuffer;
  /** ISO 8601 timestamp when recording started */
  startedAt: string;
  /** ISO 8601 timestamp when recording stopped */
  stoppedAt: string;
}

// ============================================================================
// Audio Permission Status
// ============================================================================

/**
 * Permission status response for microphone access.
 * Used for querying and reporting permission state.
 */
export interface AudioPermissionStatus {
  /** Current permission state */
  permission: AudioCapturePermission;
  /** Whether permission can be requested (false if permanently denied) */
  canRequest: boolean;
}

// ============================================================================
// Audio Capture Events
// ============================================================================

/**
 * Event emitted when audio capture completes and data is ready for STT.
 */
export interface AudioReadyEvent {
  /** The captured audio result */
  result: AudioCaptureResult;
}

/**
 * Event emitted when audio capture state changes.
 */
export interface AudioStateChangedEvent {
  /** Previous capture state */
  previousState: AudioCaptureState;
  /** New capture state */
  newState: AudioCaptureState;
  /** Timestamp when the change occurred */
  timestamp: number;
  /** Error message if newState is 'error' */
  error?: string;
}

/**
 * Event emitted when microphone permission status changes.
 */
export interface AudioPermissionChangedEvent {
  /** Previous permission state */
  previousPermission: AudioCapturePermission;
  /** New permission state */
  newPermission: AudioCapturePermission;
}

/**
 * Event emitted when an audio capture error occurs.
 */
export interface AudioErrorEvent {
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  code: AudioErrorCode;
}

/**
 * Error codes for audio capture errors.
 */
export type AudioErrorCode =
  | "PERMISSION_DENIED"
  | "DEVICE_NOT_FOUND"
  | "CAPTURE_FAILED"
  | "ENCODING_FAILED"
  | "UNKNOWN";

/**
 * Events emitted by the audio capture system.
 */
export interface AudioCaptureEvents {
  /** Emitted when recording completes and audio is ready for STT */
  audioReady: (event: AudioReadyEvent) => void;
  /** Emitted when capture state changes */
  stateChanged: (event: AudioStateChangedEvent) => void;
  /** Emitted when permission status changes */
  permissionChanged: (event: AudioPermissionChangedEvent) => void;
  /** Emitted when an error occurs */
  error: (event: AudioErrorEvent) => void;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Valid audio capture state values for runtime validation.
 */
const AUDIO_CAPTURE_STATE_VALUES: ReadonlySet<string> = new Set(Object.values(AudioCaptureState));

/**
 * Checks if a value is a valid AudioCaptureState.
 *
 * @param value - The value to check
 * @returns true if the value is a valid audio capture state
 */
export function isAudioCaptureState(value: unknown): value is AudioCaptureState {
  return typeof value === "string" && AUDIO_CAPTURE_STATE_VALUES.has(value);
}

/**
 * Valid audio capture permission values for runtime validation.
 */
const AUDIO_CAPTURE_PERMISSION_VALUES: ReadonlySet<string> = new Set(
  Object.values(AudioCapturePermission)
);

/**
 * Checks if a value is a valid AudioCapturePermission.
 *
 * @param value - The value to check
 * @returns true if the value is a valid audio capture permission
 */
export function isAudioCapturePermission(value: unknown): value is AudioCapturePermission {
  return typeof value === "string" && AUDIO_CAPTURE_PERMISSION_VALUES.has(value);
}

/**
 * Valid audio format values for runtime validation.
 */
const AUDIO_FORMAT_VALUES: ReadonlySet<string> = new Set(["wav", "pcm"]);

/**
 * Checks if a value is a valid audio format.
 *
 * @param value - The value to check
 * @returns true if the value is a valid audio format
 */
export function isAudioFormat(value: unknown): value is "wav" | "pcm" {
  return typeof value === "string" && AUDIO_FORMAT_VALUES.has(value);
}

/**
 * Checks if a value is a valid AudioBuffer.
 *
 * @param value - The value to check
 * @returns true if the value is a valid audio buffer
 */
export function isAudioBuffer(value: unknown): value is AudioBuffer {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // data must be an ArrayBuffer
  if (!(obj.data instanceof ArrayBuffer)) {
    return false;
  }

  // format must be valid
  if (!isAudioFormat(obj.format)) {
    return false;
  }

  // sampleRate must be a positive number
  if (typeof obj.sampleRate !== "number" || obj.sampleRate <= 0) {
    return false;
  }

  // channels must be a positive integer
  if (typeof obj.channels !== "number" || obj.channels <= 0 || !Number.isInteger(obj.channels)) {
    return false;
  }

  // durationMs must be a non-negative number
  if (typeof obj.durationMs !== "number" || obj.durationMs < 0) {
    return false;
  }

  return true;
}

/**
 * Checks if a value is a valid AudioCaptureResult.
 *
 * @param value - The value to check
 * @returns true if the value is a valid audio capture result
 */
export function isAudioCaptureResult(value: unknown): value is AudioCaptureResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // audio must be a valid AudioBuffer
  if (!isAudioBuffer(obj.audio)) {
    return false;
  }

  // startedAt must be a string (ISO 8601 timestamp)
  if (typeof obj.startedAt !== "string") {
    return false;
  }

  // stoppedAt must be a string (ISO 8601 timestamp)
  if (typeof obj.stoppedAt !== "string") {
    return false;
  }

  return true;
}

/**
 * Checks if a value is a valid AudioPermissionStatus.
 *
 * @param value - The value to check
 * @returns true if the value is a valid audio permission status
 */
export function isAudioPermissionStatus(value: unknown): value is AudioPermissionStatus {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // permission must be valid
  if (!isAudioCapturePermission(obj.permission)) {
    return false;
  }

  // canRequest must be a boolean
  if (typeof obj.canRequest !== "boolean") {
    return false;
  }

  return true;
}

/**
 * Valid audio error code values for runtime validation.
 */
const AUDIO_ERROR_CODE_VALUES: ReadonlySet<string> = new Set([
  "PERMISSION_DENIED",
  "DEVICE_NOT_FOUND",
  "CAPTURE_FAILED",
  "ENCODING_FAILED",
  "UNKNOWN",
]);

/**
 * Checks if a value is a valid AudioErrorCode.
 *
 * @param value - The value to check
 * @returns true if the value is a valid audio error code
 */
export function isAudioErrorCode(value: unknown): value is AudioErrorCode {
  return typeof value === "string" && AUDIO_ERROR_CODE_VALUES.has(value);
}

/**
 * Checks if a value is a valid AudioStateChangedEvent.
 *
 * @param value - The value to check
 * @returns true if the value is a valid audio state changed event
 */
export function isAudioStateChangedEvent(value: unknown): value is AudioStateChangedEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // previousState and newState must be valid states
  if (!isAudioCaptureState(obj.previousState) || !isAudioCaptureState(obj.newState)) {
    return false;
  }

  // timestamp must be a number
  if (typeof obj.timestamp !== "number") {
    return false;
  }

  // error is optional but must be string if present
  if (obj.error !== undefined && typeof obj.error !== "string") {
    return false;
  }

  return true;
}

/**
 * Checks if a value is a valid AudioPermissionChangedEvent.
 *
 * @param value - The value to check
 * @returns true if the value is a valid audio permission changed event
 */
export function isAudioPermissionChangedEvent(
  value: unknown
): value is AudioPermissionChangedEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // previousPermission and newPermission must be valid permissions
  return (
    isAudioCapturePermission(obj.previousPermission) && isAudioCapturePermission(obj.newPermission)
  );
}
