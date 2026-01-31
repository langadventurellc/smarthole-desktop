---
id: T-create-hidden-background
title: Create Hidden Background Window for Audio Capture
status: open
priority: high
parent: none
prerequisites: []
affectedFiles: {}
log:
  - >-
    ## Failed Implementation Attempt (2026-01-31)


    An implementation was attempted that:

    - Created `src/windows/background-window.ts` with singleton pattern

    - Created `src/background/renderer.ts` to wire IPC to audio capture

    - Created `vite.background-renderer.config.ts` 

    - Modified `forge.config.ts` to add `background_window` renderer

    - Modified `src/main.ts` to initialize the window

    - Added 24 unit tests (all passing)

    - Passed `mise run quality` (lint, format, type-check)


    **However, runtime testing revealed two critical failures:**


    1. **Settings window broke** - showed white screen after the changes

    2. **Audio recording still didn't work** - still got "No audio data
    received"


    The implementation was reverted. Key learnings:

    - Unit tests mocking Electron cannot catch integration issues

    - Manual runtime testing with `mise run dev` is mandatory

    - Hidden window debugging requires opening dev tools

    - The Vite/Forge config changes may have side effects on other renderers


    The task description has been updated with detailed guidance on what to
    watch for and mandatory verification steps.
schema: v1.0
childrenIds: []
created: 2026-01-31T21:14:34.959Z
updated: 2026-01-31T21:14:34.959Z
---

# Create Hidden Background Window for Audio Capture

## Problem

The voice recording feature doesn't work because there's no renderer window to handle audio capture. When the user clicks "Start Recording" from the tray menu:

1. Main process broadcasts `audio:start` to all `BrowserWindow` instances
2. **No windows are open** (SmartHole runs as a tray app with no persistent window)
3. No renderer receives the event → no audio is captured
4. Timeout occurs → "No audio data received after recording stopped"

## ⚠️ CRITICAL: Lessons from Failed Implementation Attempt

A previous implementation attempt passed all unit tests (1105 tests) and quality checks, but **failed at runtime** with two critical issues:

### Failure 1: Settings Window Broke (White Screen)

Adding the background window renderer to `forge.config.ts` somehow broke the existing settings window, causing it to show only a white screen.

**What to watch for:**

- Check terminal output when running `mise run dev` for port conflicts between renderers
- Verify the Vite dev server is serving all renderers correctly
- Test that ALL existing windows still work after your changes (settings, onboarding, popup)

### Failure 2: Audio Recording Still Didn't Work

The background window was created but audio capture still failed with "No audio data received."

**Likely causes:**

1. **Race condition**: Recording can start before the background window finishes loading
2. **Import resolution**: The renderer's `import { startRecording } from "../audio"` may not resolve correctly in Vite's build context when `root: "src/background"`
3. **Silent failures**: Errors in the hidden window's renderer are invisible without dev tools

### Mandatory Verification Steps

**You MUST do these before considering the task complete:**

1. **Run `mise run dev` and manually test**:
   - Open settings window → should work (not white screen)
   - Click "Start Recording" → speak → click "Stop Recording"
   - Verify you see transcription or meaningful error (not just "No audio data")

2. **Debug the hidden window** by temporarily adding to the window creation:

   ```typescript
   // TEMP: For debugging - remove before committing
   backgroundWindow.webContents.openDevTools({ mode: "detach" });
   ```

   This shows the console for the hidden window so you can see errors.

3. **Check the dev server output** for:
   - Port conflicts between renderers
   - Failed to compile errors
   - 404 errors when loading background HTML

4. **Verify the import path works**: Test that `import { startRecording } from "../audio"` resolves correctly from `src/background/renderer.ts`

### Why Unit Tests Weren't Enough

The previous implementation had 24 unit tests that all passed, but they mocked Electron's `BrowserWindow` and couldn't verify:

- The window actually loads the correct HTML
- Vite serves the renderer correctly
- The preload exposes the right APIs to the renderer
- The audio module imports resolve correctly
- The full IPC round-trip works

**Unit tests are necessary but NOT sufficient for this task.**

---

## Existing Components

The following pieces are already implemented:

| Component                                   | Location                               | Status      |
| ------------------------------------------- | -------------------------------------- | ----------- |
| Renderer-side audio capture (Web Audio API) | `src/audio/audio-capture.ts`           | ✅ Complete |
| Preload: `onAudioStart()`, `onAudioStop()`  | `src/preload/preload.ts` lines 518-547 | ✅ Complete |
| Preload: `sendAudioData(result)`            | `src/preload/preload.ts` line 461      | ✅ Complete |
| Main: `broadcastAudioStart/Stop()`          | `src/ipc/audio-handler.ts` lines 64-84 | ✅ Complete |
| Main: Audio data handler                    | `src/ipc/audio-handler.ts` line 289    | ✅ Complete |

**What's missing**: A hidden BrowserWindow that stays loaded and connects these pieces.

## Implementation Details

### 1. Preload Script

The background window must use the existing `src/preload/preload.ts` to access `window.electronAPI`:

```typescript
webPreferences: {
  preload: path.join(__dirname, '../preload/preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
}
```

