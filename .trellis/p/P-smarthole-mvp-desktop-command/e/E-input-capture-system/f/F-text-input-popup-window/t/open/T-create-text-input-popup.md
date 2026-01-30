---
id: T-create-text-input-popup
title: Create text input popup window management service
status: open
priority: high
parent: F-text-input-popup-window
prerequisites:
  - T-add-text-input-popup-ipc
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T23:41:53.885Z
updated: 2026-01-30T23:41:53.885Z
---

# Create Text Input Popup Window Management Service

## Goal

Create a singleton service to manage the text input popup BrowserWindow with fast show/hide, screen positioning, and focus management.

## Key File to Create

`/Users/zach/code/smarthole-desktop/src/windows/text-input-popup.ts`

## Pattern to Follow

Follow the singleton service pattern from `src/services/hotkey-manager.ts`:

- Module-level instance variable
- `initializeTextInputPopup()` creation function
- `getTextInputPopup()` getter function
- Event emitter for callbacks
- Cleanup on app quit

## Implementation Details

### Service Interface

```typescript
/**
 * Events emitted by the TextInputPopupService.
 */
export interface TextInputPopupEvents {
  /** Emitted when text is submitted from the popup */
  submitted: (payload: TextInputSubmitPayload) => void;
  /** Emitted when the popup is dismissed without submitting */
  dismissed: () => void;
  /** Emitted when the popup window gains focus */
  focused: () => void;
}

/**
 * Text input popup service interface.
 */
export interface TextInputPopupService {
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

### BrowserWindow Configuration

```typescript
import { BrowserWindow, screen, app } from "electron";
import path from "path";

const createPopupWindow = (): BrowserWindow => {
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
    focusable: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the popup HTML
  popupWindow.loadURL(getPopupUrl());

  return popupWindow;
};
```

### Path Resolution (Dev vs Prod)

```typescript
import { app } from "electron";

function getPreloadPath(): string {
  if (app.isPackaged) {
    return path.join(__dirname, "preload-popup.js");
  }
  // In dev, Vite outputs to .vite/build
  return path.join(__dirname, "../.vite/build/preload-popup.js");
}

function getPopupUrl(): string {
  if (app.isPackaged) {
    return `file://${path.join(__dirname, "../renderer/popup_window/index.html")}`;
  }
  // In dev, use Vite dev server (configured in forge.config.ts)
  // The VitePlugin provides MAIN_WINDOW_VITE_DEV_SERVER_URL-style env vars
  return process.env.POPUP_WINDOW_VITE_DEV_SERVER_URL || "http://localhost:5174";
}
```

### Screen Positioning

```typescript
private centerOnActiveDisplay(): void {
  if (!this.window) return;

  // Find the display where the cursor currently is
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = activeDisplay;

  // Center the popup in the work area
  const x = Math.round(workArea.x + (workArea.width - 600) / 2);
  const y = Math.round(workArea.y + (workArea.height - 60) / 2);

  this.window.setPosition(x, y);
}
```

### Focus Management

```typescript
class TextInputPopupImpl implements TextInputPopupService {
  private window: BrowserWindow | null = null;
  private previouslyFocusedWindow: BrowserWindow | null = null;

  show(options?: TextInputOpenPayload): void {
    if (!this.window) {
      this.window = createPopupWindow();
    }

    // Store reference to currently focused window for focus restoration
    this.previouslyFocusedWindow = BrowserWindow.getFocusedWindow();

    // Position and show
    this.centerOnActiveDisplay();
    this.window.show();
    this.window.focus();

    // Send placeholder if provided
    if (options?.placeholder) {
      this.window.webContents.send("textInput:placeholder", options.placeholder);
    }

    this.logger.debug("Text input popup shown");
  }

  hide(): void {
    if (!this.window) return;

    this.window.hide();

    // Clear the input field for next use
    this.window.webContents.send("textInput:clear");

    // Restore focus to previous window
    if (this.previouslyFocusedWindow && !this.previouslyFocusedWindow.isDestroyed()) {
      this.previouslyFocusedWindow.focus();
    }
    this.previouslyFocusedWindow = null;

    this.logger.debug("Text input popup hidden");
  }
}
```

### Full Implementation Structure

```typescript
import { EventEmitter } from "events";
import { BrowserWindow, screen, app } from "electron";
import path from "path";
import { getLogger, Logger } from "../services/logger";
import { TextInputOpenPayload, TextInputSubmitPayload } from "../types";

// ... interfaces defined above ...

class TextInputPopupImpl implements TextInputPopupService {
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;
  private window: BrowserWindow | null = null;
  private previouslyFocusedWindow: BrowserWindow | null = null;

  constructor() {
    this.logger = getLogger().child({ component: "TextInputPopup" });
    this.emitter = new EventEmitter();
    this.setupCleanup();
  }

  private setupCleanup(): void {
    app.on("will-quit", () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.destroy();
        this.window = null;
      }
    });
  }

  // ... rest of implementation
}

// Singleton management
let popupInstance: TextInputPopupImpl | null = null;

export function initializeTextInputPopup(): TextInputPopupService {
  if (popupInstance) {
    return popupInstance;
  }
  popupInstance = new TextInputPopupImpl();
  return popupInstance;
}

export function getTextInputPopup(): TextInputPopupService {
  if (!popupInstance) {
    throw new Error("TextInputPopup not initialized. Call initializeTextInputPopup() first.");
  }
  return popupInstance;
}

export function resetTextInputPopup(): void {
  if (popupInstance) {
    // Cleanup
  }
  popupInstance = null;
}
```

## Blur Handling

The popup should close when it loses focus:

```typescript
private setupWindowEvents(): void {
  if (!this.window) return;

  this.window.on("blur", () => {
    // Emit dismissed event and hide
    this.emitter.emit("dismissed");
    this.hide();
  });
}
```

## Acceptance Criteria

- [ ] `initializeTextInputPopup()` creates singleton instance
- [ ] `getTextInputPopup()` returns instance or throws
- [ ] `resetTextInputPopup()` for testing
- [ ] Window created hidden at startup (fast show time < 200ms)
- [ ] `show()` centers on active display and focuses
- [ ] `hide()` returns focus to previous application
- [ ] Frameless, transparent, always-on-top appearance
- [ ] Event emitter for `submitted`, `dismissed`, `focused` events
- [ ] Blur event triggers dismiss
- [ ] Cleanup on app quit
- [ ] Tests pass: `mise run test`
- [ ] Quality checks pass: `mise run quality`

## Dependencies

- T-add-text-input-popup-ipc (for TextInputOpenPayload, TextInputSubmitPayload types)

## Estimated Complexity

Medium - BrowserWindow management, screen positioning, focus handling.
