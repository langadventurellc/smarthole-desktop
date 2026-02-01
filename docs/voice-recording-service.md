# Voice Recording Service

Microphone audio capture for speech-to-text processing with push-to-talk and toggle mode support.

## Overview

The voice recording service provides:

- **Microphone audio capture** using Web Audio API in the renderer process
- **WAV encoding** at 16kHz mono for Whisper STT compatibility
- **Push-to-talk and toggle modes** integrated with the hotkey system
- **macOS microphone permission handling** via `systemPreferences` API
- **IPC coordination** between main process state and renderer audio capture

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  HotkeyManager  │────▶│  AudioCapture    │────▶│   IPC Handlers  │
│    Service      │     │    Service       │     │  (audio-handler)│
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Renderer Audio  │◀────│    Preload      │
                        │   Capture Module │     │  (electronAPI)  │
                        └──────────────────┘     └─────────────────┘
```

The service uses a split architecture:

1. **Main process (`AudioCaptureService`)**: Coordinates recording state, checks permissions, emits events
2. **Background window (`src/background/`)**: Hidden BrowserWindow that stays alive to receive audio IPC events
3. **Renderer audio module (`src/audio/`)**: Captures audio using Web Audio API in the background window
4. **IPC bridge**: Broadcasts start/stop commands to all windows, receives audio data back

### Background Window

Since SmartHole runs as a tray app with no persistent visible windows, a hidden background window provides the renderer context needed for Web Audio API-based capture. The background window:

- Is created at app startup (`initializeBackgroundWindow()`)
- Stays hidden (`show: false`, `skipTaskbar: true`)
- Listens for `audio:start` and `audio:stop` IPC events via preload
- Uses `src/audio/audio-capture.ts` to record and encode audio
- Sends captured audio back via `electronAPI.sendAudioData()`

## Services

### AudioCaptureService (Main Process)

Location: `src/services/audio-capture.ts`

Coordinates audio recording lifecycle and manages state.

**Initialization:**

```typescript
import { initializeAudioCapture, getAudioCapture } from "./services/audio-capture";

// Inside app.whenReady()
const audioCapture = initializeAudioCapture();

// Check if recording
if (audioCapture.isRecording()) {
  // ...
}

// Get current state
const state = audioCapture.getState(); // "idle" | "recording" | "stopped" | "error"

// Get/set voice input mode
audioCapture.setMode("toggle"); // or "push-to-talk"
const mode = audioCapture.getMode();
```

**Events:**

| Event               | Payload                       | Description                              |
| ------------------- | ----------------------------- | ---------------------------------------- |
| `audioReady`        | `AudioReadyEvent`             | Emitted when audio data is ready for STT |
| `stateChanged`      | `AudioStateChangedEvent`      | Emitted on capture state transitions     |
| `permissionChanged` | `AudioPermissionChangedEvent` | Emitted when mic permission changes      |
| `error`             | `AudioErrorEvent`             | Emitted on capture errors                |

**State Machine:**

```
┌────────┐     ┌───────────┐     ┌─────────┐
│  IDLE  │────▶│ RECORDING │────▶│ STOPPED │
└────────┘     └───────────┘     └────┬────┘
     ▲                                │
     └────────────────────────────────┘
            (audio data received)
```

| State       | Description                             |
| ----------- | --------------------------------------- |
| `idle`      | Ready to start recording                |
| `recording` | Actively capturing microphone input     |
| `stopped`   | Recording ended, waiting for audio data |
| `error`     | An error occurred during capture        |

### Background Window Manager (Main Process)

Location: `src/windows/background-window.ts`

Manages the hidden window lifecycle for audio capture.

**Initialization:**

```typescript
import { initializeBackgroundWindow, getBackgroundWindow } from "./windows/background-window";

// Inside app.whenReady(), before audio capture
const backgroundWindow = initializeBackgroundWindow();

// Check if ready (window loaded)
if (backgroundWindow.isReady()) {
  // Safe to start recording
}

