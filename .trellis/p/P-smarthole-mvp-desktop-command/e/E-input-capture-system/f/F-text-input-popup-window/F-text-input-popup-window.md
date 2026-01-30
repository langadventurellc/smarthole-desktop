---
id: F-text-input-popup-window
title: Text Input Popup Window
status: open
priority: high
parent: E-input-capture-system
prerequisites:
  - F-global-hotkey-system
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T22:15:30.255Z
updated: 2026-01-30T22:15:30.255Z
---

# Text Input Popup Window

## Purpose

Implement a minimal, fast-opening floating window for text input, similar to Spotlight or Alfred. This provides an alternative to voice input for users who prefer typing, opening via a dedicated hotkey or tray menu action.

## Scope

### Window Characteristics

- **Minimal floating window**: Small, focused, unobtrusive
- **Frameless design**: No window chrome, clean appearance
- **Always on top**: Stays above other windows
- **Center screen positioning**: Opens in center of active display
- **Semi-transparent or styled**: Modern appearance matching system theme

### Input Behavior

- **Single text field**: Simple input with placeholder text ("Type your command...")
- **Submit on Enter**: Sends text and closes window
- **Dismiss on Escape**: Closes without sending
- **Auto-dismiss after submit**: Window closes immediately after sending
- **Focus on open**: Window steals focus when opened
- **Focus return on close**: Return focus to previously active application

### Triggers

- **Dedicated hotkey**: Configurable via `HotkeyConfig.textInput` (optional field already defined)
- **Tray menu action**: "Open Text Input" menu item (implemented in F-tray-input-integration)
- **IPC command**: Renderer or other services can request popup open

### IPC Integration

- **IPC channels**:
  - `textInput:open` - request to open the popup
  - `textInput:close` - request to close the popup
  - `textInput:submit` - popup → main with entered text
  - `textInput:focused` - popup gained focus
  - `textInput:dismissed` - popup closed without submit
- **Preload API** for popup window's renderer

## Technical Approach

1. **Separate BrowserWindow**: Create new frameless, alwaysOnTop BrowserWindow
2. **Dedicated HTML/React entry**: Simple React component for the popup UI
3. **Window management in main**: Main process creates/shows/hides window
4. **Hotkey integration**: Subscribe to text input hotkey from F-global-hotkey-system
5. **Focus handling**: Use Electron's focus APIs to manage focus correctly

## Window Configuration

```typescript
{
  width: 600,
  height: 60,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  movable: false,
  show: false, // Show when needed
  webPreferences: {
    preload: path.join(__dirname, 'preload-popup.js'),
    contextIsolation: true,
    nodeIntegration: false
  }
}
```

## Files to Create/Modify

- `src/windows/text-input-popup.ts` - Window management (create, show, hide, position)
- `src/popup/index.html` - HTML entry for popup window
- `src/popup/popup.tsx` - React component for text input UI
- `src/popup/popup.css` - Styling for popup
- `src/preload-popup.ts` - Preload script for popup window
- `src/types/ipc.ts` - Add text input IPC channels
- `src/ipc/text-input-handler.ts` - IPC handlers for text input
- `src/ipc/index.ts` - Export handlers
- `src/main.ts` - Initialize popup window, wire to hotkey
- `vite.config.ts` - Add popup entry point if needed
- `electron-builder.yml` - Include popup assets in build

## Dependencies

- **F-global-hotkey-system**: Subscribes to text input hotkey (if configured)
- **No new npm packages**: Uses Electron BrowserWindow APIs

## Acceptance Criteria

1. [ ] Popup opens via hotkey (when configured)
2. [ ] Popup opens via IPC request
3. [ ] Window is frameless and always on top
4. [ ] Window positioned at center of active screen
5. [ ] Text field receives focus immediately on open
6. [ ] Enter key submits text and closes window
7. [ ] Escape key dismisses without submitting
8. [ ] Submitted text emitted via IPC for downstream processing
9. [ ] Focus returns to previous application after close
10. [ ] Window opens within 200ms of hotkey press

## Testing Requirements

- Unit tests for window positioning logic
- Unit tests for IPC handlers
- Manual testing for focus management and appearance

## Security Considerations

- Popup uses same contextIsolation/preload pattern as main window
- No sensitive data displayed in popup
- Input sanitization before downstream processing

## Performance Requirements

- Window opens within 200ms of trigger
- Pre-create window (hidden) for faster show time
- Minimal memory footprint when hidden
