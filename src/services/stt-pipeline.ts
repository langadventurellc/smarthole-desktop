/**
 * STT Pipeline Service - Orchestrates audio-to-transcription flow.
 * Connects the audio capture system to the STT service, handling state management,
 * error handling, and event emission.
 */

import { EventEmitter } from "events";
import { getLogger, Logger } from "./logger";
import { getSttService } from "./stt-service";
import { getInputState } from "./input-state";
import { getNotificationService } from "./notifications";
import {
  AudioCaptureResult,
  InputState,
  SttPipelineEvents,
  SttPipelineErrorCode,
  TranscriptionReadyEvent,
  TranscriptionErrorEvent,
} from "../types";

// ============================================================================
// Error Notification Mapping
// ============================================================================

interface ErrorNotification {
  title: string;
  body: string;
}

const ERROR_NOTIFICATIONS: Record<SttPipelineErrorCode, ErrorNotification> = {
  NO_API_KEY: {
    title: "STT Not Configured",
    body: "Please add your API key in Settings",
  },
  NETWORK_ERROR: {
    title: "Transcription Failed",
    body: "Could not reach transcription service. Check your connection.",
  },
  RATE_LIMIT: {
    title: "Too Many Requests",
    body: "Please wait a moment before trying again.",
  },
  EMPTY_RESULT: {
    title: "No Speech Detected",
    body: "Try speaking more clearly or closer to the microphone.",
  },
  INVALID_AUDIO: {
    title: "Audio Error",
    body: "Recording format issue. Please try again.",
  },
  TRANSCRIPTION_FAILED: {
    title: "Transcription Failed",
    body: "An error occurred. Try text input instead.",
  },
};

// ============================================================================
// STT Pipeline Service Interface
// ============================================================================

/**
 * STT Pipeline service interface for orchestrating audio-to-text flow.
 */
export interface SttPipelineService {
  /**
   * Process captured audio through the STT pipeline.
   * Handles state transitions, transcription, and event emission.
   */
  processAudio(audioResult: AudioCaptureResult): Promise<void>;

  /**
   * Check if the pipeline is ready to process audio.
   * Delegates to the STT service readiness check.
   */
  isReady(): Promise<boolean>;

  on<K extends keyof SttPipelineEvents>(event: K, listener: SttPipelineEvents[K]): void;
  off<K extends keyof SttPipelineEvents>(event: K, listener: SttPipelineEvents[K]): void;
  reset(): void;
}

// ============================================================================
// STT Pipeline Service Implementation
// ============================================================================

class SttPipelineServiceImpl implements SttPipelineService {
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;

  constructor() {
    this.logger = getLogger().child({ component: "SttPipeline" });
    this.emitter = new EventEmitter();
  }