// Wait for window to be ready
await backgroundWindow.waitForReady();
```

### Renderer Audio Capture Module

Location: `src/audio/audio-capture.ts`

Captures microphone audio using Web Audio API and encodes to WAV format.

**Functions:**

```typescript
import * as audioCapture from "./audio";

// Check browser support
if (audioCapture.isSupported()) {
  // Start recording
  await audioCapture.startRecording();

  // Stop and get audio data
  const result = await audioCapture.stopRecording();
  // result.audio.data is an ArrayBuffer containing WAV data

  // Cancel without getting data
  audioCapture.cancelRecording();
}

// Check permission status
const permission = await audioCapture.getPermissionStatus();
// "granted" | "denied" | "prompt" | "unknown"

// Configure audio format
audioCapture.setConfig({
  sampleRate: 16000,
  channels: 1,
  format: "wav",
});
```

**Audio Processing:**

1. Captures audio via `navigator.mediaDevices.getUserMedia()`
2. Uses `MediaRecorder` with webm/opus codec (best available)
3. Decodes to `AudioBuffer` for processing
4. Converts to mono (averaging channels)
5. Resamples to 16kHz (linear interpolation)
6. Encodes to 16-bit PCM WAV format

## IPC Channels

| Channel                    | Direction        | Payload                       | Description                 |
| -------------------------- | ---------------- | ----------------------------- | --------------------------- |
| `audio:start`              | Main -> Renderer | `AudioStartPayload?`          | Signal to start recording   |
| `audio:stop`               | Main -> Renderer | `void`                        | Signal to stop recording    |
| `audio:data`               | Renderer -> Main | `AudioDataPayload`            | Captured audio result       |
| `audio:permission:get`     | Renderer -> Main | `AudioPermissionStatus`       | Query mic permission status |
| `audio:permission:changed` | Main -> Renderer | `AudioPermissionChangedEvent` | Mic permission changed      |
| `audio:stateChanged`       | Main -> Renderer | `AudioStateChangedEvent`      | Capture state changed       |

## Renderer API

The preload script exposes these methods via `window.electronAPI`:

### Audio Methods

```typescript
// Get microphone permission status
const status = await electronAPI.getAudioPermission();
// Returns: { permission: "granted" | "denied" | "prompt" | "unknown", canRequest: boolean }

// Send captured audio to main process
electronAPI.sendAudioData(result);

// Listen for state changes
const unsub = electronAPI.onAudioStateChanged((event) => {
  console.log(`State: ${event.previousState} -> ${event.newState}`);
});

// Listen for permission changes
const unsub = electronAPI.onAudioPermissionChanged((permission) => {
  console.log("Permission now:", permission);
});

// Listen for start/stop commands from main
const unsub = electronAPI.onAudioStart(() => {
  // Begin capturing audio
});

const unsub = electronAPI.onAudioStop(() => {
  // Stop capturing and send data
});
```

## Types

### AudioCaptureState

```typescript
const AudioCaptureState = {
  IDLE: "idle",
  RECORDING: "recording",
  STOPPED: "stopped",
  ERROR: "error",
} as const;
```

### AudioCapturePermission

```typescript
const AudioCapturePermission = {
  GRANTED: "granted",
  DENIED: "denied",
  PROMPT: "prompt",
  UNKNOWN: "unknown",
} as const;
```

### AudioBuffer

```typescript
interface AudioBuffer {
  data: ArrayBuffer; // WAV or PCM audio data
  format: "wav" | "pcm";
  sampleRate: number; // e.g., 16000
  channels: number; // 1 for mono
  durationMs: number; // Audio duration in milliseconds
}
```

### AudioCaptureResult

```typescript
interface AudioCaptureResult {
  audio: AudioBuffer;
  startedAt: string; // ISO 8601 timestamp
  stoppedAt: string; // ISO 8601 timestamp
}
```

### AudioCaptureConfig

```typescript
interface AudioCaptureConfig {
  sampleRate: number; // Default: 16000
  channels: number; // Default: 1
  format: "wav" | "pcm"; // Default: "wav"
}
```

### AudioStateChangedEvent

```typescript
interface AudioStateChangedEvent {
  previousState: AudioCaptureState;
  newState: AudioCaptureState;
  timestamp: number;
  error?: string; // Present if newState is "error"
}
```

### AudioReadyEvent

```typescript
interface AudioReadyEvent {
  result: AudioCaptureResult;
}
```

### AudioErrorCode

```typescript
type AudioErrorCode =
  | "PERMISSION_DENIED" // Microphone access denied
  | "DEVICE_NOT_FOUND" // No microphone detected
  | "CAPTURE_FAILED" // Recording failed to start
  | "ENCODING_FAILED" // WAV encoding failed
  | "UNKNOWN";
