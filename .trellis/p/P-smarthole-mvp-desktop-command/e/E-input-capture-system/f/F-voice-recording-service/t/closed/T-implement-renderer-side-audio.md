---
id: T-implement-renderer-side-audio
title: Implement renderer-side audio capture
status: done
priority: high
parent: F-voice-recording-service
prerequisites:
  - T-add-audio-types-and-ipc
  - T-create-srcrenderer-directory
affectedFiles:
  src/renderer/audio-capture.ts: Created renderer-side audio capture module with
    MediaRecorder-based recording, WAV encoding, audio resampling (48kHz to
    16kHz), stereo to mono conversion, permission checking, and
    AudioCaptureError class
  src/renderer/audio-capture.test.ts: Created 20 unit tests for WAV encoding,
    resampling, mono conversion, configuration, state management, and error
    handling
  src/renderer/index.ts: Updated barrel export to include all audio capture module exports
log:
  - >-
    Implementation completed:


    1. Created `src/renderer/audio-capture.ts` with:
       - AudioCaptureError class for typed error handling
       - WAV encoding utilities (writeString, encodeWav) - pure functions for creating WAV files
       - Audio resampling (resampleAudio) - linear interpolation for sample rate conversion
       - Stereo to mono conversion (convertToMono)
       - startRecording() - requests mic via getUserMedia, creates MediaRecorder
       - stopRecording() - stops recording, decodes audio, resamples to 16kHz, encodes as WAV
       - cancelRecording() - aborts without processing
       - getPermissionStatus() - queries navigator.permissions API
       - isRecording(), isSupported(), getConfig(), setConfig(), reset() helpers

    2. Updated `src/renderer/index.ts` to export all audio capture functions


    3. Created `src/renderer/audio-capture.test.ts` with 20 unit tests for:
       - WAV header and sample encoding
       - Sample clamping
       - Audio resampling (downsampling/upsampling)
       - Stereo to mono conversion
       - Configuration management
       - State management
       - AudioCaptureError class

    All quality checks pass. All 772 tests pass.
  - Implemented renderer-side audio capture module using Web Audio API. The
    module captures microphone audio via MediaRecorder, resamples from browser's
    native rate (typically 48kHz) to 16kHz for Whisper STT compatibility,
    converts stereo to mono, and encodes as 16-bit PCM WAV format. Includes
    proper error handling with typed AudioCaptureError, permission checking via
    navigator.permissions API, and clean resource management. All 20 unit tests
    pass covering WAV encoding, resampling, and state management.
schema: v1.0
childrenIds: []
created: 2026-01-31T00:54:24.430Z
updated: 2026-01-31T00:54:24.430Z
---

# Implement Renderer-Side Audio Capture

## Purpose

Implement microphone audio capture in the renderer process using the Web Audio API. This is where the actual audio recording happens, as the browser APIs for media capture are only available in renderer processes.

## Scope

### Audio Capture Module (`src/renderer/audio-capture.ts`)

- Use `navigator.mediaDevices.getUserMedia()` for microphone access
- Use `MediaRecorder` API for capturing audio chunks
- Configure for 16kHz sample rate, mono channel
- Buffer audio chunks during recording session
- Convert to WAV format suitable for Whisper STT

### Functionality

1. **Start recording**
   - Request microphone access if not already granted
   - Create MediaRecorder with appropriate MIME type
   - Start collecting audio chunks

2. **Stop recording**
   - Stop MediaRecorder
   - Combine audio chunks into single buffer
   - Convert to WAV format
   - Return audio data via callback or event

3. **Permission handling**
   - Check current permission state via `navigator.permissions.query()`
   - Handle permission denial gracefully
   - Track permission state changes

### Audio Processing

- Target: 16kHz sample rate, mono, 16-bit PCM (or compatible WAV)
- Use `AudioContext` for resampling if needed (browsers may capture at 48kHz)
- Memory-efficient chunking for longer recordings

### Export Interface

```typescript
interface RendererAudioCapture {
  startRecording(): Promise<void>;
  stopRecording(): Promise<AudioCaptureResult>;
  getPermissionStatus(): Promise<AudioCapturePermission>;
  isRecording(): boolean;
}
```

## Technical Constraints

- Must run in renderer process (browser APIs)
- Uses types from `T-add-audio-types-and-ipc`
- No external npm packages - use built-in Web Audio API
- Clear buffers after use for privacy

## Acceptance Criteria

1. [ ] Audio capture module created at `src/renderer/audio-capture.ts`
2. [ ] Microphone audio captured at 16kHz or higher
3. [ ] Audio output in WAV format suitable for Whisper
4. [ ] Permission request on first use
5. [ ] Permission denial handled without crashes
6. [ ] Recording starts within 100ms of trigger
7. [ ] Memory-efficient buffer management
8. [ ] Unit tests for non-hardware-dependent logic
