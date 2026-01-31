---
id: T-fix-state-stuck-in-processing
title: Fix state stuck in PROCESSING after stop recording
status: done
priority: high
parent: F-tray-input-integration
prerequisites: []
affectedFiles:
  src/services/audio-capture.ts: "Added no-audio timeout mechanism:
    noAudioTimeoutId field, NO_AUDIO_TIMEOUT_MS constant (500ms),
    handleNoAudioReceived() method, timeout scheduling in stopRecording(),
    timeout cancellation in handleAudioData() and reset()"
  src/services/audio-capture.test.ts: "Added 4 new tests for no-audio timeout
    behavior: transition to IDLE after timeout, InputState transition,
    handleAudioData cancels timeout, reset clears timeout"
log:
  - >-
    Implemented no-audio timeout in stopRecording():

    - Added 500ms timeout after transitioning to PROCESSING state

    - If handleAudioData() is not called within timeout, automatically
    transitions to IDLE

    - Timeout is cancelled when audio data is received or when reset() is called

    - Added 4 new unit tests for the timeout behavior

    - All 33 tests passing, quality checks pass
  - Fixed state stuck in PROCESSING by adding a 500ms no-audio timeout. After
    stopping recording, if no audio data is received within the timeout, the
    service automatically transitions back to IDLE state, allowing the tray menu
    buttons to be re-enabled.
schema: v1.0
childrenIds: []
created: 2026-01-31T04:59:12.066Z
updated: 2026-01-31T04:59:12.066Z
---

# Fix State Stuck in PROCESSING After Stop Recording

## Problem

After clicking "Stop Recording" in the tray menu, both "Open Text Input" and "Start Recording" buttons become permanently disabled. The application becomes unusable without restarting.

## Root Cause

The state machine flow is:

```
IDLE → [Start Recording] → RECORDING → [Stop Recording] → PROCESSING → ??? stuck forever
```

The issue is in `src/services/audio-capture.ts`:

1. `stopRecording()` (lines 149-171) transitions `InputState` from `RECORDING` to `PROCESSING`
2. The state machine expects `handleAudioData()` (lines 243-268) to be called to transition from `PROCESSING` back to `IDLE`
3. **But**: `handleAudioData()` is only called when the renderer sends audio data via IPC
4. **Problem**: There is no active renderer capturing audio, so `handleAudioData()` never fires

The tray menu items check `InputState` for their `enabled` property:

- "Open Text Input": `enabled: currentInputState !== InputState.PROCESSING`
- "Start Recording": `enabled: currentInputState === InputState.IDLE`

When state is stuck in `PROCESSING`, neither can be clicked.

## Technical Context

The audio capture architecture relies on:

1. Main process (`AudioCaptureService`) - coordinates recording lifecycle
2. Renderer process - does actual microphone capture via Web Audio API

Since this is a tray-only app with hidden dock/window, there's no renderer actively capturing audio. The `stopRecording()` method assumes audio data will arrive, but it never does.

## Solution Approach

Modify `stopRecording()` in `src/services/audio-capture.ts` to handle the case where no audio capture is actually happening:

**Option A: Transition directly to IDLE** (simpler)

- If `stopRecording()` is called but no renderer has registered for audio capture, transition directly to IDLE instead of PROCESSING
- Add a flag or check to detect whether actual audio capture is active

**Option B: Add a timeout** (more robust)

- After transitioning to PROCESSING, set a timeout (e.g., 5 seconds)
- If `handleAudioData()` is not called within the timeout, transition back to IDLE
- Log a warning that audio data was expected but not received

**Recommended: Option A** with fallback behavior for cleaner state management.

## Files to Modify

- `src/services/audio-capture.ts` - Fix `stopRecording()` to handle no-audio-data case

## Acceptance Criteria

1. [ ] After clicking "Stop Recording", state returns to IDLE (either immediately or after short timeout)
2. [ ] "Open Text Input" and "Start Recording" buttons become enabled again
3. [ ] Tray menu is usable for multiple recording start/stop cycles
4. [ ] When actual audio capture is implemented, audio data is still processed correctly
5. [ ] Add logging to indicate when no audio data was received

## Testing Requirements

- Unit test for `stopRecording()` handling no-audio-data scenario
- Manual test: Start Recording → Stop Recording → verify menu items are enabled
- Manual test: Repeat start/stop cycle multiple times

## Out of Scope

- Actually implementing renderer-side audio capture (that's part of a different feature)
- Changing the recording UI or state indication
- Adding audio processing logic