### 2. Create Background Window Manager (`src/windows/background-window.ts`)

Follow the pattern from `settings-window.ts` and `onboarding-window.ts`:

```typescript
class BackgroundWindowManager {
  private window: BrowserWindow | null = null;

  // Create a hidden window that stays alive
  // - `show: false` to keep it hidden
  // - `skipTaskbar: true` (Windows) / no dock icon (macOS)
  // - Minimal size (1x1) since it's invisible
  // - Load a simple HTML page with the audio capture wiring
}
```

Singleton pattern: `initializeBackgroundWindow()`, `getBackgroundWindow()`, `resetBackgroundWindow()`

### 3. Create Background Window HTML/Entry (`src/background/`)

Create a minimal renderer entry point:

**`src/background/index.html`**:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>SmartHole Background</title>
  </head>
  <body>
    <script type="module" src="./renderer.ts"></script>
  </body>
</html>
```

**`src/background/renderer.ts`**:

```typescript
import { startRecording, stopRecording, isRecording } from "../audio";

// Wire IPC events to audio capture
window.electronAPI.onAudioStart(async () => {
  try {
    await startRecording();
    window.electronAPI.logDebug("Background: Started recording");
  } catch (error) {
    window.electronAPI.logError("Background: Failed to start recording", { error });
    // Notify user of error
    window.electronAPI.notifyError("Recording Failed", error.message);
  }
});

window.electronAPI.onAudioStop(async () => {
  if (!isRecording()) return;

  try {
    const result = await stopRecording();
    window.electronAPI.sendAudioData(result);
    window.electronAPI.logDebug("Background: Sent audio data");
  } catch (error) {
    window.electronAPI.logError("Background: Failed to stop recording", { error });
    window.electronAPI.notifyError("Recording Error", error.message);
  }
});
```

### 4. Wire Background Window in main.ts

Initialize the background window early in `app.whenReady()`:

```typescript
// Initialize background window for audio capture (before other windows)
backgroundState.backgroundWindow = initializeBackgroundWindow();
logger.info("Background window initialized for audio capture");
```

**IMPORTANT**: Handle the race condition - either:

- Block audio commands until the background window is ready
- Or gracefully handle the case where recording starts before the window loads

### 5. Update Vite/Forge Config

Look at how settings and onboarding windows are configured in `vite.config.ts` and `forge.config.ts`. Add a similar entry for background. The Vite config needs `root: "src/background"`.

### 6. Timeout Awareness

The main process has a timeout in `src/services/audio-capture.ts` (around line 180-200) that fires "No audio data received" after a delay. The background window needs to be loaded and ready before any recording attempt.

### 7. macOS Dock Icon

To prevent a dock icon on macOS:

```typescript
skipTaskbar: true,  // Windows
// For macOS, the app already runs as LSUIElement (tray app), so no extra config needed
```

## Files to Create/Modify

**Create:**

- `src/windows/background-window.ts` - Window manager class
- `src/windows/background-window.test.ts` - Unit tests
- `src/background/index.html` - HTML entry point
- `src/background/renderer.ts` - Audio capture wiring
- `vite.background-renderer.config.ts` - Vite config for background renderer

**Modify:**

- `src/main.ts` - Initialize background window on startup
- `forge.config.ts` - Add background renderer entry
- `src/windows/index.ts` - Export background window

## Acceptance Criteria

1. [ ] Background window is created and hidden on app startup
2. [ ] Background window receives `audio:start` and `audio:stop` IPC events
3. [ ] Audio is captured using Web Audio API when recording is triggered
4. [ ] Captured audio is sent back to main process via `sendAudioData()`
5. [ ] Main process `audioCapture.handleAudioData()` receives the audio
6. [ ] STT pipeline receives and processes the audio
7. [ ] User sees transcription result or error notification
8. [ ] Window stays hidden (not visible in taskbar/dock)
9. [ ] Unit tests cover window manager lifecycle
10. [ ] Quality checks pass (`mise run quality`)
11. [ ] **CRITICAL**: Manual runtime test passes (recording actually works)
12. [ ] **CRITICAL**: Existing windows still work (settings, onboarding, popup)

## Testing Approach

**Unit tests** (`src/windows/background-window.test.ts`):

- Window creation with correct options (hidden, minimal size)
- Singleton behavior (same instance on multiple calls)
- Reset functionality

**Manual integration test** (REQUIRED - do not skip):

1. Start app with `mise run dev`
2. **First**: Open settings window - verify it loads (not white screen)
3. Click "Start Recording" from tray menu
4. Speak for a few seconds
5. Click "Stop Recording"
6. Verify transcription appears (or appropriate error notification)
7. Check terminal logs for the full flow working

## Out of Scope

- Handling multiple simultaneous recordings (not needed)
- Showing any UI in the background window
- Changes to the audio capture logic itself
- Changes to STT pipeline (already implemented)

## Dependencies

- Requires existing preload API (`onAudioStart`, `onAudioStop`, `sendAudioData`)
- Requires existing audio capture module (`src/audio/`)
- Requires existing STT pipeline (F-stt-pipeline-integration - already complete)
