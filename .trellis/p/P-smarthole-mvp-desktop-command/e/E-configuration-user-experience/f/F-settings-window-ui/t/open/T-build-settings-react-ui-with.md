---
id: T-build-settings-react-ui-with
title: Build settings React UI with all configuration sections
status: open
priority: medium
parent: F-settings-window-ui
prerequisites:
  - T-create-settings-window
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T09:55:52.288Z
updated: 2026-01-31T09:55:52.288Z
---

# Build Settings React UI

## Purpose

Implement the React-based settings user interface that allows users to view and modify all SmartHole configuration options. The UI renders configuration sections, handles form state, validates inputs, and persists changes via IPC.

## Context

Settings window infrastructure (T-create-settings-window) provides the BrowserWindow and wires to main process. The settings scaffolding exists in `src/settings/` with a stub App.tsx. This task builds out the full UI.

The settings window uses the main preload, so APIs are accessed via `window.electronAPI`.

Config schema is defined in `src/types/config.ts`:

- `HotkeyConfig`: `{ voiceInput: string, textInput?: string }`
- `VoiceInputMode`: `"push-to-talk" | "toggle"`
- `SttConfig`: `{ backend: "local" | "cloud", apiKey?: string, localWhisperPath?: string }`
- `LlmConfig`: `{ provider: "anthropic", apiKey?: string, model: string }`
- `LogLevel`: `"error" | "warn" | "info" | "debug" | "trace"`
- `logMessageContent`: boolean
- `websocketPort`: number

## Deliverables

### 1. Settings Container (`src/settings/App.tsx`)

Main settings component with:

- Tab/section navigation (sidebar or top tabs)
- Current section content area
- Save/Cancel buttons (or auto-save with dirty state indicator)
- Load config on mount, subscribe to changes

### 2. Reusable Input Components (`src/settings/components/`)

Create focused, reusable components:

- **`SettingsSection.tsx`** - Section wrapper with title and description
- **`HotkeyInput.tsx`** - Captures key combinations, displays current binding
  - Prevents browser shortcuts while focused
  - Shows "Press keys..." placeholder while recording
- **`SecretInput.tsx`** - Masked input with show/hide toggle
  - Shows "●●●●●●" when credential exists (not actual value)
  - Shows empty when unconfigured
  - Uses `hasCredential()` to check state
- **`SelectInput.tsx`** - Dropdown for enum values
- **`NumberInput.tsx`** - Number input with validation (e.g., port range)
- **`ToggleInput.tsx`** - Boolean toggle switch
- **`PathInput.tsx`** - File path input with browse button
  - Browse button calls `window.electronAPI.showOpenDialog()` (IPC from T-create-settings-window)

### 3. Settings Sections

Organize by configuration domain:

**Hotkeys Section:**

- Voice input hotkey (`hotkey.voiceInput`)
- Text input hotkey (`hotkey.textInput` - optional)

**Voice Input Section:**

- Mode selector: push-to-talk vs toggle (`voiceInputMode`)

**Speech-to-Text Section:**

- Backend selector: cloud vs local (`stt.backend`)
- Conditional fields:
  - Cloud: STT API key (credential, not config)
  - Local: Whisper model path (`stt.localWhisperPath`)

**AI Routing Section:**

- Anthropic API key (credential)
- Model selector (could be dropdown or text, `llm.model`)

**Logging Section:**

- Log level dropdown (`logLevel`)
- Log message content toggle (`logMessageContent`)

**Advanced Section:**

- WebSocket port (`websocketPort`)

### 4. State Management

- Load config via `window.electronAPI.getConfig()` on mount
- Maintain local form state for pending changes
- Track dirty state (has unsaved changes)
- Save via `window.electronAPI.setConfig(updates)`
- For credentials: use `storeCredential()` on save (only if value changed)
- Listen for external changes via `onConfigChanged()`

### 5. Validation

- Port number: 1024-65535
- Hotkey format: valid Electron accelerator
- Required field indicators
- Inline error messages
- Disable save when validation fails

### 6. Styling

Enhance `src/settings/index.css`:

- Native-feeling, platform-appropriate design
- Clear visual hierarchy
- Responsive layout
- Focus states for accessibility
- Consistent spacing

## Technical Notes

- Use controlled components for all inputs
- Keep it simple - no form library unless complexity demands it
- Hotkey input needs special handling to capture Electron accelerator format
- Credential inputs never show actual stored values (security)
- Consider debouncing for auto-save if implemented
- APIs accessed via `window.electronAPI` (main preload)

## Acceptance Criteria

- [ ] All configuration sections render correctly
- [ ] Can modify hotkey bindings
- [ ] Can switch voice input mode
- [ ] Can configure STT backend and credentials
- [ ] Can configure Anthropic API key
- [ ] Can adjust logging settings
- [ ] Can modify WebSocket port
- [ ] Validation prevents invalid values
- [ ] Changes persist after save
- [ ] External config changes update UI
- [ ] Keyboard navigation works
- [ ] PathInput browse button opens file dialog
