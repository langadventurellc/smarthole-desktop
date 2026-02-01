/**
 * Speech-to-Text (STT) service types and interfaces.
 * These types define the abstraction layer for STT backends, allowing the application
 * to support multiple STT providers (local Whisper, cloud APIs) through a common interface.
 *
 * @see F-stt-service-core-cloud feature specification
 */

import { AudioBuffer } from "./audio";
import { SttBackend as SttBackendType, isSttBackend } from "./config";

// ============================================================================
// STT Backend Types
// ============================================================================

// Note: SttBackendType is imported from config.ts where it's defined as SttBackend.
// We use it locally but don't re-export to avoid duplicate exports in the barrel file.

/**
 * Cloud STT provider identifier.
 * Used for selecting which cloud service to use when backend is "cloud".
 *
 * - "groq": Groq Whisper API (fast, cost-effective)
 * - "openai": OpenAI Whisper API (original, widely supported)
 */
export type SttCloudProvider = "groq" | "openai";

// ============================================================================
// STT Result
// ============================================================================

/**
 * Result of a speech-to-text transcription operation.
 * Contains the transcribed text and metadata about the transcription.
 */
export interface SttResult {
  /** The transcribed text from the audio */
  text: string;
  /** Confidence score (0-1) if provided by the backend */
  confidence?: number;
  /** Duration of the processed audio in milliseconds */
  durationMs: number;
  /** Which backend was used for this transcription */
  backendUsed: SttBackendType;
}

// ============================================================================
// STT Backend Interface
// ============================================================================

/**
 * Interface that all STT backend implementations must follow.
 * Backends are responsible for the actual transcription work.
 *
 * Note: Named ISttBackend to avoid conflict with SttBackend type in config.ts
 * which represents the backend type ("local" | "cloud").
 */
export interface ISttBackend {
  /** Identifier for this backend type */
  readonly name: SttBackendType;

  /**
   * Transcribe audio to text.
   *
   * @param audio - The audio buffer containing the audio data to transcribe
   * @returns The transcription result
   * @throws Error with appropriate ErrorCode on failure
   */
  transcribe(audio: AudioBuffer): Promise<SttResult>;

  /**
   * Check if this backend is currently available for use.
   * For cloud backends, this may check API key availability.
   * For local backends, this may check if the model is loaded.
   *
   * @returns true if the backend is ready to transcribe
   */
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// STT Service Interface
// ============================================================================

/**
 * Main STT service interface for the application.
 * Manages backend selection and provides a unified transcription API.
 */
export interface SttService {
  /**
   * Transcribe audio using the active backend.
   *
   * @param audio - The audio buffer containing the audio data to transcribe
   * @returns The transcription result
   * @throws Error with appropriate ErrorCode on failure
   */
  transcribe(audio: AudioBuffer): Promise<SttResult>;

  /**
   * Get the currently active backend type.
   *
   * @returns The active backend type identifier
   */
  getActiveBackend(): SttBackendType;

