/**
 * Input state management service for tracking application input lifecycle.
 * Provides a validated state machine with event emission for state changes.
 *
 * @see F-global-hotkey-system feature specification
 */

import { EventEmitter } from "events";
import { getLogger, Logger } from "./logger";
import {
  InputState,
  InputStateInfo,
  InputStateEvents,
  InputStateChangedEvent,
  InputModeChangedEvent,
  VoiceInputMode,
} from "../types";

// ============================================================================
// Valid State Transitions
// ============================================================================

/**
 * Map of valid state transitions.
 * Key is the current state, value is the set of valid next states.
 */
const VALID_TRANSITIONS: Record<InputState, Set<InputState>> = {
  [InputState.IDLE]: new Set([InputState.RECORDING]),
  [InputState.RECORDING]: new Set([InputState.PROCESSING, InputState.IDLE]),
  [InputState.PROCESSING]: new Set([InputState.IDLE]),
};

// ============================================================================
// Input State Service Interface
// ============================================================================

/**
 * Input state service for managing input lifecycle state machine.
 */
export interface InputStateService {
  /**
   * Get the current input state information.
   */
  getStateInfo(): InputStateInfo;

  /**
   * Get the current input state.
   */
  getCurrentState(): InputState;

  /**
   * Get the current input mode.
   */
  getCurrentMode(): VoiceInputMode;

  /**
   * Check if a transition to the target state is valid.
   */
  canTransitionTo(targetState: InputState): boolean;

  /**
   * Transition to a new state. Returns true if successful, false if invalid.
   */
  transitionTo(targetState: InputState): boolean;

  /**
   * Set the input mode (push-to-talk or toggle).
   */
  setMode(mode: VoiceInputMode): void;

  /**
   * Subscribe to input state events.
   */
  on<K extends keyof InputStateEvents>(event: K, listener: InputStateEvents[K]): void;

  /**
   * Unsubscribe from input state events.
   */
  off<K extends keyof InputStateEvents>(event: K, listener: InputStateEvents[K]): void;

  /**
   * Reset state to idle (primarily for testing).
   */
  reset(): void;
}

// ============================================================================
// Input State Service Implementation
// ============================================================================

class InputStateServiceImpl implements InputStateService {
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;
  private currentState: InputState = InputState.IDLE;
  private currentMode: VoiceInputMode = "push-to-talk";
  private stateEnteredAt: number = Date.now();
  private recordingStartedAt?: number;

  constructor() {
    this.logger = getLogger().child({ component: "InputState" });
    this.emitter = new EventEmitter();
  }

  getStateInfo(): InputStateInfo {
    return {
      state: this.currentState,
      mode: this.currentMode,
      stateEnteredAt: this.stateEnteredAt,
      recordingStartedAt: this.recordingStartedAt,
    };
  }

  getCurrentState(): InputState {
    return this.currentState;
  }

  getCurrentMode(): VoiceInputMode {
    return this.currentMode;
  }

  canTransitionTo(targetState: InputState): boolean {
    const validTargets = VALID_TRANSITIONS[this.currentState];
    return validTargets.has(targetState);
  }

  transitionTo(targetState: InputState): boolean {
    if (!this.canTransitionTo(targetState)) {
      this.logger.warn("Invalid state transition attempted", {
        from: this.currentState,
        to: targetState,
      });
      return false;
    }

    const previousState = this.currentState;
    const timestamp = Date.now();

    // Update state
    this.currentState = targetState;
    this.stateEnteredAt = timestamp;

    // Track recording start time
    if (targetState === InputState.RECORDING) {
      this.recordingStartedAt = timestamp;
    } else if (targetState === InputState.IDLE) {
      this.recordingStartedAt = undefined;
    }

    this.logger.debug("State transitioned", {
      from: previousState,
      to: targetState,
    });

    // Emit state change event
    const event: InputStateChangedEvent = {
      previousState,
      newState: targetState,
      timestamp,
    };
    this.emitter.emit("stateChanged", event);

    return true;
  }

  setMode(mode: VoiceInputMode): void {
    if (mode === this.currentMode) {
      return;
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;

    this.logger.debug("Mode changed", {
      from: previousMode,
      to: mode,
    });

    // Emit mode change event
    const event: InputModeChangedEvent = {
      previousMode,
      newMode: mode,
    };
    this.emitter.emit("modeChanged", event);
  }

  on<K extends keyof InputStateEvents>(event: K, listener: InputStateEvents[K]): void {
    this.emitter.on(event, listener);
  }

  off<K extends keyof InputStateEvents>(event: K, listener: InputStateEvents[K]): void {
    this.emitter.off(event, listener);
  }

  reset(): void {
    this.currentState = InputState.IDLE;
    this.stateEnteredAt = Date.now();
    this.recordingStartedAt = undefined;
    this.emitter.removeAllListeners();
    this.logger.debug("Input state reset");
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let inputStateInstance: InputStateServiceImpl | null = null;

/**
 * Initializes the global input state service instance.
 * Must be called inside `app.whenReady()` after the logger has been initialized.
 */
export function initializeInputState(): InputStateService {
  if (inputStateInstance) {
    return inputStateInstance;
  }

  inputStateInstance = new InputStateServiceImpl();
  return inputStateInstance;
}

/**
 * Gets the current input state service instance.
 * Throws if initializeInputState() has not been called.
 */
export function getInputState(): InputStateService {
  if (!inputStateInstance) {
    throw new Error(
      "InputState not initialized. Call initializeInputState() before using getInputState()."
    );
  }
  return inputStateInstance;
}

/**
 * Resets the input state service instance (primarily for testing).
 */
export function resetInputState(): void {
  if (inputStateInstance) {
    inputStateInstance.reset();
  }
  inputStateInstance = null;
}
