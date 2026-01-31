---
id: T-build-settings-react-ui-with
title: Build settings React UI with all configuration sections
status: done
priority: medium
parent: F-settings-window-ui
prerequisites:
  - T-create-settings-window
affectedFiles:
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
log:
  - >-
    Research phase completed. Key findings:


    1. **Config types** (src/types/config.ts):
       - AppConfig has: hotkey, voiceInputMode, stt, llm, logLevel, logMessageContent, websocketPort, firstRunCompleted
       - LogLevel: error|warn|info|debug|trace
       - VoiceInputMode: push-to-talk|toggle
       - SttBackend: local|cloud
       - HotkeyConfig: { voiceInput, textInput? }

    2. **Credential types** (src/types/credentials.ts):
       - CredentialKey: anthropic-api-key|stt-api-key|openai-api-key|groq-api-key

    3. **Available APIs via window.electronAPI** (src/preload/main.ts):
       - getConfig(), setConfig(updates), onConfigChanged(callback)
       - storeCredential(key, value), deleteCredential(key), hasCredential(key)
       - showOpenDialog(options)

    4. **Existing settings folder**:
       - App.tsx (stub), renderer.tsx (entry), index.css (base styles), index.html
       - Need to create components/ folder

    5. **Styling patterns from popup.css**:
       - Uses system font stack
       - Dark mode via prefers-color-scheme
       - High contrast mode support

    Implementation plan:

    1. Create components folder and reusable input components

    2. Build App.tsx with tab navigation and sections

    3. Implement state management with config loading/saving

    4. Add validation logic

    5. Enhance CSS styling
  - >-
    Implementation completed. Created the full React settings UI:


    1. **Settings Container (src/settings/App.tsx)**
       - Tab/section navigation with sidebar
       - Load config on mount via getConfig()
       - Subscribe to external changes via onConfigChanged()
       - Track dirty state for unsaved changes
       - Save/Cancel buttons with proper disabled states
       - Keyboard shortcuts: Cmd/Ctrl+S to save, Escape to revert
       - Validation with inline error messages

    2. **Reusable Input Components (src/settings/components/)**
       - SettingsSection.tsx: Section wrapper with title and description
       - HotkeyInput.tsx: Captures key combinations in Electron accelerator format
       - SecretInput.tsx: Masked input with show/hide toggle, uses hasCredential() to check state
       - SelectInput.tsx: Dropdown for enum values
       - NumberInput.tsx: Number input with min/max validation
       - ToggleInput.tsx: Boolean toggle switch with accessibility (role="switch")
       - PathInput.tsx: File path input with browse button using showOpenDialog()

    3. **Settings Sections**
       - Hotkeys: Voice input hotkey (required), text input hotkey (optional)
       - Voice Input: Push-to-talk vs toggle mode selector
       - Speech-to-Text: Backend selector (cloud/local), conditional fields for each
       - AI Routing: Anthropic API key (credential), model selector
       - Logging: Log level dropdown, message content toggle
       - Advanced: WebSocket port with validation (1024-65535)

    4. **State Management**
       - Loads config via window.electronAPI.getConfig() on mount
       - Maintains local form state for pending changes
       - Tracks dirty state (JSON comparison)
       - Saves via window.electronAPI.setConfig(updates)
       - Credentials use storeCredential()/deleteCredential() on save

    5. **Validation**
       - Port range: 1024-65535
       - Voice hotkey required
       - Inline error messages
       - Save button disabled when validation fails

    6. **Styling (src/settings/index.css)**
       - Native-feeling design with CSS variables for theming
       - Dark mode via prefers-color-scheme media query
       - High contrast mode support
       - Reduced motion support
       - Responsive layout with sidebar navigation
       - Focus states for accessibility

    7. **Tests (src/settings/App.test.tsx)**
       - 17 tests covering loading state, tab navigation, save/cancel, validation, voice input, logging settings

    All quality checks pass. All 916 tests pass.
  - Built the full React settings UI with all configuration sections.
    Implemented a tabbed settings container with sidebar navigation, 7 reusable
    input components (SettingsSection, HotkeyInput, SecretInput, SelectInput,
    NumberInput, ToggleInput, PathInput), and 6 settings sections (Hotkeys,
    Voice Input, Speech-to-Text, AI Routing, Logging, Advanced). Added state
    management with config loading/saving via IPC, validation for port range and
    required fields, and comprehensive styling with dark mode and accessibility
    support. Includes 17 tests for the App component.
  - >-
    Addressed all review findings:


    1. **Fixed external config change handling with dirty state**
    (src/settings/App.tsx):
       - Added `hasExternalChanges` state to track when external changes arrive while user has unsaved changes
       - Added refs (`configRef`, `originalConfigRef`) to track current state for use in the onConfigChanged callback
       - When user has dirty state and external changes arrive: only update `originalConfig`, preserve user's `config`, set warning message
       - When user has no dirty state: update both `config` and `originalConfig`
       - Added warning message type "warning" with yellow/amber styling
       - Added "(baseline updated externally)" indicator in footer when both dirty and external changes exist
       - Reset `hasExternalChanges` when user saves

    2. **Added tests for credential operations** (src/settings/App.test.tsx):
       - Test: "calls storeCredential when saving a new API key" - verifies storeCredential is called with correct key and value
       - Test: "calls deleteCredential when clearing an existing API key" - verifies deleteCredential is called when Clear button clicked

    3. **Added tests for Speech-to-Text tab** (src/settings/App.test.tsx):
       - Test: "switches to STT tab and shows backend selector"
       - Test: "shows STT API Key input when cloud backend is selected"
       - Test: "shows Local Whisper Path input when local backend is selected"
       - Test: "switches from cloud to local backend and shows path input" (conditional rendering)

    4. **Added tests for AI Routing tab** (src/settings/App.test.tsx):
       - Test: "switches to AI Routing tab and shows Anthropic API key input"
       - Test: "shows model selector on AI Routing tab"

    5. **Added tests for keyboard shortcuts** (src/settings/App.test.tsx):
       - Test: "Cmd/Ctrl+S triggers save when there are unsaved changes"
       - Test: "Ctrl+S triggers save when there are unsaved changes"
       - Test: "Cmd/Ctrl+S does not save when no changes"
       - Test: "Escape key reverts changes to original config"
       - Test: "Escape key does nothing when no unsaved changes"

    6. **Added tests for external config changes** (src/settings/App.test.tsx):
       - Test: "preserves user changes when external config update arrives"
       - Test: "updates config when external change arrives with no dirty state"

    Total tests: 32 (up from 17)

    All 931 tests pass. All quality checks pass.
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
