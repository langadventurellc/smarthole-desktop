---
id: E-configuration-user-experience
title: Configuration & User Experience
status: in-progress
priority: medium
parent: P-smarthole-mvp-desktop-command
prerequisites:
  - E-foundation-core-infrastructure
affectedFiles:
  src/types/config.ts: "Added firstRunCompleted: boolean field to AppConfig
    interface and firstRunCompleted: false to DEFAULT_CONFIG"
  package.json: Added electron-store ^11.0.2 as dependency (via npm install)
  package-lock.json: Updated with electron-store and its dependencies
  src/services/config-manager.ts: Created config manager service with
    electron-store integration, singleton pattern, configChanged event emission,
    and changed key path tracking; Created config manager service with
    electron-store integration, singleton pattern, configChanged event emission,
    and changed key path tracking
  src/services/config-manager.test.ts: Created comprehensive unit tests (24 tests)
    covering singleton initialization, getConfig, setConfig, deep merge
    behavior, changed keys tracking, event emission, and reset functionality;
    Created comprehensive unit tests (24 tests) covering singleton
    initialization, getConfig, setConfig, deep merge behavior, changed keys
    tracking, event emission, and reset functionality
  src/services/index.ts: Added export for config-manager module; Added export for
    config-manager module
log: []
schema: v1.0
childrenIds:
  - F-configuration-storage-ipc
  - F-first-run-experience
  - F-secure-credential-storage
  - F-settings-window-ui
created: 2026-01-29T01:45:51.040Z
updated: 2026-01-29T01:45:51.040Z
---

# Configuration & User Experience

## Purpose and Goals

Implement the configuration management system, settings UI, secure credential storage, and first-run onboarding experience. This epic ensures users can customize SmartHole's behavior, securely store API keys, and have a smooth initial setup experience.

## Architecture Note: Schema-First Approach

This epic defines the configuration schema and storage infrastructure that other epics consume. It can proceed in parallel with other epics because:

1. **Configuration Manager** defines the schema with defaults - other epics read/write to this schema
2. **Secure Credential Storage** provides the API for storing/retrieving secrets - other epics use this API
3. **Settings UI** can be built incrementally as features from other epics become available

The schema is defined here; the features that populate those settings are implemented in their respective epics (hotkeys in Input Capture, STT settings in Speech-to-Text, etc.).

## Major Components and Deliverables

### 1. Configuration Manager

- Persistent configuration storage using `electron-store`
- Platform-appropriate storage paths:
  - macOS: `~/Library/Application Support/SmartHole/`
  - Windows: `%APPDATA%/SmartHole/`
  - Linux: `~/.config/SmartHole/`
- Configuration schema with defaults:
  ```typescript
  interface Config {
    hotkey: string; // from E-input-capture-system
    voiceInputMode: "push-to-talk" | "toggle"; // from E-input-capture-system
    sttBackend: "cloud" | "local"; // from E-speech-to-text-integration
    sttApiKey: string; // stored in keychain
    localWhisperPath: string; // from E-speech-to-text-integration
    anthropicApiKey: string; // stored in keychain, from E-intelligent-routing-agent
    logLevel: "error" | "warn" | "info" | "debug" | "trace";
    logMessageContent: boolean;
    websocketPort: number; // from E-plugin-client-system
  }
  ```
- Configuration validation
- Migration support for schema changes

### 2. Secure Credential Storage

- OS keychain integration using `keytar`
- Store API keys securely (Anthropic, OpenAI, Groq)
- Retrieve credentials on demand
- Handle keychain access failures gracefully
- Never log or expose credentials

### 3. Settings Window UI

- React-based settings window
- Sections:
  - **Hotkeys**: Configure global hotkey bindings
  - **Voice Input**: Push-to-talk vs toggle mode selection
  - **Speech-to-Text**: Backend selection (local/cloud), API key input, local Whisper path
  - **Routing**: Anthropic API key input
  - **Logging**: Log level selection, message content logging toggle
  - **Advanced**: WebSocket port (default 9473)
- Save/Cancel buttons
- Input validation and error feedback

### 4. First-Run Experience

- Detect first launch (no config file exists)
- Permission requests:
  - Microphone access (required for voice input)
  - Accessibility permission (required for global hotkeys on macOS)
- Guided setup flow:
  1. Welcome screen
  2. Permission requests with explanations
  3. STT backend selection
  4. API key configuration (based on selected backend)
  5. Completion confirmation
- Skip option for users who want to configure later

### 5. Tray Menu Settings Access

- "Settings" menu item in tray context menu
- Opens settings window
- "About SmartHole" with version info

### 6. Configuration IPC Bridge

- Expose configuration API via preload bridge
- Main process handles actual config read/write
- Renderer can request/update configuration safely

## Technical Considerations

- Use `electron-store` for configuration persistence
- Use `keytar` for OS keychain (supports macOS Keychain, Windows Credential Vault, Linux Secret Service)
- Settings window: separate BrowserWindow or modal in main window
- Handle case where keytar fails (fallback to encrypted file storage or warn user)

## Dependencies

- **E-foundation-core-infrastructure**: Logging, error handling, IPC patterns, types

**Note**: This epic does NOT depend on other feature epics. It defines the configuration schema; those epics implement features that use the configuration. Settings UI sections can be stubbed/disabled until their corresponding features are implemented.

## Estimated Scale

4-5 features covering config manager, secure storage, settings UI, first-run experience, and IPC bridge

## User Stories

- As a user, I can configure my preferred hotkey for voice input
- As a user, I can choose between push-to-talk and toggle recording modes
- As a user, I can select my STT backend and enter API keys securely
- As a user, my API keys are stored securely in my OS keychain
- As a new user, I'm guided through initial setup with clear explanations
- As a user, I'm prompted for necessary permissions with context on why they're needed

## Non-Functional Requirements

- API keys must never appear in logs or be exposed to renderer process in plain text
- Configuration changes apply immediately without restart where possible
- First-run flow completable in < 2 minutes
- Settings window responsive and accessible

## Acceptance Criteria

1. [ ] Configuration stored in platform-appropriate location
2. [ ] Configuration schema with sensible defaults
3. [ ] API keys stored in OS keychain via keytar
4. [ ] Credentials never logged or exposed
5. [ ] Settings window opens from tray menu
6. [ ] Hotkey configuration UI functional
7. [ ] Voice input mode selection (push-to-talk/toggle)
8. [ ] STT backend selection and API key input
9. [ ] Anthropic API key input for routing agent
10. [ ] Log level configuration
11. [ ] First-run detection works correctly
12. [ ] Permission requests displayed with explanations
13. [ ] Guided setup flow for new users
14. [ ] Configuration changes persisted immediately
15. [ ] IPC bridge securely exposes config API to renderer
