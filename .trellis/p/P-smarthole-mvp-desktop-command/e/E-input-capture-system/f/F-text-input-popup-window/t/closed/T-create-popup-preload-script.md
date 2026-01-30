---
id: T-create-popup-preload-script
title: Create popup preload script and renderer UI
status: done
priority: high
parent: F-text-input-popup-window
prerequisites:
  - T-add-text-input-popup-ipc
affectedFiles:
  src/preload-popup.ts: Created preload script with PopupAPI exposing submit,
    dismiss, notifyFocused methods and onPlaceholderChange, onClear event
    listeners via contextBridge
  src/popup/index.html: Created minimal HTML entry point for popup window with
    module script reference
  src/popup/popup.tsx: Created React component with auto-focus, keyboard handling
    (Enter submits, Escape dismisses), placeholder/clear subscriptions
  src/popup/popup.css: Created Spotlight-like styling with semi-transparent
    background, blur, dark mode and high contrast support
  src/types/electron.d.ts: Added PopupAPI type import and Window.popupAPI
    declaration for type-safe popup renderer code
log:
  - >-
    Implementation completed successfully:


    1. Created src/preload-popup.ts with:
       - submit(text) - Sends TEXT_INPUT_SUBMIT IPC with TextInputSubmitPayload
       - dismiss() - Sends TEXT_INPUT_DISMISSED IPC
       - notifyFocused() - Sends TEXT_INPUT_FOCUSED IPC
       - onPlaceholderChange(callback) - Listens for textInput:placeholder events
       - onClear(callback) - Listens for textInput:clear events
       - Exported PopupAPI type for type declarations

    2. Created src/popup/index.html:
       - Minimal HTML entry point
       - Module script reference to popup.tsx

    3. Created src/popup/popup.tsx:
       - PopupInput React component with useState/useEffect/useRef
       - Auto-focus on mount with notifyFocused notification
       - Placeholder change subscription
       - Clear input subscription
       - Enter key submits text (if non-empty)
       - Escape key dismisses popup
       - Input configured with autoComplete/autoCorrect/autoCapitalize/spellCheck disabled

    4. Created src/popup/popup.css:
       - Spotlight-like styling with frameless appearance
       - 44px height input with 8px rounded corners
       - Semi-transparent background with blur effect
       - Box shadow for floating appearance
       - Dark mode support via prefers-color-scheme media query
       - High contrast mode support via prefers-contrast media query
       - System font stack for native feel

    5. Updated src/types/electron.d.ts:
       - Added PopupAPI import from preload-popup.ts
       - Extended Window interface with popupAPI property

    All quality checks pass (lint, format, type-check).

    All 649 tests pass.
  - Created popup preload script and renderer UI for the text input popup
    window. Implemented preload-popup.ts with secure IPC bridge (submit,
    dismiss, notifyFocused, onPlaceholderChange, onClear APIs), popup/index.html
    entry point, popup/popup.tsx React component with keyboard handling (Enter
    submits, Escape dismisses), and popup/popup.css with Spotlight-like styling
    including dark mode and high contrast support. Updated electron.d.ts with
    PopupAPI type declaration.
schema: v1.0
childrenIds: []
created: 2026-01-30T23:42:11.226Z
updated: 2026-01-30T23:42:11.226Z
---

# Create Popup Preload Script and Renderer UI

## Goal

Create the preload script and React UI for the text input popup window, including HTML entry, React component, and CSS styling.

## Key Files to Create

| File                                                      | Purpose                        |
| --------------------------------------------------------- | ------------------------------ |
| `/Users/zach/code/smarthole-desktop/src/preload-popup.ts` | Secure IPC bridge for popup    |
| `/Users/zach/code/smarthole-desktop/src/popup/index.html` | HTML entry for popup window    |
| `/Users/zach/code/smarthole-desktop/src/popup/popup.tsx`  | React component for text input |
| `/Users/zach/code/smarthole-desktop/src/popup/popup.css`  | Popup styling                  |

## Patterns to Follow

**Preload Script** - Follow `src/preload.ts` pattern:

- Use `contextBridge.exposeInMainWorld`
- Minimal API surface for security
- Type exports for renderer use

**HTML Entry** - Follow `src/index.html` pattern:

- Minimal HTML structure
- Module script reference

**React Component** - Follow `src/renderer.tsx` and `src/App.tsx` patterns

## Implementation Details

### 1. preload-popup.ts

