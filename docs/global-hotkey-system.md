# Global Hotkey System

System-wide keyboard shortcuts for voice and text input activation with push-to-talk and toggle mode support.

## Overview

The global hotkey system provides:

- **System-wide hotkey registration** using Electron's `globalShortcut` API
- **Key up detection** using `uiohook-napi` for push-to-talk mode
- **Input state machine** tracking idle/recording/processing states
- **IPC integration** for renderer process event subscriptions

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  HotkeyManager  │────▶│  IPC Handlers    │────▶│    Renderer     │
│    Service      │     │  (broadcasting)  │     │   (React UI)    │
└────────┬────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  InputState     │
│    Service      │
└─────────────────┘
```

## Services

### HotkeyManager Service

Location: `src/services/hotkey-manager.ts`

Handles registration and detection of global keyboard shortcuts.

**Initialization:**

```typescript
import { initializeHotkeyManager, getHotkeyManager } from "./services/hotkey-manager";

// Inside app.whenReady()
const hotkeyManager = initializeHotkeyManager();

// Register hotkeys from config
await hotkeyManager.registerHotkeys({
  voiceInput: "CommandOrControl+Shift+Space",
  textInput: "CommandOrControl+Shift+T", // optional
});
```

**Events:**

| Event              | Payload                | Description                       |
| ------------------ | ---------------------- | --------------------------------- |
| `hotkey:activated` | `HotkeyActivatedEvent` | Emitted when a hotkey is pressed  |
| `hotkey:released`  | `HotkeyReleasedEvent`  | Emitted when a hotkey is released |
| `error`            | `HotkeyErrorEvent`     | Emitted on registration failure   |

**Key Features:**

- **Lazy loading**: `uiohook-napi` native module is loaded only when `registerHotkeys()` is called
- **macOS accessibility**: Automatically checks and prompts for accessibility permissions
- **Accelerator parsing**: Converts Electron accelerator strings to uiohook keycodes
- **Cleanup**: Automatically unregisters hotkeys on app quit

### InputState Service

Location: `src/services/input-state.ts`

Manages the input lifecycle state machine.

**Initialization:**

```typescript
import { initializeInputState, getInputState } from "./services/input-state";

// Inside app.whenReady()
const inputState = initializeInputState();
```

**State Machine:**

```
     ┌──────────────────────────────────────────┐
     │                                          │
     ▼                                          │
┌─────────┐     ┌───────────┐     ┌────────────┐
│  IDLE   │────▶│ RECORDING │────▶│ PROCESSING │
└─────────┘     └───────────┘     └────────────┘
     ▲               │
     └───────────────┘
         (cancel)
```

| State        | Description                         |
| ------------ | ----------------------------------- |
| `idle`       | Waiting for hotkey activation       |
| `recording`  | Actively capturing voice input      |
| `processing` | Transcribing/routing captured input |

**Events:**

| Event          | Payload                  | Description                     |
| -------------- | ------------------------ | ------------------------------- |
| `stateChanged` | `InputStateChangedEvent` | Emitted on state transitions    |
| `modeChanged`  | `InputModeChangedEvent`  | Emitted when input mode changes |

**Input Modes:**

- `push-to-talk`: Hold hotkey while speaking, release to stop recording
- `toggle`: Press hotkey to start recording, press again to stop

## IPC Channels

### Hotkey Channels

| Channel            | Direction        | Payload                | Description     |
| ------------------ | ---------------- | ---------------------- | --------------- |
| `hotkey:activated` | Main -> Renderer | `HotkeyActivatedEvent` | Hotkey pressed  |
| `hotkey:released`  | Main -> Renderer | `HotkeyReleasedEvent`  | Hotkey released |

### Input State Channels

| Channel              | Direction        | Payload/Response         | Description       |
| -------------------- | ---------------- | ------------------------ | ----------------- |
| `input:stateChanged` | Main -> Renderer | `InputStateChangedEvent` | State transition  |
| `input:getState`     | Renderer -> Main | `InputStateInfo`         | Get current state |

## Renderer API

The preload script exposes these methods via `window.electronAPI`:

### Hotkey Methods

```typescript
// Listen for hotkey activation
const unsubscribe = electronAPI.onHotkeyActivated((event) => {
  console.log(`Hotkey ${event.accelerator} (${event.hotkeyType}) activated`);
});

