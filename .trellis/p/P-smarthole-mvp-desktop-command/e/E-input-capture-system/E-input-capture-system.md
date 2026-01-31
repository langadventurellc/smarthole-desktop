---
id: E-input-capture-system
title: Input Capture System
status: in-progress
priority: high
parent: P-smarthole-mvp-desktop-command
prerequisites:
  - E-foundation-core-infrastructure
affectedFiles:
  src/services/hotkey-manager.ts: Created hotkey manager service with singleton
    pattern, EventEmitter for events, Electron globalShortcut integration,
    uiohook-napi for key up detection, and macOS accessibility permission
    handling; Refactored to use lazy loading for uiohook-napi - removed
    top-level import, added loadUiohook() for dynamic import,
    buildAcceleratorToKeycodeMap() for lazy keycode map creation,
    setupUiohookListeners() called lazily after first registerHotkeys() call
  src/services/hotkey-manager.test.ts: Added unit tests for initialization,
    registration, event emission, unregistration, and accessibility permissions
  src/services/index.ts: Added export for hotkey-manager module; Added export for
    input-state service module
  package.json: Added uiohook-napi dependency (via npm install)
  src/types/input.ts: "Created input state types: InputState enum, InputStateInfo
    interface, InputStateChangedEvent, InputModeChangedEvent, and
    InputStateEvents interface"
  src/types/index.ts: Added export for input types module
  src/services/input-state.ts: Created InputStateService with singleton pattern,
    validated state machine, EventEmitter for events, mode tracking
  src/services/input-state.test.ts: Added unit tests for state machine
    transitions, event emission, mode changes, and getStateInfo
  src/types/ipc.ts: Added 4 new IPC channels (HOTKEY_ACTIVATED, HOTKEY_RELEASED,
    INPUT_STATE_CHANGED, INPUT_GET_STATE), imported and re-exported hotkey and
    input state types, updated IpcPayloadMap and IpcResponseMap; Added 5 text
    input popup IPC channels, TextInputSubmitPayload and TextInputOpenPayload
    interfaces, updated IpcPayloadMap with new channel mappings, added
    isTextInputSubmitPayload type guard
  src/ipc/hotkey-handler.ts: Created new IPC handler with
    broadcastHotkeyActivated, broadcastHotkeyReleased, and
    wireHotkeyManagerToIpc functions
  src/ipc/input-state-handler.ts: Created new IPC handler with
    broadcastInputStateChanged, createInputStateHandler, and wireInputStateToIpc
    functions
  src/ipc/index.ts: Added exports for hotkey-handler and input-state-handler
    modules; Added export for text-input-handler module
  src/preload.ts: Added onHotkeyActivated, onHotkeyReleased, getInputState, and
    onInputStateChanged APIs to electronAPI
  src/main.ts: Added imports for services and handlers, initialized hotkey manager
    and input state service, wired events to IPC broadcasts and state
    transitions, added cleanup in will-quit handler; Added popup service
    imports, popupState tracking, TextInputPopup initialization, IPC handler
    registration, hotkey wiring, and submitted event subscription
  src/types/ipc.test.ts: Updated channel count test from 17 to 21, added tests for
    new hotkey and input state channels; Added tests for new text input popup
    channels, TextInputSubmitPayload type guard tests, TextInputOpenPayload
    interface tests, updated channel count test from 21 to 26, updated naming
    convention regex to allow camelCase domains
  src/types/hotkey.ts: Created new types file for hotkey event types (HotkeyType,
    HotkeyActivatedEvent, HotkeyReleasedEvent, HotkeyErrorCode,
    HotkeyErrorEvent) to avoid circular dependency between types and services
  docs/global-hotkey-system.md: Created comprehensive documentation for the global
    hotkey system covering architecture, services (HotkeyManager, InputState),
    IPC channels, renderer API, types, configuration, platform notes, and error
    handling
  CLAUDE.md: Updated services list to include hotkey-manager and input-state;
    added link to global-hotkey-system.md in Detailed Documentation section
  src/windows/text-input-popup.ts: Created singleton service with
    TextInputPopupService interface, show/hide methods, screen positioning via
    calculateCenteredPosition(), focus management, EventEmitter for callbacks,
    path resolution for preload/popup URL, and app cleanup handlers
  src/windows/index.ts: Created module exports for TextInputPopupService,
    functions (initialize, get, reset, getImpl), calculateCenteredPosition, and
    event types
  src/windows/text-input-popup.test.ts: Added 20 unit tests covering singleton
    lifecycle, show (positioning, focus, placeholder, events), hide (window,
    input clearing, focus restoration), isVisible, event
    subscription/unsubscription, and getWindow accessor
  src/preload-popup.ts: Created preload script with PopupAPI exposing submit,
    dismiss, notifyFocused methods and onPlaceholderChange, onClear event
    listeners via contextBridge
  src/popup/index.html: Created minimal HTML entry point for popup window with
    module script reference
  src/popup/popup.tsx: Created React component with auto-focus, keyboard handling
    (Enter submits, Escape dismisses), placeholder/clear subscriptions
  src/popup/popup.css: Created Spotlight-like styling with semi-transparent
    background, blur, dark mode and high contrast support
  src/types/electron.d.ts: Added PopupAPI type import and Window.popupAPI
    declaration for type-safe popup renderer code
  src/ipc/text-input-handler.ts: Created IPC handlers for text input popup
    (createTextInputSubmitHandler, createTextInputDismissedHandler,
    createTextInputFocusedHandler, wireTextInputToHotkey,
    registerTextInputHandlers)
  src/ipc/text-input-handler.test.ts: Created 10 unit tests for submit handler
    validation, dismissed handler, focused handler, and hotkey wiring scenarios
