/**
 * Audio capture coordination service for the main process.
 * Manages audio recording lifecycle and coordinates with renderer-side capture via IPC.
 *
 * @see F-voice-recording-service feature specification
 */

import { EventEmitter } from "events";
import { systemPreferences } from "electron";
import { getLogger, Logger } from "./logger";
import { getInputState } from "./input-state";
import {
  AudioCaptureState,
  AudioCapturePermission,
  AudioCaptureEvents,
  AudioCaptureResult,
  AudioPermissionStatus,
  AudioStateChangedEvent,
  AudioPermissionChangedEvent,
  AudioReadyEvent,
  AudioErrorEvent,
  VoiceInputMode,
  InputState,
} from "../types";

// ============================================================================
// Audio Capture Service Interface
// ============================================================================

/**
 * Audio capture service for coordinating audio recording from main process.
 */
export interface AudioCaptureService {
  /**
   * Start recording audio.
   * Signals renderer to begin capturing microphone input.
   *
   * @returns true if recording started successfully, false if denied or error
   */
  startRecording(): Promise<boolean>;

  /**
   * Stop the current recording.
   * Signals renderer to stop capture and emit audio data.
   */
  stopRecording(): Promise<void>;

  /**
   * Check if currently recording.
   */
  isRecording(): boolean;

  /**
   * Get the current capture state.
   */
  getState(): AudioCaptureState;

  /**
   * Get microphone permission status.
   * Checks system permissions on macOS, always 'granted' on Windows.
   */
  getPermissionStatus(): Promise<AudioPermissionStatus>;

  /**
   * Get the current voice input mode.
   */
  getMode(): VoiceInputMode;

  /**
   * Set the voice input mode.
   *
   * @param mode - The new voice input mode
   */
  setMode(mode: VoiceInputMode): void;

  /**
   * Handle incoming audio data from renderer.
   * Called when renderer sends captured audio via IPC.
   *
   * @param result - The captured audio result
   */
  handleAudioData(result: AudioCaptureResult): void;

  /**
   * Subscribe to audio capture events.
   */
  on<K extends keyof AudioCaptureEvents>(event: K, listener: AudioCaptureEvents[K]): void;

  /**
   * Unsubscribe from audio capture events.
   */
  off<K extends keyof AudioCaptureEvents>(event: K, listener: AudioCaptureEvents[K]): void;

  /**
   * Reset the service state (primarily for testing).
   */
  reset(): void;
}

// ============================================================================
// Audio Capture Service Implementation
// ============================================================================

class AudioCaptureServiceImpl implements AudioCaptureService {
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;
  private currentState: AudioCaptureState = AudioCaptureState.IDLE;
  private currentMode: VoiceInputMode = "push-to-talk";
  private lastPermission: AudioCapturePermission = AudioCapturePermission.UNKNOWN;

  constructor() {
    this.logger = getLogger().child({ component: "AudioCapture" });
    this.emitter = new EventEmitter();
  }

  async startRecording(): Promise<boolean> {
    // Check if already recording
    if (this.currentState === AudioCaptureState.RECORDING) {
      this.logger.warn("Already recording, ignoring start request");
      return true;
    }

    // Check permission first
    const permissionStatus = await this.getPermissionStatus();
    if (permissionStatus.permission === AudioCapturePermission.DENIED) {
      this.logger.warn("Microphone permission denied, cannot start recording");
      this.emitError("Microphone permission denied", "PERMISSION_DENIED");
      return false;
    }

    // Transition to recording state
    const previousState = this.currentState;
    this.currentState = AudioCaptureState.RECORDING;

    // Update InputState to RECORDING
    const inputState = getInputState();
    if (inputState.canTransitionTo(InputState.RECORDING)) {
      inputState.transitionTo(InputState.RECORDING);
    }

    this.logger.info("Recording started", { mode: this.currentMode });

    // Emit state change
    this.emitStateChanged(previousState, AudioCaptureState.RECORDING);

    return true;
  }

  async stopRecording(): Promise<void> {
    if (this.currentState !== AudioCaptureState.RECORDING) {
      this.logger.debug("Not recording, ignoring stop request", {
        currentState: this.currentState,
      });
      return;
    }

    // Transition to stopped state
    const previousState = this.currentState;
    this.currentState = AudioCaptureState.STOPPED;

    // Update InputState to PROCESSING (audio is being processed)
    const inputState = getInputState();
    if (inputState.canTransitionTo(InputState.PROCESSING)) {
      inputState.transitionTo(InputState.PROCESSING);
    }

    this.logger.info("Recording stopped");

    // Emit state change
    this.emitStateChanged(previousState, AudioCaptureState.STOPPED);
  }

  isRecording(): boolean {
    return this.currentState === AudioCaptureState.RECORDING;
  }

