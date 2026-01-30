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
    handling
  src/services/hotkey-manager.test.ts: Added unit tests for initialization,
    registration, event emission, unregistration, and accessibility permissions
  src/services/index.ts: Added export for hotkey-manager module
  package.json: Added uiohook-napi dependency (via npm install)
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