log: []
schema: v1.0
childrenIds:
  - F-global-hotkey-system
  - F-text-input-popup-window
  - F-tray-input-integration
  - F-voice-recording-service
created: 2026-01-29T01:44:22.850Z
updated: 2026-01-29T01:44:22.850Z
---

# Input Capture System

## Purpose and Goals

Implement all user input mechanisms for SmartHole: global hotkey registration, voice recording capture, and text input popup window. This epic handles how users initiate interactions with the system, capturing their intent via voice or text before it's processed by other components.

## Major Components and Deliverables

### 1. Global Hotkey Manager

- System-wide hotkey registration (works even when app not focused)
- Cross-platform support (macOS, Windows)
- Configurable hotkey bindings
- Hotkey conflict detection and handling
- Support for modifier keys (Cmd/Ctrl, Shift, Alt/Option)

### 2. Voice Recording

- Microphone audio capture using Web Audio API or native bindings
- Push-to-talk mode (hold hotkey to record, release to stop)
- Toggle mode (press to start recording, press again to stop)
- Audio buffer management for streaming to STT
- Recording state management and visual feedback
- Audio format: PCM/WAV suitable for Whisper input

### 3. Text Input Popup

- Minimal floating window (Spotlight/Alfred-style)
- Opens via dedicated hotkey or tray menu action
- Single text field with placeholder text
- Submit on Enter, dismiss on Escape
- Auto-dismiss after sending
- Window positioning (center screen or near cursor)
- Focus management (steal focus on open, return on close)

### 4. Tray Menu Integration

- Enhance existing tray menu with input options
- "Open Text Input" menu item
- "Start Recording" / "Stop Recording" toggle
- Visual indicator of current state (recording, processing)

### 5. Input State Management

- Centralized state for recording status, input mode
- State transitions with validation
- Event emission for state changes (used by other components)

## Technical Considerations

- Evaluate hotkey libraries: `electron-global-shortcut` (built-in), `uiohook-napi`, or similar
- Audio capture: Electron's `desktopCapturer` or `navigator.mediaDevices.getUserMedia`
- Text popup: BrowserWindow with frameless, alwaysOnTop settings
- Consider accessibility permissions requirement on macOS for global hotkeys

## Dependencies

- **E-foundation-core-infrastructure**: Logging, error handling, IPC patterns, types

## Estimated Scale

4-5 features covering hotkey manager, voice recording, text popup, tray integration, and state management

## User Stories

- As a user, I can press a global hotkey to start voice recording from any application
- As a user, I can hold the hotkey to record (push-to-talk) or toggle recording on/off
- As a user, I can open a quick text input popup to type my command
- As a user, I can see in the tray icon when the app is recording or processing
- As a user, I receive feedback (visual/audio) when recording starts and stops

## Non-Functional Requirements

- Hotkey response time < 100ms from keypress to recording start
- Audio capture at sufficient quality for accurate STT (16kHz minimum)
- Text popup opens within 200ms of hotkey press
- Minimal CPU usage when idle (not recording)

## Acceptance Criteria

1. [ ] Global hotkey registration works on macOS and Windows
2. [ ] Hotkey triggers voice recording when app is not focused
3. [ ] Push-to-talk mode: hold to record, release to stop
4. [ ] Toggle mode: press to start, press again to stop
5. [ ] Audio is captured from system microphone
6. [ ] Audio format suitable for Whisper STT input
7. [ ] Text input popup opens via hotkey
8. [ ] Text popup submits on Enter, dismisses on Escape
9. [ ] Tray menu includes input options
10. [ ] Tray icon reflects current state (idle, recording, processing)
11. [ ] Recording start/stop notifications displayed to user
12. [ ] Microphone permission requested on first use (macOS)
