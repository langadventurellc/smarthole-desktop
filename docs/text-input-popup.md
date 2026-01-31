# Text Input Popup

Spotlight-style text input window for capturing user commands via a frameless, floating input field.

## Overview

The text input popup provides:

- **Frameless popup window** centered on the active display (where cursor is)
- **Hotkey activation** via the `textInput` hotkey configuration
- **IPC integration** for text submission and dismissal events
- **Separate preload script** (`popupAPI`) for secure renderer communication

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  HotkeyManager  │────▶│ TextInputPopup   │────▶│   Popup Window  │
│    Service      │     │    Service       │     │   (React UI)    │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  IPC Handlers    │◀────│   popupAPI      │
                        │ (text-input-*)   │     │  (preload)      │
                        └──────────────────┘     └─────────────────┘
```

## Services

### TextInputPopupService

Location: `src/windows/text-input-popup.ts`

Manages the popup BrowserWindow lifecycle.

**Initialization:**

```typescript
import { initializeTextInputPopup, getTextInputPopup } from "./windows/text-input-popup";

// Inside app.whenReady()
const popup = initializeTextInputPopup();

// Show the popup programmatically
popup.show({ placeholder: "Enter command..." });

// Hide the popup
popup.hide();

// Check visibility
if (popup.isVisible()) {
  // ...
}
```

**Events:**

| Event       | Payload                  | Description                              |
| ----------- | ------------------------ | ---------------------------------------- |
| `submitted` | `TextInputSubmitPayload` | Emitted when user submits text (Enter)   |
| `dismissed` | `void`                   | Emitted when popup is dismissed (Escape) |
| `focused`   | `void`                   | Emitted when popup gains focus           |

**Window Properties:**

- Dimensions: 600x60 pixels
- Frameless, transparent, always-on-top
- Centered on active display (cursor position)
- Auto-hides on blur (click outside)
- Focus restored to previous window on hide

## Popup Preload API

Location: `src/preload-popup.ts`

Exposes `window.popupAPI` to the popup renderer:

```typescript
// Submit text (triggers textInput:submit IPC)
window.popupAPI.submit("user entered text");

// Dismiss popup (triggers textInput:dismissed IPC)
window.popupAPI.dismiss();

// Notify main process of focus
window.popupAPI.notifyFocused();

// Listen for placeholder updates
const unsub = window.popupAPI.onPlaceholderChange((placeholder) => {
  console.log("New placeholder:", placeholder);
});

// Listen for clear commands
const unsub = window.popupAPI.onClear(() => {
  console.log("Clear input field");
});
```

## IPC Channels

| Channel                 | Direction     | Payload                  | Description                 |
| ----------------------- | ------------- | ------------------------ | --------------------------- |
| `textInput:open`        | Main -> Popup | `TextInputOpenPayload?`  | Request to open popup       |
| `textInput:close`       | Main -> Popup | `void`                   | Request to close popup      |
| `textInput:submit`      | Popup -> Main | `TextInputSubmitPayload` | Text submitted by user      |
| `textInput:focused`     | Popup -> Main | `void`                   | Popup gained focus          |
| `textInput:dismissed`   | Popup -> Main | `void`                   | Popup closed without submit |
| `textInput:placeholder` | Main -> Popup | `string`                 | Update placeholder text     |
| `textInput:clear`       | Main -> Popup | `void`                   | Clear input field           |

## Types

### TextInputOpenPayload

```typescript
interface TextInputOpenPayload {
  placeholder?: string; // Custom placeholder text
}
```

### TextInputSubmitPayload

```typescript
interface TextInputSubmitPayload {
  text: string; // Submitted text (trimmed)
  timestamp: string; // ISO 8601 timestamp
}
```

## Hotkey Integration

The popup integrates with the global hotkey system. When the `textInput` hotkey is activated:

```typescript
import { wireTextInputToHotkey } from "./ipc/text-input-handler";

// After initializing both services
wireTextInputToHotkey(hotkeyManager, getTextInputPopup, logger);
```

This automatically:

- Opens the popup when `textInput` hotkey is pressed
- Focuses existing popup if already visible

## Popup UI

Location: `src/popup/popup.tsx`

Simple React component with:

- Auto-focusing text input
- Enter key submits text
- Escape key dismisses popup
- Dynamic placeholder support

## Build Configuration

The popup window has separate Vite configurations:

- `vite.popup-preload.config.ts` - Preload script build
- `vite.popup-renderer.config.ts` - Popup React UI build

Entry point: `popup.html`

## Wiring to Main Process

To set up the complete text input system:

```typescript
import { initializeTextInputPopup, getTextInputPopup } from "./windows/text-input-popup";
import { registerTextInputHandlers, wireTextInputToHotkey } from "./ipc/text-input-handler";

// Initialize the popup service
const popup = initializeTextInputPopup();

// Register IPC handlers
registerTextInputHandlers(ipcMain, getTextInputPopup, logger);

// Wire to hotkey manager
wireTextInputToHotkey(hotkeyManager, getTextInputPopup, logger);

// Listen for submitted text
popup.on("submitted", (payload) => {
  console.log("User submitted:", payload.text);
  // Route to message delivery, AI processing, etc.
});
```

## Keyboard Shortcuts

| Key    | Action                           |
| ------ | -------------------------------- |
| Enter  | Submit text (if non-empty)       |
| Escape | Dismiss popup without submitting |
