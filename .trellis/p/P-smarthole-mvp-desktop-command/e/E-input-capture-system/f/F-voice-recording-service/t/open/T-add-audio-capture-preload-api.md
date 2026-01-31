---
id: T-add-audio-capture-preload-api
title: Add audio capture preload API and wire to main
status: open
priority: high
parent: F-voice-recording-service
prerequisites:
  - T-implement-renderer-side-audio
  - T-implement-main-process-audio
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T00:54:53.988Z
updated: 2026-01-31T00:54:53.988Z
---

# Add Audio Capture Preload API and Wire to Main

## Purpose

Extend the preload script to expose audio capture APIs to the renderer, and wire everything together in main.ts for the full audio capture flow to work.

## Scope

### Preload API Additions (`src/preload.ts`)

Add to the `electronAPI` object:

```typescript
// Audio Capture
startAudioCapture: (): Promise<boolean>
stopAudioCapture: (): Promise<void>
sendAudioData: (data: AudioCaptureResult): void
getAudioPermission: (): Promise<AudioCapturePermission>
onAudioStateChanged: (callback: (state: AudioCaptureState) => void): (() => void)
```

### Type Declaration Updates (`src/types/electron.d.ts`)

Update the `ElectronAPI` interface to include audio capture methods.

### Main Process Wiring (`src/main.ts`)

1. Initialize audio capture service in `app.whenReady()`:
   ```typescript
   const audioCapture = initializeAudioCapture();
   ```
2. Wire hotkey events to audio capture:
   - On voice input hotkey activated → start recording based on mode
   - On voice input hotkey released → stop recording (push-to-talk mode)
3. Register audio IPC handlers
4. Wire audio capture events to input state service

### Integration Flow

1. User presses voice hotkey
2. HotkeyManager emits `hotkey:activated`
3. Main process triggers audio capture start via IPC
4. Renderer starts MediaRecorder and captures audio
5. User releases hotkey (push-to-talk) or presses again (toggle)
6. Main process triggers audio capture stop via IPC
7. Renderer stops recording, sends audio data via IPC
8. Main process receives audio, emits event for downstream STT

## Technical Constraints

- All IPC communication through contextBridge (security)
- Follow existing patterns in preload.ts
- Service initialization order matters (logger first, then services)

## Acceptance Criteria

1. [ ] Preload API extended with audio capture methods
2. [ ] Type declarations updated for new API
3. [ ] Audio service initialized in main.ts
4. [ ] Hotkey events wired to audio capture
5. [ ] Full recording flow works end-to-end
6. [ ] macOS microphone permission requested on first use
7. [ ] Permission denial shows user notification
8. [ ] `mise run quality` passes
