---
id: F-text-input-popup-window
title: Text Input Popup Window
status: in-progress
priority: high
parent: E-input-capture-system
prerequisites:
  - F-global-hotkey-system
affectedFiles:
  src/types/ipc.ts: Added 5 text input popup IPC channels, TextInputSubmitPayload
    and TextInputOpenPayload interfaces, updated IpcPayloadMap with new channel
    mappings, added isTextInputSubmitPayload type guard
  src/types/ipc.test.ts: Added tests for new text input popup channels,
    TextInputSubmitPayload type guard tests, TextInputOpenPayload interface
    tests, updated channel count test from 21 to 26, updated naming convention
    regex to allow camelCase domains
log:
  - >-
    Started feature implementation. Created feature branch
    feature/F-text-input-popup-window.


    Execution order:

    1. T-add-text-input-popup-ipc (no prerequisites)

    2. T-create-text-input-popup (depends on #1)

    3. T-create-popup-preload-script (depends on #1)

    4. T-add-text-input-ipc-handlers (depends on #1, #2)

    5. T-update-build-configuration (depends on #3)
schema: v1.0
childrenIds:
  - T-add-text-input-ipc-handlers
  - T-add-text-input-popup-ipc
  - T-create-popup-preload-script
  - T-create-text-input-popup
  - T-update-build-configuration
created: 2026-01-30T22:15:30.255Z
updated: 2026-01-30T22:15:30.255Z
---

# Text Input Popup Window

## Purpose

Implement a minimal, fast-opening floating window for text input, similar to Spotlight or Alfred. This provides an alternative to voice input for users who prefer typing, opening via a dedicated hotkey or tray menu action.

## Implementation Plan

This feature requires implementing 5 tasks in dependency order. Below is a comprehensive plan identifying key files, existing patterns to follow, and specific implementation approach for each task.

---

## Task 1: T-add-text-input-popup-ipc

**Goal**: Define IPC channels and types for text input popup communication.

### Key Files to Modify

| File                                                  | Changes                                             |
| ----------------------------------------------------- | --------------------------------------------------- |
| `/Users/zach/code/smarthole-desktop/src/types/ipc.ts` | Add 5 new IPC channels and associated payload types |

### Pattern to Follow

Follow the existing IPC channel pattern in `src/types/ipc.ts`:

- Channel naming: `textInput:{action}` (matching existing patterns like `input:stateChanged`, `hotkey:activated`)
- Payload interfaces with JSDoc documentation
- Type maps for type-safe handlers

### Implementation Details

**New IPC Channels to Add:**

```typescript
// Text input popup channels
TEXT_INPUT_OPEN: "textInput:open",           // Request to open popup
TEXT_INPUT_CLOSE: "textInput:close",         // Request to close popup
TEXT_INPUT_SUBMIT: "textInput:submit",       // Popup -> main with text
TEXT_INPUT_FOCUSED: "textInput:focused",     // Popup gained focus
TEXT_INPUT_DISMISSED: "textInput:dismissed", // Popup closed without submit
```

**New Payload Types:**

```typescript
interface TextInputOpenPayload {
  placeholder?: string; // Optional custom placeholder text
}

interface TextInputSubmitPayload {
  text: string; // The submitted text
  submittedAt: string; // ISO 8601 timestamp
}
```

**Update IpcPayloadMap and IpcResponseMap** to include the new channels.

**Add Type Guards:**

- `isTextInputSubmitPayload(value: unknown): value is TextInputSubmitPayload`

### Acceptance Criteria

- [ ] 5 IPC channels defined in `IPC_CHANNELS` constant
- [ ] `TextInputOpenPayload` and `TextInputSubmitPayload` interfaces defined
- [ ] `IpcPayloadMap` updated with new channels
- [ ] Type guard for `TextInputSubmitPayload`
- [ ] All types have JSDoc documentation

---

## Task 2: T-create-text-input-popup

**Goal**: Create popup window management service with singleton pattern.

### Key Files to Create

| File                                                                 | Purpose                   |
| -------------------------------------------------------------------- | ------------------------- |
| `/Users/zach/code/smarthole-desktop/src/windows/text-input-popup.ts` | Window management service |

### Patterns to Follow

Follow the singleton service pattern from `src/services/hotkey-manager.ts`:

- Module-level instance variable
- `initializeTextInputPopup()` function
- `getTextInputPopup()` getter function
- Event emitter for callbacks

### Implementation Details

**Service Interface:**

```typescript
interface TextInputPopupService {
  /** Show the popup window, centering on active display */
  show(options?: TextInputOpenPayload): void;

  /** Hide the popup window */
  hide(): void;

  /** Check if popup is currently visible */
  isVisible(): boolean;

  /** Get the BrowserWindow instance (for IPC) */
  getWindow(): BrowserWindow | null;

  /** Subscribe to popup events */
  on<K extends keyof TextInputPopupEvents>(event: K, listener: TextInputPopupEvents[K]): void;
  off<K extends keyof TextInputPopupEvents>(event: K, listener: TextInputPopupEvents[K]): void;
}
```

**BrowserWindow Configuration:**

```typescript
const popupWindow = new BrowserWindow({
  width: 600,
  height: 60,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  movable: false,
  show: false, // Created hidden, shown on demand
  webPreferences: {
    preload: path.join(__dirname, "preload-popup.js"),
    contextIsolation: true,
    nodeIntegration: false,
  },
});
```

**Screen Positioning:**

- Use `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())` to find active display
- Center window on that display's work area
- Recalculate position each time `show()` is called

**Focus Management:**

- Store previously focused window before showing popup
- Return focus to previous window on hide
- Use `popupWindow.focus()` when showing

### Acceptance Criteria

- [ ] `initializeTextInputPopup()` and `getTextInputPopup()` functions
- [ ] Window created hidden at startup (fast show time)
- [ ] `show()` centers on active display and focuses
- [ ] `hide()` returns focus to previous application
- [ ] Frameless, transparent, always-on-top appearance
- [ ] Event emitter for `submitted` and `dismissed` events

---

## Task 3: T-create-popup-preload-script

**Goal**: Create preload script and React UI for the popup window.

### Key Files to Create

| File                                                      | Purpose                        |
| --------------------------------------------------------- | ------------------------------ |
| `/Users/zach/code/smarthole-desktop/src/preload-popup.ts` | Secure IPC bridge for popup    |
| `/Users/zach/code/smarthole-desktop/src/popup/index.html` | HTML entry for popup window    |
| `/Users/zach/code/smarthole-desktop/src/popup/popup.tsx`  | React component for text input |
| `/Users/zach/code/smarthole-desktop/src/popup/popup.css`  | Popup styling                  |

### Patterns to Follow

**Preload Script** - Follow `src/preload.ts` pattern:

- Use `contextBridge.exposeInMainWorld`
- Minimal API surface for security
- Type exports for renderer use

**HTML Entry** - Follow `src/index.html` pattern:

- Minimal HTML structure
- Module script reference

**React Component** - Follow `src/renderer.tsx` and `src/App.tsx` patterns

### Implementation Details

**preload-popup.ts:**

```typescript
const popupAPI = {
  /** Submit text and close popup */
  submit: (text: string): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_SUBMIT, {
      text,
      submittedAt: new Date().toISOString(),
    });
  },

  /** Dismiss popup without submitting */
  dismiss: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_DISMISSED);
  },

  /** Notify main process that popup received focus */
  notifyFocused: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_FOCUSED);
  },

  /** Listen for placeholder updates */
  onPlaceholderChange: (callback: (placeholder: string) => void) => {
    const handler = (_event, placeholder: string) => callback(placeholder);
    ipcRenderer.on("textInput:placeholder", handler);
    return () => ipcRenderer.removeListener("textInput:placeholder", handler);
  },
};

contextBridge.exposeInMainWorld("popupAPI", popupAPI);
```

**popup.tsx:**

```typescript
function PopupInput() {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount
    inputRef.current?.focus();
    window.popupAPI.notifyFocused();
  }, []);

  const handleSubmit = () => {
    if (text.trim()) {
      window.popupAPI.submit(text.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      window.popupAPI.dismiss();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Type your command..."
      className="popup-input"
    />
  );
}
```

**popup.css:**

```css
body {
  margin: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
}

.popup-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.popup-input {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 8px;
  padding: 0 16px;
  font-size: 16px;
  outline: none;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.popup-input::placeholder {
  color: #999;
}

/* Support for dark mode */
@media (prefers-color-scheme: dark) {
  .popup-input {
    background: rgba(40, 40, 40, 0.95);
    color: #fff;
  }
}
```

### Acceptance Criteria

- [ ] `preload-popup.ts` with submit, dismiss, notifyFocused APIs
- [ ] `popup/index.html` loading popup React app
- [ ] `popup/popup.tsx` with input field and keyboard handling
- [ ] `popup/popup.css` with Spotlight-like styling
- [ ] Enter submits, Escape dismisses
- [ ] Auto-focus on input when popup opens
- [ ] Dark mode support

---

## Task 4: T-add-text-input-ipc-handlers

**Goal**: Wire up IPC handlers and integrate with hotkey system.

### Key Files to Create/Modify

| File                                                               | Changes                                    |
| ------------------------------------------------------------------ | ------------------------------------------ |
| `/Users/zach/code/smarthole-desktop/src/ipc/text-input-handler.ts` | Create - IPC handlers for popup            |
| `/Users/zach/code/smarthole-desktop/src/ipc/index.ts`              | Modify - Export new handler                |
| `/Users/zach/code/smarthole-desktop/src/main.ts`                   | Modify - Register handlers and wire hotkey |

### Patterns to Follow

Follow `src/ipc/input-state-handler.ts` pattern:

- Factory functions for handlers
- `wireXToIpc()` function for event bridging
- Logger integration

### Implementation Details

**text-input-handler.ts:**

```typescript
/**
 * Creates handler for TEXT_INPUT_SUBMIT channel.
 */
export function createTextInputSubmitHandler(
  popupGetter: () => TextInputPopupService,
  logger: Logger
): (event: IpcMainEvent, payload: TextInputSubmitPayload) => void {
  return (event, payload) => {
    logger.info("Text input submitted", { textLength: payload.text.length });
    const popup = popupGetter();
    popup.hide();
    // Emit event for downstream processing (routing, etc.)
  };
}

/**
 * Creates handler for TEXT_INPUT_DISMISSED channel.
 */
export function createTextInputDismissedHandler(
  popupGetter: () => TextInputPopupService,
  logger: Logger
): (event: IpcMainEvent) => void {
  return (event) => {
    logger.debug("Text input dismissed");
    const popup = popupGetter();
    popup.hide();
  };
}

/**
 * Wires text input popup to hotkey manager for textInput hotkey type.
 */
export function wireTextInputToHotkey(
  hotkeyManager: HotkeyManagerService,
  popupGetter: () => TextInputPopupService,
  logger: Logger
): void {
  hotkeyManager.on("hotkey:activated", (event) => {
    if (event.hotkeyType === "textInput") {
      const popup = popupGetter();
      if (!popup.isVisible()) {
        popup.show();
        logger.debug("Text input popup opened via hotkey");
      }
    }
  });
}
```

**main.ts Modifications:**

1. Initialize popup service after `app.whenReady()`
2. Register IPC handlers for text input channels
3. Wire hotkey manager `textInput` events to popup show

### Acceptance Criteria

- [ ] Handler for `TEXT_INPUT_SUBMIT` that hides popup and emits event
- [ ] Handler for `TEXT_INPUT_DISMISSED` that hides popup
- [ ] Handler for `TEXT_INPUT_FOCUSED` (logging/analytics)
- [ ] Hotkey integration: textInput hotkey opens popup
- [ ] `wireTextInputToHotkey()` function
- [ ] Handlers exported from `src/ipc/index.ts`
- [ ] Handlers registered in `src/main.ts`

---

## Task 5: T-update-build-configuration

**Goal**: Configure Vite and Electron Forge for the popup window.

### Key Files to Create/Modify

| File                                                               | Changes                            |
| ------------------------------------------------------------------ | ---------------------------------- |
| `/Users/zach/code/smarthole-desktop/vite.popup-preload.config.ts`  | Create - Preload config for popup  |
| `/Users/zach/code/smarthole-desktop/vite.popup-renderer.config.ts` | Create - Renderer config for popup |
| `/Users/zach/code/smarthole-desktop/forge.config.ts`               | Modify - Add popup build entries   |

### Patterns to Follow

Follow existing Vite config patterns:

- `vite.preload.config.ts` for preload script
- `vite.renderer.config.ts` for renderer (React)

### Implementation Details

**vite.popup-preload.config.ts:**

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron"],
    },
  },
});
```

**vite.popup-renderer.config.ts:**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

**forge.config.ts Modifications:**
Add to the VitePlugin configuration:

```typescript
new VitePlugin({
  build: [
    // ... existing entries
    {
      entry: "src/preload-popup.ts",
      config: "vite.popup-preload.config.ts",
      target: "preload",
    },
  ],
  renderer: [
    // ... existing entries
    {
      name: "popup_window",
      config: "vite.popup-renderer.config.ts",
    },
  ],
}),
```

**Dev vs Prod Paths:**
In `text-input-popup.ts`, handle path resolution:

```typescript
const POPUP_PRELOAD_DEV = path.join(__dirname, "../.vite/build/preload-popup.js");
const POPUP_PRELOAD_PROD = path.join(__dirname, "preload-popup.js");
const POPUP_HTML_DEV = "http://localhost:5174"; // Vite dev server for popup
const POPUP_HTML_PROD = path.join(__dirname, "../renderer/popup_window/index.html");
```

### Acceptance Criteria

- [ ] `vite.popup-preload.config.ts` created
- [ ] `vite.popup-renderer.config.ts` with React plugin
- [ ] `forge.config.ts` updated with popup preload entry
- [ ] `forge.config.ts` updated with popup_window renderer entry
- [ ] Dev mode works (`mise run dev`)
- [ ] Production build includes popup assets (`mise run build`)
- [ ] Path resolution works in both dev and prod

---

## Execution Order

The tasks must be implemented in this order due to dependencies:

```
T-add-text-input-popup-ipc  ──┬──> T-create-text-input-popup ──┬──> T-add-text-input-ipc-handlers
                              │                                │
                              └──> T-create-popup-preload-script ──> T-update-build-configuration