  /**
   * Check if the service is ready to transcribe.
   * This verifies that the active backend is available and properly configured.
   *
   * @returns true if the service is ready to accept transcription requests
   */
  isReady(): Promise<boolean>;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Re-export isSttBackend from config.ts as isSttBackendType for consistency
 * with the SttBackendType alias used in this module.
 * This maintains a single source of truth for backend type validation.
 */
export { isSttBackend as isSttBackendType } from "./config";

/**
 * Valid STT cloud provider values for runtime validation.
 */
const STT_CLOUD_PROVIDER_VALUES: ReadonlySet<string> = new Set(["groq", "openai"]);

/**
 * Checks if a value is a valid SttCloudProvider.
 *
 * @param value - The value to check
 * @returns true if the value is a valid STT cloud provider
 */
export function isSttCloudProvider(value: unknown): value is SttCloudProvider {
  return typeof value === "string" && STT_CLOUD_PROVIDER_VALUES.has(value);
}

// ============================================================================
// STT Pipeline Types
// ============================================================================

/**
 * Error codes specific to the STT pipeline.
 * Used for classifying errors during transcription processing.
 */
export type SttPipelineErrorCode =
  | "NO_API_KEY"
  | "NETWORK_ERROR"
  | "RATE_LIMIT"
  | "EMPTY_RESULT"
  | "INVALID_AUDIO"
  | "TRANSCRIPTION_FAILED";

/**
 * Event emitted when transcription completes successfully.
 * Contains the transcribed text and metadata about the processing.
 */
export interface TranscriptionReadyEvent {
  text: string;
  /** Confidence score (0-1) if provided by the backend */
  confidence?: number;
  inputMethod: "voice";
  audioMetadata: {
    durationMs: number;
    startedAt: string;
    stoppedAt: string;
  };
  sttMetadata: {
    backendUsed: SttBackendType;
    processingTimeMs: number;
  };
}

/**
 * Event emitted when transcription fails.
 * Contains error details for logging and user feedback.
 */
export interface TranscriptionErrorEvent {
  code: SttPipelineErrorCode;
  message: string;
  cause?: Error;
}

/**
 * Events emitted by the STT pipeline service.
 */
export interface SttPipelineEvents {
  /** Emitted when transcription completes successfully */
  transcriptionReady: (event: TranscriptionReadyEvent) => void;
  /** Emitted when transcription fails */
  transcriptionError: (event: TranscriptionErrorEvent) => void;
}

// ============================================================================
// STT Pipeline Type Guards
// ============================================================================

/**
 * Valid STT pipeline error code values for runtime validation.
 */
const STT_PIPELINE_ERROR_CODE_VALUES: ReadonlySet<string> = new Set([
  "NO_API_KEY",
  "NETWORK_ERROR",
  "RATE_LIMIT",
  "EMPTY_RESULT",
  "INVALID_AUDIO",
  "TRANSCRIPTION_FAILED",
]);

export function isSttPipelineErrorCode(value: unknown): value is SttPipelineErrorCode {
  return typeof value === "string" && STT_PIPELINE_ERROR_CODE_VALUES.has(value);
}

/**
 * Checks if a value is a valid TranscriptionReadyEvent.
 *
 * @param value - The value to check
 * @returns true if the value is a valid transcription ready event
 */
export function isTranscriptionReadyEvent(value: unknown): value is TranscriptionReadyEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // text must be a string
  if (typeof obj.text !== "string") {
    return false;
  }

  // confidence is optional but must be a number between 0-1 if present
  if (obj.confidence !== undefined) {
    if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1) {
      return false;
    }
  }

  // inputMethod must be "voice"
  if (obj.inputMethod !== "voice") {
    return false;
  }

  // audioMetadata must be present and valid
  if (typeof obj.audioMetadata !== "object" || obj.audioMetadata === null) {
    return false;
  }
  const audioMeta = obj.audioMetadata as Record<string, unknown>;
  if (
    typeof audioMeta.durationMs !== "number" ||
    typeof audioMeta.startedAt !== "string" ||
    typeof audioMeta.stoppedAt !== "string"
  ) {
    return false;
  }

  // sttMetadata must be present and valid
  if (typeof obj.sttMetadata !== "object" || obj.sttMetadata === null) {
    return false;
  }
  const sttMeta = obj.sttMetadata as Record<string, unknown>;
  if (!isSttBackend(sttMeta.backendUsed) || typeof sttMeta.processingTimeMs !== "number") {
    return false;
  }

  return true;
}

/**
 * Checks if a value is a valid TranscriptionErrorEvent.
 *
 * @param value - The value to check
 * @returns true if the value is a valid transcription error event
 */
export function isTranscriptionErrorEvent(value: unknown): value is TranscriptionErrorEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // code must be a valid error code
  if (!isSttPipelineErrorCode(obj.code)) {
    return false;
  }

  // message must be a string
  if (typeof obj.message !== "string") {
    return false;
  }

  // cause is optional but must be an Error if present
  if (obj.cause !== undefined && !(obj.cause instanceof Error)) {
    return false;
  }

  return true;
}

/**
 * Checks if a value is a valid SttResult.
 *
 * @param value - The value to check
 * @returns true if the value is a valid STT result
 */
export function isSttResult(value: unknown): value is SttResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // text must be a string
  if (typeof obj.text !== "string") {
    return false;
  }

  // confidence is optional but must be a number between 0-1 if present
  if (obj.confidence !== undefined) {
    if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1) {
      return false;
    }
  }

  // durationMs must be a non-negative number
  if (typeof obj.durationMs !== "number" || obj.durationMs < 0) {
    return false;
  }

  // backendUsed must be a valid backend type
  if (!isSttBackend(obj.backendUsed)) {
    return false;
  }

  return true;
}