// Listen for hotkey release (push-to-talk mode)
const unsubscribe = electronAPI.onHotkeyReleased((event) => {
  console.log(`Hotkey ${event.accelerator} (${event.hotkeyType}) released`);
});
```

### Input State Methods

```typescript
// Get current input state
const stateInfo = await electronAPI.getInputState();
// Returns: { state: "idle", mode: "push-to-talk", stateEnteredAt: timestamp }

// Listen for state changes
const unsubscribe = electronAPI.onInputStateChanged((event) => {
  console.log(`State changed: ${event.previousState} -> ${event.newState}`);
});
```

## Types

### HotkeyActivatedEvent

```typescript
interface HotkeyActivatedEvent {
  accelerator: string; // e.g., "CommandOrControl+Shift+Space"
  hotkeyType: "voiceInput" | "textInput";
}
```

### HotkeyReleasedEvent

```typescript
interface HotkeyReleasedEvent {
  accelerator: string;
  hotkeyType: "voiceInput" | "textInput";
}
```

### HotkeyErrorEvent

```typescript
interface HotkeyErrorEvent {
  message: string;
  accelerator?: string;
  code: "REGISTRATION_FAILED" | "ACCESSIBILITY_DENIED" | "UIOHOOK_ERROR";
}
```

### InputStateInfo

```typescript
interface InputStateInfo {
  state: "idle" | "recording" | "processing";
  mode: "push-to-talk" | "toggle";
  stateEnteredAt: number;
  recordingStartedAt?: number;
}
```

### InputStateChangedEvent

```typescript
interface InputStateChangedEvent {
  previousState: InputState;
  newState: InputState;
  timestamp: number;
}
```

## Configuration

Hotkey configuration is part of `AppConfig`:

```typescript
interface HotkeyConfig {
  voiceInput: string; // Required, default: "CommandOrControl+Shift+Space"
  textInput?: string; // Optional separate hotkey for text input
}
```

Voice input mode is also configurable:

```typescript
voiceInputMode: "push-to-talk" | "toggle"; // default: "push-to-talk"
```

## Platform Notes

### macOS

- **Accessibility permissions required**: The app will prompt for accessibility access on first hotkey registration
- Uses `systemPreferences.isTrustedAccessibilityClient()` to check/request permissions
- App may need restart after granting permissions

### Windows

- No special permissions required
- Hotkeys work system-wide without additional setup

## Dependencies

- `electron` - `globalShortcut` API for key down detection
- `uiohook-napi` - Native module for key up detection (lazy-loaded)

## Wiring to IPC

To enable IPC broadcasting, wire the services after initialization:

```typescript
import { wireHotkeyManagerToIpc } from "./ipc/hotkey-handler";
import { wireInputStateToIpc, createInputStateHandler } from "./ipc/input-state-handler";

// After initializing services
wireHotkeyManagerToIpc(hotkeyManager, logger);
wireInputStateToIpc(inputState, logger);

// Register IPC handler for state queries
ipcMain.handle(IPC_CHANNELS.INPUT_GET_STATE, createInputStateHandler(getInputState, logger));
```

## Error Handling

The HotkeyManager emits `error` events for:

- **REGISTRATION_FAILED**: Hotkey already in use by another application
- **ACCESSIBILITY_DENIED**: macOS accessibility permissions not granted
- **UIOHOOK_ERROR**: Failed to load or start the native keyboard hook module

Handle these errors to provide user feedback:

```typescript
hotkeyManager.on("error", (event) => {
  if (event.code === "ACCESSIBILITY_DENIED") {
    // Prompt user to enable accessibility permissions
  } else if (event.code === "REGISTRATION_FAILED") {
    // Notify user that hotkey is in use
  }
});
```