```

1. **T-add-text-input-popup-ipc** (no prerequisites) - Define IPC contracts first
2. **T-create-text-input-popup** (depends on #1) - Window management uses IPC types
3. **T-create-popup-preload-script** (depends on #1) - Preload uses IPC channels
4. **T-add-text-input-ipc-handlers** (depends on #1, #2) - Handlers wire popup to main
5. **T-update-build-configuration** (depends on #3) - Build config needs popup files to exist

---

## Testing Strategy

### Unit Tests

- `src/types/ipc.test.ts` - Type guard tests for new payloads
- `src/windows/text-input-popup.test.ts` - Window management mocking BrowserWindow
- `src/ipc/text-input-handler.test.ts` - Handler function tests

### Manual Testing

- [ ] Hotkey opens popup within 200ms
- [ ] Popup appears centered on active display
- [ ] Enter submits text
- [ ] Escape dismisses without submitting
- [ ] Focus returns to previous app after close
- [ ] Works on both macOS and Windows
- [ ] Works with dark mode enabled

---

## Files Summary

### New Files to Create

1. `src/types/ipc.ts` (modify - add channels and types)
2. `src/windows/text-input-popup.ts` (new)
3. `src/preload-popup.ts` (new)
4. `src/popup/index.html` (new)
5. `src/popup/popup.tsx` (new)
6. `src/popup/popup.css` (new)
7. `src/ipc/text-input-handler.ts` (new)
8. `vite.popup-preload.config.ts` (new)
9. `vite.popup-renderer.config.ts` (new)

### Files to Modify

1. `src/types/ipc.ts` - Add new IPC channels and types
2. `src/ipc/index.ts` - Export new handler
3. `src/main.ts` - Initialize popup, register handlers
4. `forge.config.ts` - Add popup build entries

---

## Security Considerations

- Popup uses same `contextIsolation: true` pattern as main window
- Minimal preload API surface (submit, dismiss, notifyFocused only)
- No sensitive data displayed in popup
- Input text sanitized before downstream processing