```typescript
/**
 * Preload script for the text input popup window.
 * Provides a minimal, secure API for the popup renderer.
 *
 * @see F-text-input-popup-window feature specification
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, TextInputSubmitPayload } from "./types";

/**
 * Popup API exposed to the popup renderer process via contextBridge.
 * Provides minimal methods for text input interaction.
 */
const popupAPI = {
  /**
   * Submit text and close the popup.
   * Called when user presses Enter with non-empty text.
   *
   * @param text - The text to submit
   */
  submit: (text: string): void => {
    const payload: TextInputSubmitPayload = {
      text,
      submittedAt: new Date().toISOString(),
    };
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_SUBMIT, payload);
  },

  /**
   * Dismiss the popup without submitting.
   * Called when user presses Escape or clicks outside.
   */
  dismiss: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_DISMISSED);
  },

  /**
   * Notify main process that the popup received focus.
   * Used for analytics and state tracking.
   */
  notifyFocused: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_FOCUSED);
  },

  /**
   * Listen for placeholder text updates from main process.
   *
   * @param callback - Function called with new placeholder text
   * @returns Unsubscribe function
   */
  onPlaceholderChange: (callback: (placeholder: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, placeholder: string): void => {
      callback(placeholder);
    };
    ipcRenderer.on("textInput:placeholder", handler);
    return (): void => {
      ipcRenderer.removeListener("textInput:placeholder", handler);
    };
  },

  /**
   * Listen for clear input commands from main process.
   * Called when popup is hidden to reset state for next show.
   *
   * @param callback - Function called when input should be cleared
   * @returns Unsubscribe function
   */
  onClear: (callback: () => void): (() => void) => {
    const handler = (): void => {
      callback();
    };
    ipcRenderer.on("textInput:clear", handler);
    return (): void => {
      ipcRenderer.removeListener("textInput:clear", handler);
    };
  },
};

// Expose the API to the popup renderer process
contextBridge.exposeInMainWorld("popupAPI", popupAPI);

/**
 * Type definition for the popupAPI exposed to renderer.
 * Export this type for use in type declarations.
 */
export type PopupAPI = typeof popupAPI;
```

### 2. popup/index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SmartHole Input</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./popup.tsx"></script>
  </body>
</html>
```

### 3. popup/popup.tsx

```typescript
/**
 * React component for the text input popup.
 * Provides a simple input field with keyboard handling.
 */

import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

// Declare the popup API type for TypeScript
declare global {
  interface Window {
    popupAPI: {
      submit: (text: string) => void;
      dismiss: () => void;
      notifyFocused: () => void;
      onPlaceholderChange: (callback: (placeholder: string) => void) => () => void;
      onClear: (callback: () => void) => () => void;
    };
  }
}

function PopupInput(): React.ReactNode {
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState("Type your command...");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount
    inputRef.current?.focus();
    window.popupAPI.notifyFocused();

    // Subscribe to placeholder changes
    const unsubPlaceholder = window.popupAPI.onPlaceholderChange((newPlaceholder) => {
      setPlaceholder(newPlaceholder);
    });

    // Subscribe to clear commands
    const unsubClear = window.popupAPI.onClear(() => {
      setText("");
    });

    return () => {
      unsubPlaceholder();
      unsubClear();
    };
  }, []);

  const handleSubmit = (): void => {
    const trimmedText = text.trim();
    if (trimmedText) {
      window.popupAPI.submit(trimmedText);
      setText(""); // Clear immediately for responsiveness
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      window.popupAPI.dismiss();
    }
  };

  return (
    <div className="popup-container">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="popup-input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}

// Mount the React app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<PopupInput />);
}
```

### 4. popup/popup.css

```css
/**
 * Styles for the text input popup window.
 * Designed to look like Spotlight/Alfred with dark mode support.
 */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans",
    "Helvetica Neue", sans-serif;
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
  transition: box-shadow 0.2s ease;
}

.popup-input:focus {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.popup-input::placeholder {
  color: #999;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .popup-input {
    background: rgba(40, 40, 40, 0.95);
    color: #fff;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .popup-input:focus {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  }

  .popup-input::placeholder {
    color: #888;
  }
}

/* Windows high contrast mode */
@media (prefers-contrast: high) {
  .popup-input {
    border: 2px solid currentColor;
  }
}
```

### 5. Add Type Declaration File (optional but recommended)

Create `/Users/zach/code/smarthole-desktop/src/types/popup-api.d.ts`:

```typescript
/**
 * Type declarations for the popup window API.
 */

import type { PopupAPI } from "../preload-popup";

declare global {
  interface Window {
    popupAPI: PopupAPI;
  }
}

export {};
```

## Acceptance Criteria

- [ ] `preload-popup.ts` with submit, dismiss, notifyFocused, onPlaceholderChange, onClear APIs
- [ ] `popup/index.html` loading popup React app
- [ ] `popup/popup.tsx` with input field and keyboard handling
- [ ] `popup/popup.css` with Spotlight-like styling
- [ ] Enter key submits text and clears input
- [ ] Escape key dismisses popup
- [ ] Auto-focus on input when popup opens
- [ ] Dark mode support via CSS media query
- [ ] High contrast mode support
- [ ] No autocomplete/autocorrect/spellcheck on input
- [ ] TypeScript types for popupAPI
- [ ] Tests pass: `mise run test`
- [ ] Quality checks pass: `mise run quality`

## Dependencies

- T-add-text-input-popup-ipc (for IPC_CHANNELS, TextInputSubmitPayload types)

## Estimated Complexity

Medium - React component, CSS styling, preload script.
