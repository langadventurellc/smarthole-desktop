---
id: F-voice-recording-service
title: Voice Recording Service
status: open
priority: high
parent: E-input-capture-system
prerequisites:
  - F-global-hotkey-system
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
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
