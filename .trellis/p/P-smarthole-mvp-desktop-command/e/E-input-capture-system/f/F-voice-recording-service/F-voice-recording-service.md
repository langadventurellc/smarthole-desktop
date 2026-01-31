---
id: F-voice-recording-service
title: Voice Recording Service
status: done
priority: high
parent: E-input-capture-system
prerequisites:
  - F-global-hotkey-system
affectedFiles:
  src/types/audio.ts: Created new file with AudioCaptureState enum,
    AudioCapturePermission enum, AudioBuffer, AudioCaptureConfig (with
    DEFAULT_AUDIO_CAPTURE_CONFIG), AudioCaptureResult, AudioPermissionStatus
    interfaces, AudioCaptureEvents interface with all event types, and type
    guards (isAudioCaptureState, isAudioCapturePermission, isAudioFormat,
    isAudioBuffer, isAudioCaptureResult, isAudioPermissionStatus,
    isAudioErrorCode, isAudioStateChangedEvent, isAudioPermissionChangedEvent)
  src/types/ipc.ts: Added import for audio types, added 6 new IPC channels
    (AUDIO_START, AUDIO_STOP, AUDIO_DATA, AUDIO_PERMISSION_GET,
    AUDIO_PERMISSION_CHANGED, AUDIO_STATE_CHANGED), added AudioStartPayload and
    AudioDataPayload interfaces, re-exported AudioStateChangedEvent and
    AudioPermissionChangedEvent, updated IpcPayloadMap with audio channels,
    updated IpcResponseMap with AUDIO_PERMISSION_GET response type
  src/types/index.ts: Added export for audio types module
  src/types/audio.test.ts: Created new file with 47 unit tests for all audio type guards
  src/types/ipc.test.ts: Added test for audio capture channels, updated channel count from 26 to 32
  src/renderer/index.ts: Created barrel export file with documentation comment
    explaining the directory purpose - holds renderer-side modules that use
    browser/Web APIs and run in renderer context; Updated barrel export to
    include all audio capture module exports
  src/services/audio-capture.ts: Created main process audio capture service with
    singleton pattern, recording lifecycle management (start/stop/isRecording),
    macOS permission checking, push-to-talk and toggle mode support,
    handleAudioData for receiving audio from renderer, and EventEmitter for
    state/permission/audioReady/error events
  src/services/audio-capture.test.ts: Created 24 unit tests covering singleton
    management, recording lifecycle, audio data handling, voice input modes,
    permission status, permission denied scenarios, event subscription, and
    reset functionality
  src/ipc/audio-handler.ts: Created IPC handlers including broadcast functions
    (broadcastAudioStateChanged, broadcastAudioPermissionChanged,
    broadcastAudioStart, broadcastAudioStop), createAudioDataHandler for
    AUDIO_DATA channel, createAudioPermissionHandler for AUDIO_PERMISSION_GET
    channel, wireAudioCaptureToIpc, wireAudioCaptureToHotkey, and
    registerAudioHandlers
  src/ipc/audio-handler.test.ts: Created 20 unit tests covering broadcast
    functions, handler creators, IPC wiring, and hotkey integration for both
    push-to-talk and toggle modes
  src/services/index.ts: Added export for audio-capture service
  src/ipc/index.ts: Added export for audio-handler
  src/renderer/audio-capture.ts: Created renderer-side audio capture module with
    MediaRecorder-based recording, WAV encoding, audio resampling (48kHz to
    16kHz), stereo to mono conversion, permission checking, and
    AudioCaptureError class
  src/renderer/audio-capture.test.ts: Created 20 unit tests for WAV encoding,
    resampling, mono conversion, configuration, state management, and error
    handling
  src/preload.ts: "Added audio capture API methods: getAudioPermission(),
    sendAudioData(), onAudioStateChanged(), onAudioPermissionChanged(),
    onAudioStart(), onAudioStop(). Added required type imports."
  src/main.ts: Added audio capture service initialization, IPC wiring, hotkey
    integration, audioReady event handling, and cleanup in will-quit handler.
    Added audioState tracking object and required imports.
