/**
 * Configuration types for the SmartHole application.
 * These types define all user-configurable settings based on the MVP requirements.
 *
 * @see /docs/requirements/smarthole-mvp.md - Configuration section
 */

import { DeepPartial } from "./common";

// ============================================================================
// Log Level
// ============================================================================

/**
 * Log level enum for configuring logging verbosity.
 * Defined as a const object to allow both value and type usage.
 *
 * Levels in order of decreasing verbosity:
 * - TRACE: Verbose protocol-level details
 * - DEBUG: Detailed operational information
 * - INFO: Significant events (connections, routing decisions)
 * - WARN: Unexpected but handled situations
 * - ERROR: Failures requiring attention
 */
export const LogLevel = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
  TRACE: "trace",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

// ============================================================================
// Voice Input Mode
// ============================================================================

/**
 * Voice input recording mode.
 *
 * - "push-to-talk": Hold hotkey while speaking, release to send
 * - "toggle": Press hotkey to start recording, press again to stop
 */
export type VoiceInputMode = "push-to-talk" | "toggle";

// ============================================================================
// STT (Speech-to-Text) Configuration
// ============================================================================

/**
 * STT backend type.
 *
 * - "local": Self-hosted Whisper, privacy-friendly, works offline
 * - "cloud": Cloud API (OpenAI Whisper, Groq, etc.), simpler setup
 */
export type SttBackend = "local" | "cloud";

/**
 * Speech-to-Text configuration options.
 */
export interface SttConfig {
  /** The STT backend to use */
  backend: SttBackend;
  /** API key for cloud STT services (stored securely in keychain) */
  apiKey?: string;
  /** Path to local Whisper installation (for local backend) */
  localWhisperPath?: string;
}

// ============================================================================
// LLM Configuration
// ============================================================================

/**
 * LLM provider type.
 * MVP only supports Anthropic, but designed for future extensibility.
 */
export type LlmProvider = "anthropic";

/**
 * LLM configuration for the routing agent.
 */
export interface LlmConfig {
  /** LLM provider (MVP: only "anthropic" supported) */
  provider: LlmProvider;
  /** API key for the LLM provider (stored securely in keychain) */
  apiKey?: string;
  /** Model identifier (e.g., "claude-haiku-4-5") */
  model: string;
}

// ============================================================================
// Hotkey Configuration
// ============================================================================

/**
 * Hotkey configuration for global keyboard shortcuts.
 * Uses Electron accelerator format (e.g., "CommandOrControl+Shift+Space").
 */
export interface HotkeyConfig {
  /** Hotkey for voice input activation */
  voiceInput: string;
  /** Optional separate hotkey for text input popup */
  textInput?: string;
}

// ============================================================================
// Main Application Configuration
// ============================================================================

/**
 * Main application configuration interface.
 * Contains all user-configurable settings for SmartHole.
 */
export interface AppConfig {
  // --- Input Settings ---

  /** Global hotkey configuration */
  hotkey: HotkeyConfig;
  /** Voice recording mode (push-to-talk or toggle) */
  voiceInputMode: VoiceInputMode;

  // --- STT Settings ---

  /** Speech-to-Text configuration */
  stt: SttConfig;

  // --- LLM Settings ---

  /** LLM configuration for the routing agent */
  llm: LlmConfig;

  // --- Logging Settings ---

  /** Minimum log level to record */
  logLevel: LogLevel;
  /**
   * Whether to log full message text content.
   * Set to false for privacy (especially for voice input).
   */
  logMessageContent: boolean;

  // --- WebSocket Settings ---

  /**
   * Port for the WebSocket server that clients connect to.
   * Server binds to 127.0.0.1 only (localhost).
   */
  websocketPort: number;

  // --- First-Run Settings ---

  /** Whether the first-run experience has been completed */
  firstRunCompleted: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration values for SmartHole.
 * These match the defaults specified in the MVP requirements.
 *
 * @see /docs/requirements/smarthole-mvp.md - Configuration section
 */
export const DEFAULT_CONFIG: Readonly<AppConfig> = {
  hotkey: {
    voiceInput: "CommandOrControl+Shift+Space",
  },
  voiceInputMode: "push-to-talk",
  stt: {
    backend: "cloud",
  },
  llm: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
  },
  logLevel: LogLevel.INFO,
  logMessageContent: false,
  websocketPort: 9473,
  firstRunCompleted: false,
};

// ============================================================================
// Partial Configuration Type
// ============================================================================

/**
 * Partial application configuration for updates.
 * Allows partial nested objects for incremental configuration changes.
 *
 * @example
 * ```ts
 * const partialConfig: PartialAppConfig = {
 *   logLevel: LogLevel.DEBUG,
 *   stt: { backend: "local" },
 * };
 * ```
 */
export type PartialAppConfig = DeepPartial<AppConfig>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Valid log level values for runtime validation.
 */
const LOG_LEVEL_VALUES: ReadonlySet<string> = new Set(Object.values(LogLevel));

/**
 * Checks if a value is a valid LogLevel.
 *
 * @param value - The value to check
 * @returns true if the value is a valid LogLevel
 */
export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && LOG_LEVEL_VALUES.has(value);
}

/**
 * Valid voice input mode values for runtime validation.
 */
const VOICE_INPUT_MODE_VALUES: ReadonlySet<string> = new Set(["push-to-talk", "toggle"]);

/**
 * Checks if a value is a valid VoiceInputMode.
 *
 * @param value - The value to check
 * @returns true if the value is a valid VoiceInputMode
 */
export function isVoiceInputMode(value: unknown): value is VoiceInputMode {
  return typeof value === "string" && VOICE_INPUT_MODE_VALUES.has(value);
}

/**
 * Valid STT backend values for runtime validation.
 */
const STT_BACKEND_VALUES: ReadonlySet<string> = new Set(["local", "cloud"]);

/**
 * Checks if a value is a valid SttBackend.
 *
 * @param value - The value to check
 * @returns true if the value is a valid SttBackend
 */
export function isSttBackend(value: unknown): value is SttBackend {
  return typeof value === "string" && STT_BACKEND_VALUES.has(value);
}

/**
 * Valid LLM provider values for runtime validation.
 */
const LLM_PROVIDER_VALUES: ReadonlySet<string> = new Set(["anthropic"]);

/**
 * Checks if a value is a valid LlmProvider.
 *
 * @param value - The value to check
 * @returns true if the value is a valid LlmProvider
 */
export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && LLM_PROVIDER_VALUES.has(value);
}
