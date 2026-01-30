---
id: T-create-popup-preload-script
title: Create popup preload script and renderer UI
status: open
priority: high
parent: F-text-input-popup-window
prerequisites:
  - T-add-text-input-popup-ipc
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T23:42:11.226Z
updated: 2026-01-30T23:42:11.226Z
---

# Create Popup Preload Script and Renderer UI

## Context

The Text Input Popup needs its own preload script and React-based renderer for the frameless text input UI. This follows the security patterns established in `src/preload.ts` with contextBridge isolation.

**Reference**:

- Feature spec: F-text-input-popup-window
- Existing preload: `src/preload.ts`
- Existing renderer: `src/renderer.tsx`, `src/App.tsx`

## Implementation Requirements

### 1. Create Preload Script

Create `src/preload-popup.ts` with a minimal API for the popup:

```typescript
const popupAPI = {
  /** Submit text and close popup */
  submit: (text: string): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_SUBMIT, {
      text,
      timestamp: new Date().toISOString(),
    });
  },

  /** Dismiss popup without submitting */
  dismiss: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_DISMISSED);
  },

  /** Notify main process popup gained focus */
  notifyFocused: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_FOCUSED);
  },

  /** Listen for placeholder text updates */
  onPlaceholderChange: (callback: (placeholder: string) => void): (() => void) => { ... },
};

contextBridge.exposeInMainWorld("popupAPI", popupAPI);
```

### 2. Create HTML Entry Point

Create `src/popup/index.html`:

- Minimal HTML boilerplate
- Link to popup CSS and JS
- No external resources (fast load)

### 3. Create React Component

Create `src/popup/popup.tsx`:

```typescript
function TextInputPopup() {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
    window.popupAPI.notifyFocused();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && text.trim()) {
      window.popupAPI.submit(text.trim());
    } else if (e.key === "Escape") {
      window.popupAPI.dismiss();
    }
  };

  return (
    <input
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Type your command..."
    />
  );
}
```

### 4. Create Styling

Create `src/popup/popup.css`:

- Frameless appearance (no borders, minimal padding)
- Semi-transparent background
- Modern input styling (large text, clean appearance)
- Match system theme if possible
- Rounded corners
- Subtle shadow for depth

### 5. Add Type Declarations

Create or update type declarations for the `popupAPI`:

```typescript
declare global {
  interface Window {
    popupAPI: PopupAPI;
  }
}
```

## Files to Create

- `src/preload-popup.ts` - Preload script for popup window
- `src/popup/index.html` - HTML entry point
- `src/popup/popup.tsx` - React component
- `src/popup/popup.css` - Styling

## Files to Modify

- `src/types/electron.d.ts` - Add PopupAPI type declaration

## Acceptance Criteria

- [ ] Preload script exposes `submit`, `dismiss`, `notifyFocused` via contextBridge
- [ ] React component renders single text input
- [ ] Input auto-focuses on mount
- [ ] Enter key submits text (if non-empty) and closes
- [ ] Escape key dismisses without submitting
- [ ] Styling matches feature spec (frameless, modern, clean)
- [ ] TypeScript types properly declared
- [ ] Passes `mise run quality`

## Testing Requirements

- Unit tests for popup component (render, keyboard handling)
- Verify preload exposes correct API shape

## Out of Scope

- Window management (T-create-text-input-popup)
- IPC handlers in main process (separate task)
- Build configuration (separate task)
- Main.ts integration (separate task)