  getState(): AudioCaptureState {
    return this.currentState;
  }

  async getPermissionStatus(): Promise<AudioPermissionStatus> {
    // On non-macOS platforms, assume permission is granted
    if (process.platform !== "darwin") {
      return {
        permission: AudioCapturePermission.GRANTED,
        canRequest: false,
      };
    }

    // Check macOS microphone permission
    const status = systemPreferences.getMediaAccessStatus("microphone");

    let permission: AudioCapturePermission;
    let canRequest = false;

    switch (status) {
      case "granted":
        permission = AudioCapturePermission.GRANTED;
        break;
      case "denied":
        permission = AudioCapturePermission.DENIED;
        break;
      case "restricted":
        permission = AudioCapturePermission.DENIED;
        break;
      case "not-determined":
        permission = AudioCapturePermission.PROMPT;
        canRequest = true;
        break;
      default:
        permission = AudioCapturePermission.UNKNOWN;
    }

    // Check for permission change
    if (
      permission !== this.lastPermission &&
      this.lastPermission !== AudioCapturePermission.UNKNOWN
    ) {
      this.emitPermissionChanged(this.lastPermission, permission);
    }
    this.lastPermission = permission;

    return { permission, canRequest };
  }

  getMode(): VoiceInputMode {
    return this.currentMode;
  }

  setMode(mode: VoiceInputMode): void {
    if (mode === this.currentMode) {
      return;
    }

    this.logger.debug("Voice input mode changed", {
      from: this.currentMode,
      to: mode,
    });

    this.currentMode = mode;
  }

  handleAudioData(result: AudioCaptureResult): void {
    this.logger.info("Audio data received", {
      durationMs: result.audio.durationMs,
      format: result.audio.format,
      sampleRate: result.audio.sampleRate,
    });

    // Transition back to idle
    const previousState = this.currentState;
    this.currentState = AudioCaptureState.IDLE;

    // Update InputState to IDLE
    const inputState = getInputState();
    if (inputState.canTransitionTo(InputState.IDLE)) {
      inputState.transitionTo(InputState.IDLE);
    }

    // Emit state change
    this.emitStateChanged(previousState, AudioCaptureState.IDLE);

    // Emit audio ready event for downstream STT processing
    const event: AudioReadyEvent = { result };
    this.emitter.emit("audioReady", event);

    this.logger.debug("Audio ready event emitted");
  }

  on<K extends keyof AudioCaptureEvents>(event: K, listener: AudioCaptureEvents[K]): void {
    this.emitter.on(event, listener);
  }

  off<K extends keyof AudioCaptureEvents>(event: K, listener: AudioCaptureEvents[K]): void {
    this.emitter.off(event, listener);
  }

  reset(): void {
    this.currentState = AudioCaptureState.IDLE;
    this.currentMode = "push-to-talk";
    this.lastPermission = AudioCapturePermission.UNKNOWN;
    this.emitter.removeAllListeners();
    this.logger.debug("Audio capture service reset");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private emitStateChanged(previousState: AudioCaptureState, newState: AudioCaptureState): void {
    const event: AudioStateChangedEvent = {
      previousState,
      newState,
      timestamp: Date.now(),
    };
    this.emitter.emit("stateChanged", event);
  }

  private emitPermissionChanged(
    previousPermission: AudioCapturePermission,
    newPermission: AudioCapturePermission
  ): void {
    const event: AudioPermissionChangedEvent = {
      previousPermission,
      newPermission,
    };
    this.emitter.emit("permissionChanged", event);
    this.logger.info("Microphone permission changed", {
      from: previousPermission,
      to: newPermission,
    });
  }

  private emitError(message: string, code: AudioErrorEvent["code"]): void {
    const event: AudioErrorEvent = { message, code };
    this.emitter.emit("error", event);
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let audioCaptureInstance: AudioCaptureServiceImpl | null = null;

/**
 * Initializes the global audio capture service instance.
 * Must be called inside `app.whenReady()` after the logger has been initialized.
 */
export function initializeAudioCapture(): AudioCaptureService {
  if (audioCaptureInstance) {
    return audioCaptureInstance;
  }

  audioCaptureInstance = new AudioCaptureServiceImpl();
  return audioCaptureInstance;
}

/**
 * Gets the current audio capture service instance.
 * Throws if initializeAudioCapture() has not been called.
 */
export function getAudioCapture(): AudioCaptureService {
  if (!audioCaptureInstance) {
    throw new Error(
      "AudioCapture not initialized. Call initializeAudioCapture() before using getAudioCapture()."
    );
  }
  return audioCaptureInstance;
}

/**
 * Resets the audio capture service instance (primarily for testing).
 */
export function resetAudioCapture(): void {
  if (audioCaptureInstance) {
    audioCaptureInstance.reset();
  }
  audioCaptureInstance = null;
}
