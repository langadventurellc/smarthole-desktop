---
id: F-settings-window-ui
title: Settings Window UI
status: in-progress
priority: medium
parent: E-configuration-user-experience
prerequisites:
  - F-configuration-storage-ipc
  - F-secure-credential-storage
affectedFiles:
  src/windows/settings-window.ts: Created settings window singleton service with
    show/hide/isVisible/getWindow methods, escape key handling, and
    single-instance behavior; Updated to use SETTINGS_WINDOW_VITE_DEV_SERVER_URL
    instead of MAIN_WINDOW
  src/ipc/dialog-handler.ts: Created file dialog IPC handler for native open file/directory dialog
  src/types/ipc.ts: Added DIALOG_OPEN channel, DialogOpenOptions and
    DialogOpenResponse types, updated payload/response maps
  src/preload/main.ts: Added showOpenDialog() method to electronAPI for renderer
    access to file dialogs
  src/tray-menu.ts: Added onSettings action to TrayMenuActions and Settings... menu item
  src/tray-menu.test.ts: Updated mock actions and menu structure tests to include Settings menu item
  src/main.ts: Added settings window import, initialization, state tracking,
    dialog handler registration, and tray menu wiring
  src/windows/index.ts: Exported settings window service types and functions
  src/ipc/index.ts: Exported dialog handler
  src/types/ipc.test.ts: Updated channel count to 36 and added DIALOG_OPEN channel test
  src/settings/index.html: Updated title to SmartHole Settings
  vite.settings-renderer.config.ts: "Created Vite config for settings window renderer with root: src/settings"
  forge.config.ts: Added settings_window renderer entry to VitePlugin configuration
  src/windows/settings-window.test.ts: Created unit tests for settings window service (23 tests)
log:
  - "Started orchestration. Created feature branch feature/F-settings-window-ui.
    Tasks to execute in order: T-create-settings-window →
    T-build-settings-react-ui-with"
schema: v1.0
childrenIds:
  - T-build-settings-react-ui-with
  - T-create-settings-window
created: 2026-01-31T06:21:18.379Z
updated: 2026-01-31T06:21:18.379Z
---

# Settings Window UI

## Purpose

Implement the React-based settings window that allows users to configure SmartHole's behavior. The settings window displays configuration options in organized sections and persists changes via the configuration IPC bridge.

## Context

The settings window scaffolding exists in `src/settings/` with a stub App.tsx. The preload bridge already exposes `getConfig()`, `setConfig()`, and `onConfigChanged()`. Credential management uses separate IPC (has/store/delete).

## Deliverables

### 1. Settings Window Structure

- Settings container with tab/section navigation
- Sections (matching config schema):
  - **Hotkeys**: Global hotkey configuration
  - **Voice Input**: Push-to-talk vs toggle mode
  - **Speech-to-Text**: Backend selection, API key, local path
  - **AI Routing**: Anthropic API key
  - **Logging**: Log level, message content toggle
  - **Advanced**: WebSocket port

### 2. React Components (`src/settings/`)

- `App.tsx` - Main settings container with section tabs
- `components/SettingsSection.tsx` - Reusable section wrapper
- `components/HotkeyInput.tsx` - Hotkey capture input
- `components/SecretInput.tsx` - Masked API key input with show/hide toggle
- `components/SelectInput.tsx` - Dropdown for enums (log level, voice mode, STT backend)
- `components/NumberInput.tsx` - Validated number input (port)
- `components/ToggleInput.tsx` - Boolean toggle (log message content)
- `components/PathInput.tsx` - File path input with browse button

### 3. Settings Sections Implementation

- **Hotkey Section**:
  - Hotkey input that captures key combinations
  - Display current hotkey binding
- **Voice Input Section**:
  - Radio/select for push-to-talk vs toggle mode
- **STT Section**:
  - Backend dropdown (cloud/local)
  - Conditional fields based on backend:
    - Cloud: API key input (uses credential storage)
    - Local: Whisper model path input
- **AI Routing Section**:
  - Anthropic API key input (uses credential storage)
- **Logging Section**:
  - Log level dropdown
  - Toggle for message content logging
- **Advanced Section**:
  - WebSocket port number input

### 4. State Management

- Load current config on mount via `window.api.getConfig()`
- Local state for pending changes
- Save button persists via `window.api.setConfig(updates)`
- Credential inputs use `window.api.storeCredential()` / `window.api.hasCredential()`
- Listen for external config changes via `window.api.onConfigChanged()`

### 5. Input Validation

- Validate inputs before save (port range, required fields)
- Display validation errors inline
- Disable save button if validation fails

### 6. Styling

- Consistent with platform (minimal, native-feeling)
- Responsive layout
- Clear visual hierarchy
- Accessible (keyboard navigation, labels)

### 7. Window Management

- Settings window opens from tray menu
- Single instance (focus existing if already open)
- Remember window position (optional)
- Close on Escape key

## Technical Notes

- Use existing CSS patterns from `src/settings/index.css`
- Hotkey input should prevent browser shortcuts while focused
- Secret inputs should show "●●●●●●" for configured credentials, blank for unconfigured
- Consider form library or keep it simple with controlled components

## Dependencies

- F-configuration-storage-ipc-implementation (config get/set)
- F-secure-credential-storage (credential has/store)

## Acceptance Criteria

- [ ] Settings window renders all sections
- [ ] Can view and modify hotkey configuration
- [ ] Can select voice input mode
- [ ] Can configure STT backend and credentials
- [ ] Can configure Anthropic API key
- [ ] Can adjust log level and message logging
- [ ] Can modify WebSocket port
- [ ] Validation prevents invalid inputs
- [ ] Changes persist after save
- [ ] Window opens from tray menu
- [ ] Single-instance window behavior