  async processAudio(audioResult: AudioCaptureResult): Promise<void> {
    const processingStartTime = Date.now();

    this.logger.info("Starting STT processing", {
      audioDurationMs: audioResult.audio.durationMs,
      format: audioResult.audio.format,
    });

    // Transition to PROCESSING state
    // Note: audio-capture transitions to IDLE before emitting audioReady,
    // so we transition back to PROCESSING here for the STT phase
    const inputStateService = getInputState();
    if (inputStateService.canTransitionTo(InputState.PROCESSING)) {
      inputStateService.transitionTo(InputState.PROCESSING);
      this.logger.debug("Transitioned to PROCESSING state");
    }

    try {
      // Perform transcription
      const sttService = getSttService();
      const result = await sttService.transcribe(audioResult.audio);

      const processingTimeMs = Date.now() - processingStartTime;

      // Handle empty transcription result
      if (!result.text || result.text.trim() === "") {
        this.logger.warn("Empty transcription result received");
        this.handleError("EMPTY_RESULT", "No speech detected in audio");
        return;
      }

      // Build and emit success event
      const event: TranscriptionReadyEvent = {
        text: result.text,
        confidence: result.confidence,
        inputMethod: "voice",
        audioMetadata: {
          durationMs: audioResult.audio.durationMs,
          startedAt: audioResult.startedAt,
          stoppedAt: audioResult.stoppedAt,
        },
        sttMetadata: {
          backendUsed: result.backendUsed,
          processingTimeMs,
        },
      };

      this.logger.info("Transcription completed", {
        processingTimeMs,
        audioDurationMs: audioResult.audio.durationMs,
        backend: result.backendUsed,
        // Note: Never log transcription text (sensitive data)
      });

      this.emitter.emit("transcriptionReady", event);
    } catch (error) {
      const errorCode = this.mapErrorToCode(error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error("Transcription failed", {
        code: errorCode,
        error: errorMessage,
      });

      this.handleError(errorCode, errorMessage, error instanceof Error ? error : undefined);
    } finally {
      // Always transition back to IDLE
      if (inputStateService.canTransitionTo(InputState.IDLE)) {
        inputStateService.transitionTo(InputState.IDLE);
        this.logger.debug("Transitioned to IDLE state");
      }
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const sttService = getSttService();
      return await sttService.isReady();
    } catch {
      // STT service not initialized
      return false;
    }
  }

  on<K extends keyof SttPipelineEvents>(event: K, listener: SttPipelineEvents[K]): void {
    this.emitter.on(event, listener);
  }

  off<K extends keyof SttPipelineEvents>(event: K, listener: SttPipelineEvents[K]): void {
    this.emitter.off(event, listener);
  }

  reset(): void {
    this.emitter.removeAllListeners();
    this.logger.debug("STT pipeline service reset");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Handle an error by showing notification and emitting error event.
   */
  private handleError(code: SttPipelineErrorCode, message: string, cause?: Error): void {
    // Show user notification
    const notification = ERROR_NOTIFICATIONS[code];
    try {
      const notificationService = getNotificationService();
      notificationService.showError(notification.title, notification.body);
    } catch {
      // Notification service may not be available
      this.logger.warn("Could not show error notification", { code });
    }

    // Emit error event
    const errorEvent: TranscriptionErrorEvent = {
      code,
      message,
      cause,
    };
    this.emitter.emit("transcriptionError", errorEvent);
  }

  /**
   * Map an error to an appropriate SttPipelineErrorCode.
   */
  private mapErrorToCode(error: unknown): SttPipelineErrorCode {
    if (!(error instanceof Error)) {
      return "TRANSCRIPTION_FAILED";
    }

    const message = error.message.toLowerCase();

    // Check for API key errors
    if (
      message.includes("api key") ||
      message.includes("unauthorized") ||
      message.includes("401")
    ) {
      return "NO_API_KEY";
    }

    // Check for network errors
    if (
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("timeout") ||
      message.includes("fetch failed")
    ) {
      return "NETWORK_ERROR";
    }

    // Check for rate limit errors
    if (message.includes("rate limit") || message.includes("429") || message.includes("too many")) {
      return "RATE_LIMIT";
    }

    // Check for audio format errors
    if (
      message.includes("audio") ||
      message.includes("format") ||
      message.includes("invalid file")
    ) {
      return "INVALID_AUDIO";
    }

    // Default to generic transcription failure
    return "TRANSCRIPTION_FAILED";
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sttPipelineInstance: SttPipelineServiceImpl | null = null;

/**
 * Initializes the global STT pipeline service instance.
 * Must be called inside `app.whenReady()` after logger, stt-service, input-state,
 * and notification services have been initialized.
 */
export function initializeSttPipeline(): SttPipelineService {
  if (sttPipelineInstance) {
    return sttPipelineInstance;
  }

  sttPipelineInstance = new SttPipelineServiceImpl();
  return sttPipelineInstance;
}

/**
 * Gets the current STT pipeline service instance.
 * Throws if initializeSttPipeline() has not been called.
 */
export function getSttPipeline(): SttPipelineService {
  if (!sttPipelineInstance) {
    throw new Error(
      "SttPipeline not initialized. Call initializeSttPipeline() before using getSttPipeline()."
    );
  }
  return sttPipelineInstance;
}

/**
 * Resets the STT pipeline service instance (primarily for testing).
 */
export function resetSttPipeline(): void {
  if (sttPipelineInstance) {
    sttPipelineInstance.reset();
  }
  sttPipelineInstance = null;
}
