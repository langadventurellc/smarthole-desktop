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
  package.json: Added electron-store ^11.0.2 as dependency (via npm install);
    Added keytar dependency.
  package-lock.json: Updated with electron-store and its dependencies; Updated
    lockfile with keytar and its dependencies.
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
    config-manager module; Added export for credential-manager module.
  src/ipc/config-handler.ts: Created IPC handler for config management with
    createConfigGetHandler, createConfigSetHandler, and broadcastConfigChange
    functions
  src/ipc/config-handler.test.ts: Created 11 unit tests covering get/set handlers and broadcast functionality
  src/main.ts: Added config manager imports, state tracking, initialization in
    app.whenReady(), IPC handler registration, and config change event wiring to
    broadcast; Added credential manager imports, state object, initialization
    after config manager, and registered IPC handlers with child logger.; Added
    settings window import, initialization, state tracking, dialog handler
    registration, and tray menu wiring; Registered permission IPC handlers in
    app.whenReady() callback
  src/services/credential-manager.ts: New service implementing
    CredentialManagerService interface with keytar for OS keychain access.
    Follows singleton pattern with
    initializeCredentialManager/getCredentialManager/resetCredentialManager.
  src/services/credential-manager.test.ts: Unit tests covering singleton
    management, all CRUD operations, error handling for keytar failures, and
    type coverage for all CredentialKey variants.
  src/types/ipc.ts: Added CREDENTIAL_STORE, CREDENTIAL_DELETE, CREDENTIAL_HAS
    channels. Added CredentialStorePayload and CredentialKeyPayload types. Added
    entries to IpcPayloadMap and IpcResponseMap. Re-exported CredentialKey
    type.; Added DIALOG_OPEN channel, DialogOpenOptions and DialogOpenResponse
    types, updated payload/response maps; Added 4 new permission IPC channels
    (PERMISSION_CHECK_MICROPHONE, PERMISSION_REQUEST_MICROPHONE,
    PERMISSION_CHECK_ACCESSIBILITY, PERMISSION_OPEN_ACCESSIBILITY_SETTINGS) with
    corresponding payload/response types in IpcPayloadMap and IpcResponseMap
  src/ipc/credential-handler.ts: New file implementing
    createCredentialStoreHandler, createCredentialDeleteHandler, and
    createCredentialHasHandler factory functions following existing patterns.
  src/ipc/credential-handler.test.ts: New test file with 13 tests covering all
    three handlers, error propagation, and credential key type coverage.
  src/preload/main.ts: "Extended electronAPI with storeCredential,
    deleteCredential, and hasCredential methods using ipcRenderer.invoke.; Added
    showOpenDialog() method to electronAPI for renderer access to file dialogs;
    Added 4 permission bridge methods: checkMicrophonePermission,
    requestMicrophonePermission, checkAccessibilityPermission,
    openAccessibilitySettings"
  src/types/ipc.test.ts: Added test for credential channels and updated channel
    count from 32 to 35.; Updated channel count to 36 and added DIALOG_OPEN
    channel test; Updated channel count assertion from 36 to 40
  src/windows/settings-window.ts: Created settings window singleton service with
    show/hide/isVisible/getWindow methods, escape key handling, and
    single-instance behavior; Updated to use SETTINGS_WINDOW_VITE_DEV_SERVER_URL
    instead of MAIN_WINDOW
  src/ipc/dialog-handler.ts: Created file dialog IPC handler for native open file/directory dialog
  src/tray-menu.ts: Added onSettings action to TrayMenuActions and Settings... menu item
  src/tray-menu.test.ts: Updated mock actions and menu structure tests to include Settings menu item
  src/windows/index.ts: Exported settings window service types and functions;
    Added exports for initializeOnboardingWindow, getOnboardingWindow,
    resetOnboardingWindow, and OnboardingWindowService type
  src/ipc/index.ts: Exported dialog handler; Added export for permission-handler module
  src/settings/index.html: Updated title to SmartHole Settings
  vite.settings-renderer.config.ts: "Created Vite config for settings window renderer with root: src/settings"
  forge.config.ts: Added settings_window renderer entry to VitePlugin
    configuration; Added onboarding_window entry to renderer array in VitePlugin
    configuration
  src/windows/settings-window.test.ts: Created unit tests for settings window service (23 tests)
  src/settings/App.tsx: "Replaced stub with full settings container: tab
    navigation, config state management, validation, save/cancel handlers,
    keyboard shortcuts"
  src/settings/App.test.tsx: Added 17 tests covering loading state, tab
    navigation, save/cancel, validation, voice input, and logging settings
  src/settings/index.css: "Enhanced with comprehensive styling: CSS variables,
    dark mode, high contrast, responsive layout, all component styles"
  src/settings/components/SettingsSection.tsx: Created section wrapper component with title and description
  src/settings/components/HotkeyInput.tsx: Created hotkey capture input with Electron accelerator format conversion
  src/settings/components/SecretInput.tsx: Created masked credential input with
    show/hide toggle and hasCredential() integration
  src/settings/components/SelectInput.tsx: Created dropdown select component for enum values
  src/settings/components/NumberInput.tsx: Created number input with min/max validation and error display
  src/settings/components/ToggleInput.tsx: Created accessible toggle switch with aria-checked attribute
  src/settings/components/PathInput.tsx: Created file path input with browse button using showOpenDialog()
  src/settings/components/index.ts: Created barrel export for all settings components
  src/ipc/permission-handler.ts: "Created new file with 4 handler factory
    functions: createMicrophoneCheckHandler, createMicrophoneRequestHandler,
    createAccessibilityCheckHandler, createAccessibilitySettingsHandler"
  src/ipc/permission-handler.test.ts: Created new test file with 16 comprehensive
    unit tests covering all handlers across macOS, Windows, and Linux platforms
  src/windows/onboarding-window.ts: Created onboarding window service with
    BrowserWindow management, singleton pattern, show/hide/isVisible/getWindow
    methods, escape key handling, and cleanup on app quit
  src/windows/onboarding-window.test.ts: Created 23 unit tests covering singleton
    lifecycle, show behavior, hide behavior, visibility, getWindow, escape key
    handling, window closed events, and app cleanup
  vite.onboarding-renderer.config.ts: Created Vite config for onboarding renderer
    with react plugin and root set to src/onboarding
  src/onboarding/index.html: Created HTML entry point for onboarding window
  src/onboarding/renderer.tsx: Created React renderer entry point
  src/onboarding/OnboardingApp.tsx: Created minimal OnboardingApp component
    placeholder; Completely rewritten with wizard state management, step
    navigation, config loading, and STT config persistence
  src/onboarding/index.css: Created CSS styles for onboarding window with
    light/dark theme support; Expanded with comprehensive wizard styles
    including progress indicator, step layouts, permission cards, buttons, and
    form elements
  src/onboarding/OnboardingApp.test.tsx: Created 9 unit tests for wizard
    functionality including navigation, skip, and config saving
  src/onboarding/components/index.ts: Created exports for all onboarding components
  src/onboarding/components/ProgressIndicator.tsx: Created step indicator with
    completion state, current step highlight, and step labels
  src/onboarding/components/StepLayout.tsx: Created consistent layout wrapper with title, description, and content areas
  src/onboarding/components/WelcomeStep.tsx: Created welcome screen with app logo,
    feature highlights, and Get Started button
  src/onboarding/components/PermissionsStep.tsx: Created permissions step with
    microphone request, accessibility check (macOS), and polling for permission
    changes
  src/onboarding/components/SttStep.tsx: Created STT configuration with backend
    selection (cloud/local), API key input, and Whisper path selection
  src/onboarding/components/AiStep.tsx: Created Anthropic API key configuration with explanation and secure input
  src/onboarding/components/CompleteStep.tsx: Created completion step with
    configuration summary, status icons, and Finish button that sets
    firstRunCompleted
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
