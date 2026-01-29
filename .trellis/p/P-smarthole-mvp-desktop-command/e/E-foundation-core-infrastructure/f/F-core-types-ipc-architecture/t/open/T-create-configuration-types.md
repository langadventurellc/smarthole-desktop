---
id: T-create-configuration-types
title: Create configuration types
status: open
priority: high
parent: F-core-types-ipc-architecture
prerequisites:
  - T-create-core-common-types-and
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T02:35:19.665Z
updated: 2026-01-29T02:35:19.665Z
---

# Create Configuration Types

## Context

This task defines the TypeScript interfaces for application configuration, based on the settings defined in the MVP requirements document.

**Parent Feature**: F-core-types-ipc-architecture
**Related Requirements**: [smarthole-mvp.md](/docs/requirements/smarthole-mvp.md) - Configuration section
**Depends On**: T-create-core-common-types-and (for utility types)

## Objective

Create comprehensive configuration types that cover all user-configurable settings for SmartHole, including STT settings, logging options, and WebSocket configuration.

## Implementation Details

### File to Create

`src/types/config.ts` - Configuration type definitions

### Types to Implement

Based on the requirements document, implement:

```typescript
import { NonEmptyString } from "./common";

// Log level enum (used across the app)
export const LogLevel = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
  TRACE: "trace",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

// Voice input mode
export type VoiceInputMode = "push-to-talk" | "toggle";

// STT backend type
export type SttBackend = "local" | "cloud";

// STT-specific configuration
export interface SttConfig {
  backend: SttBackend;
  apiKey?: string; // For cloud STT
  localWhisperPath?: string; // For local Whisper
}

// LLM configuration (for routing agent)
export interface LlmConfig {
  provider: "anthropic"; // MVP only supports Anthropic
  apiKey?: string;
  model: string; // e.g., 'claude-3-haiku-20240307'
}

// Hotkey configuration
export interface HotkeyConfig {
  voiceInput: string; // e.g., 'CommandOrControl+Shift+Space'
  textInput?: string; // Optional separate hotkey for text popup
}

// Main application configuration
export interface AppConfig {
  // Input settings
  hotkey: HotkeyConfig;
  voiceInputMode: VoiceInputMode;

  // STT settings
  stt: SttConfig;

  // LLM settings (routing agent)
  llm: LlmConfig;

  // Logging settings
  logLevel: LogLevel;
  logMessageContent: boolean; // Privacy: whether to log message text

  // WebSocket settings
  websocketPort: number; // Default: 9473

  // Future: add more settings as needed
}

// Default configuration values
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
    model: "claude-3-haiku-20240307",
  },
  logLevel: LogLevel.INFO,
  logMessageContent: false,
  websocketPort: 9473,
};

// Partial config for updates
export type PartialAppConfig = DeepPartial<AppConfig>;

// Helper type for deep partial
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

### Update Barrel Export

Add to `src/types/index.ts`:

```typescript
export * from "./common";
export * from "./config";
```

## Technical Approach

1. Create `src/types/config.ts`
2. Define `LogLevel` as const object + type (allows both value and type usage)
3. Define nested interfaces for grouped settings (STT, LLM, Hotkey)
4. Create `AppConfig` as the main configuration interface
5. Provide `DEFAULT_CONFIG` with sensible defaults from requirements
6. Add `DeepPartial` utility for partial config updates
7. Update barrel export

## Acceptance Criteria

1. [ ] `src/types/config.ts` created
2. [ ] `LogLevel` const + type defined with all 5 levels (Error, Warn, Info, Debug, Trace)
3. [ ] `VoiceInputMode` type defined ('push-to-talk' | 'toggle')
4. [ ] `SttBackend` type defined ('local' | 'cloud')
5. [ ] `SttConfig` interface defined with apiKey and localWhisperPath options
6. [ ] `LlmConfig` interface defined with provider, apiKey, model
7. [ ] `HotkeyConfig` interface defined
8. [ ] `AppConfig` interface defined with all settings from requirements
9. [ ] `DEFAULT_CONFIG` provides sensible defaults matching requirements
10. [ ] `DeepPartial` utility type implemented for config updates
11. [ ] Barrel export updated to include config types
12. [ ] No `any` types used

## Testing Requirements

Write unit tests in `src/types/config.test.ts`:

- Verify `DEFAULT_CONFIG` matches expected structure
- Verify `LogLevel` values are correct strings
- Use `@ts-expect-error` to verify type constraints (e.g., invalid log level)
- Test that `DeepPartial<AppConfig>` allows partial nested objects

## Security Considerations

- API keys are typed as optional strings but should never be logged
- Document that API keys should be stored securely (keychain) - implementation in later features

## Dependencies

- T-create-core-common-types-and (for potential utility types like NonEmptyString)