log:
  - >-
    Started feature implementation. Created feature branch
    feature/F-voice-recording-service.


    Execution order based on prerequisites:

    1. T-add-audio-types-and-ipc (no prerequisites)

    2. T-create-srcrenderer-directory (no prerequisites) 

    3. T-implement-main-process-audio (depends on #1)

    4. T-implement-renderer-side-audio (depends on #1 and #2)

    5. T-add-audio-capture-preload-api (depends on #3 and #4)


    Starting with T-add-audio-types-and-ipc first.
  - >-
    Completed first two tasks:

    1. T-add-audio-types-and-ipc - Created audio types, IPC channels, and 47
    unit tests

    2. T-create-srcrenderer-directory - Created src/renderer directory structure


    Both commits made. Now starting T-implement-main-process-audio.
  - >-
    Completed tasks 3 and 4:

    3. T-implement-main-process-audio - Main process audio service with
    push-to-talk/toggle modes, IPC handlers, 44 unit tests

    4. T-implement-renderer-side-audio - Renderer-side capture with
    MediaRecorder, WAV encoding, resampling, 20 unit tests


    All 772 tests pass. Starting final task T-add-audio-capture-preload-api.
  - "Auto-completed: All child tasks are complete"
  - >-
    Documentation updated for voice recording service:


    1. Created
    `/Users/zach/code/smarthole-desktop/docs/voice-recording-service.md` -
    Comprehensive documentation covering:
       - Architecture overview with ASCII diagram
       - AudioCaptureService (main process) API and events
       - Renderer audio capture module functions
       - IPC channel definitions
       - Renderer API via electronAPI
       - Complete type definitions (AudioCaptureState, AudioBuffer, etc.)
       - Hotkey integration (push-to-talk and toggle modes)
       - Platform-specific notes (macOS permissions, Windows)
       - Audio format specifications (16kHz, mono, WAV)
       - Wiring instructions for main.ts
       - Error handling guidance

    2. Updated `/Users/zach/code/smarthole-desktop/CLAUDE.md`:
       - Added `src/renderer/` to project structure
       - Added `audio-capture` to services list
       - Added Voice Recording Service to Detailed Documentation section

    3. Updated
    `/Users/zach/code/smarthole-desktop/docs/global-hotkey-system.md`:
       - Updated architecture diagram to show AudioCapture service
       - Added "Audio Capture Integration" section explaining voiceInput hotkey wiring
  - |-
    All 5 tasks completed:
    1. T-add-audio-types-and-ipc - Audio types and IPC channels
    2. T-create-srcrenderer-directory - src/renderer directory structure
    3. T-implement-main-process-audio - Main process audio service
    4. T-implement-renderer-side-audio - Renderer-side audio capture
    5. T-add-audio-capture-preload-api - Preload API and main.ts wiring

    Documentation created/updated:
    - Created docs/voice-recording-service.md
    - Updated CLAUDE.md
    - Updated docs/global-hotkey-system.md

    Feature implementation complete.
  - >-
    Review remediation completed:


    1. **InputStateService integration** (gap fix):
       - Added import for `getInputState` and `InputState` in audio-capture.ts
       - `startRecording()` now transitions InputState to RECORDING
       - `stopRecording()` now transitions InputState to PROCESSING
       - `handleAudioData()` now transitions InputState to IDLE
       - Added 4 new unit tests for InputState integration

    2. **Removed unused `recordingStartedAt` field** (dead code):
       - Removed field from AudioCaptureServiceImpl class
       - Removed assignments in startRecording, handleAudioData, reset

    3. **Fixed error fallback using string literal**:
       - Changed `"unknown"` to `AudioCapturePermission.UNKNOWN` in createAudioPermissionHandler

    All 776 tests pass. Quality checks pass.
schema: v1.0
childrenIds:
  - T-add-audio-capture-preload-api
  - T-add-audio-types-and-ipc
  - T-create-srcrenderer-directory
  - T-implement-main-process-audio
  - T-implement-renderer-side-audio
created: 2026-01-30T22:15:08.998Z
updated: 2026-01-30T22:15:08.998Z
---

# Voice Recording Service

## Purpose

Implement microphone audio capture that records user speech for transcription. This service captures audio when triggered by the hotkey system, manages recording state, and produces audio data in a format suitable for Whisper STT input.

## Scope

### Audio Capture

- **Microphone access** using Web Audio API (`navigator.mediaDevices.getUserMedia`) in renderer process
- **Audio format**: 16kHz sample rate, mono channel, suitable for Whisper
- **Buffer management**: Collect audio chunks during recording session
- **Output format**: WAV or raw PCM data ready for STT service

### Recording Modes

- **Push-to-talk mode**: Recording starts on hotkey down, stops on hotkey up
- **Toggle mode**: Recording starts on first hotkey press, stops on second press
- Mode determined by `VoiceInputMode` from config (already defined in `src/types/config.ts`)

### State Integration

- **Subscribe to hotkey events** from F-global-hotkey-system
- **Update input state** when recording starts/stops
- **Emit audio data** when recording completes for downstream processing

### Platform Considerations

- **macOS microphone permission**: Request permission on first use, handle denial gracefully
- **Windows**: Standard microphone access through browser APIs
- **Permission state tracking**: Remember if permission was granted/denied

### IPC Integration

- **IPC channels**:
  - `audio:start` - renderer → main or main → renderer to trigger recording
  - `audio:stop` - stop current recording
  - `audio:data` - renderer → main with captured audio buffer
  - `audio:permissionStatus` - query/report microphone permission state
- **Preload API** additions for audio control

## Technical Approach

1. **Renderer-side capture**: Audio capture happens in renderer using Web Audio API (better browser compatibility)
2. **MediaRecorder API**: Use for capturing audio chunks
3. **AudioContext**: For any audio processing/resampling needed
4. **IPC for coordination**: Main process coordinates via IPC, renderer does actual capture
5. **Service pattern**: `initializeAudioCapture()` / `getAudioCapture()` in main, companion code in renderer

## Files to Create/Modify

- `src/services/audio-capture.ts` - Main process audio service (coordination)
- `src/renderer/audio-capture.ts` - Renderer-side audio capture logic
- `src/services/index.ts` - Export audio service
- `src/types/ipc.ts` - Add audio IPC channels
- `src/types/audio.ts` - Audio-related types (AudioBuffer, RecordingState, etc.)
- `src/types/index.ts` - Export audio types
- `src/ipc/audio-handler.ts` - IPC handlers for audio
- `src/ipc/index.ts` - Export audio handlers
- `src/preload.ts` - Add audio APIs
- `src/main.ts` - Initialize audio service, wire to hotkey events

## Dependencies

- **F-global-hotkey-system**: Subscribes to hotkey events to start/stop recording
- **No new npm packages**: Uses built-in Web Audio API

## Acceptance Criteria

1. [ ] Microphone audio captured successfully on macOS and Windows
2. [ ] Push-to-talk mode: hold hotkey records, release stops
3. [ ] Toggle mode: press starts, press again stops
4. [ ] Audio output at 16kHz minimum sample rate
5. [ ] Audio format suitable for Whisper input (WAV or PCM)
6. [ ] macOS microphone permission requested on first use
7. [ ] Permission denial handled gracefully with user notification
8. [ ] Recording state reflected in input state service
9. [ ] Audio data emitted for downstream STT processing
10. [ ] No audio captured when permission denied

## Testing Requirements

- Unit tests for recording state logic
- Unit tests for IPC handlers
- Manual testing required for actual audio capture (hardware-dependent)

## Security Considerations

- Only capture audio when explicitly triggered by user (hotkey)
- Clear audio buffers after processing (don't retain voice data)
- Respect system privacy settings for microphone access

## Performance Requirements

- Recording starts within 100ms of hotkey activation
- Audio capture at sufficient quality (16kHz minimum)
- Minimal CPU usage during recording
- Memory-efficient buffer management for longer recordings