```

## Hotkey Integration

The audio capture service integrates with the global hotkey system via `wireAudioCaptureToHotkey()`:

```typescript
import { wireAudioCaptureToHotkey } from "./ipc/audio-handler";

// After initializing both services
wireAudioCaptureToHotkey(hotkeyManager, getAudioCapture, logger);
```

**Push-to-talk mode:**

- `hotkey:activated` (voiceInput) -> Start recording, broadcast `audio:start`
- `hotkey:released` (voiceInput) -> Stop recording, broadcast `audio:stop`

**Toggle mode:**

- First `hotkey:activated` -> Start recording, broadcast `audio:start`
- Second `hotkey:activated` -> Stop recording, broadcast `audio:stop`

## Platform Notes

### macOS

- **Microphone permissions required**: The app checks/prompts via `systemPreferences.getMediaAccessStatus("microphone")`
- Permission states: `granted`, `denied`, `restricted`, `not-determined`
- First recording attempt triggers browser permission dialog

### Windows

- No special permissions required at OS level
- Browser handles microphone permission prompting

## Audio Format

The default configuration produces audio suitable for Whisper STT:

| Property    | Value             |
| ----------- | ----------------- |
| Sample Rate | 16,000 Hz (16kHz) |
| Channels    | 1 (mono)          |
| Bit Depth   | 16-bit            |
| Format      | WAV (PCM)         |

## Wiring to Main Process

Complete setup in `main.ts`:

```typescript
import { initializeBackgroundWindow } from "./windows/background-window";
import { initializeAudioCapture, getAudioCapture } from "./services/audio-capture";
import {
  registerAudioHandlers,
  wireAudioCaptureToIpc,
  wireAudioCaptureToHotkey,
  broadcastAudioStart,
  broadcastAudioStop,
} from "./ipc/audio-handler";

// Initialize background window FIRST (needed for audio capture)
const backgroundWindow = initializeBackgroundWindow();

// Initialize the audio capture service
const audioCapture = initializeAudioCapture();

// Wire to IPC for state/permission broadcasts
wireAudioCaptureToIpc(audioCapture, logger);

// Wire to hotkey manager for voice input activation
wireAudioCaptureToHotkey(hotkeyManager, getAudioCapture, logger);

// Register IPC handlers
registerAudioHandlers(ipcMain, getAudioCapture, logger);

// Listen for audio ready events
audioCapture.on("audioReady", (event) => {
  // Route to STT processing
  console.log("Audio ready:", event.result.audio.durationMs, "ms");
});
```

**Important:** The background window must be initialized before audio capture to ensure there's a renderer to receive IPC events. Tray menu handlers must call `broadcastAudioStart()` and `broadcastAudioStop()` after calling the audio capture service methods.

## Error Handling

Handle errors via the `error` event:

```typescript
audioCapture.on("error", (event) => {
  switch (event.code) {
    case "PERMISSION_DENIED":
      // Prompt user to enable microphone access
      break;
    case "DEVICE_NOT_FOUND":
      // No microphone available
      break;
    case "CAPTURE_FAILED":
    case "ENCODING_FAILED":
      // Recording/encoding error
      break;
  }
});
```

## Dependencies

- **Web Audio API**: Browser-native audio capture and processing
- **MediaRecorder API**: Audio recording with codec selection
- **Electron systemPreferences**: macOS permission checking
