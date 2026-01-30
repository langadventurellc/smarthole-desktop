/**
 * Input state types for tracking voice/text input lifecycle.
 *
 * @see F-global-hotkey-system feature specification
 */

import { VoiceInputMode } from "./config";

// ============================================================================
// Input State
// ============================================================================

/**
 * Application input state representing the current phase of input capture.
 */
export const InputState = {
  /** Waiting for input trigger (hotkey press) */
  IDLE: "idle",
  /** Actively capturing voice input */
  RECORDING: "recording",
  /** Transcribing/routing the captured input */
  PROCESSING: "processing",
} as const;

export type InputState = (typeof InputState)[keyof typeof InputState];

// ============================================================================
// Input State Info
// ============================================================================

/**
 * Complete input state information including mode and timestamps.
 */
export interface InputStateInfo {
  /** Current input state */
  state: InputState;
  /** Current input mode (push-to-talk or toggle) */
  mode: VoiceInputMode;
  /** When the current state was entered */
  stateEnteredAt: number;
  /** When recording started (only set during RECORDING or PROCESSING) */
  recordingStartedAt?: number;
}

// ============================================================================
// Input State Events
// ============================================================================

/**
 * Event emitted when input state changes.
 */
export interface InputStateChangedEvent {
  /** Previous state */
  previousState: InputState;
  /** New state */
  newState: InputState;
  /** Timestamp when the change occurred */
  timestamp: number;
}

/**
 * Event emitted when input mode changes.
 */
export interface InputModeChangedEvent {
  /** Previous mode */
  previousMode: VoiceInputMode;
  /** New mode */
  newMode: VoiceInputMode;
}

/**
 * Events emitted by the InputStateService.
 */
export interface InputStateEvents {
  /** Emitted when state transitions */
  stateChanged: (event: InputStateChangedEvent) => void;
  /** Emitted when input mode changes */
  modeChanged: (event: InputModeChangedEvent) => void;
}
