/**
 * Hotkey-related types for IPC communication.
 *
 * @see F-global-hotkey-system feature specification
 */

// ============================================================================
// Hotkey Events
// ============================================================================

/**
 * Hotkey type identifier for distinguishing between different hotkey purposes.
 */
export type HotkeyType = "voiceInput" | "textInput";

/**
 * Event payload when a registered hotkey is activated (pressed).
 */
export interface HotkeyActivatedEvent {
  /** The accelerator string that was activated (e.g., "CommandOrControl+Shift+Space") */
  accelerator: string;
  /** Which hotkey type was activated */
  hotkeyType: HotkeyType;
}

/**
 * Event payload when a registered hotkey is released.
 * Used for push-to-talk mode to detect when to stop recording.
 */
export interface HotkeyReleasedEvent {
  /** The accelerator string that was released */
  accelerator: string;
  /** Which hotkey type was released */
  hotkeyType: HotkeyType;
}

/**
 * Error codes for hotkey-related errors.
 */
export type HotkeyErrorCode = "REGISTRATION_FAILED" | "ACCESSIBILITY_DENIED" | "UIOHOOK_ERROR";

/**
 * Event payload when a hotkey error occurs.
 */
export interface HotkeyErrorEvent {
  /** Error message */
  message: string;
  /** The accelerator that failed (if applicable) */
  accelerator?: string;
  /** Error code */
  code: HotkeyErrorCode;
}
