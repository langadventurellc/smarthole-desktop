# Settings Window

React-based settings UI for configuring SmartHole application preferences.

## Overview

The settings window provides:

- **Standard framed window** for editing application configuration
- **Tab-based navigation** with 6 configuration sections
- **Reusable input components** for common settings patterns
- **Real-time validation** with inline error display
- **Keyboard shortcuts** (Cmd/Ctrl+S to save, Escape to cancel/close)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Tray Menu     │────▶│ SettingsWindow   │────▶│  Settings UI    │
│   (Settings...) │     │    Service       │     │   (React App)   │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  IPC Handlers    │◀────│   electronAPI   │
                        │ (config, cred)   │     │   (preload)     │
                        └──────────────────┘     └─────────────────┘
```

## Services

### SettingsWindowService

Location: `src/windows/settings-window.ts`

Manages the settings BrowserWindow lifecycle with single-instance behavior.

**Initialization:**

```typescript
import { initializeSettingsWindow, getSettingsWindow } from "./windows/settings-window";

// Inside app.whenReady()
const settings = initializeSettingsWindow();

// Show settings (creates window if needed, focuses if already open)
settings.show();

// Hide/close settings
settings.hide();

// Check visibility
if (settings.isVisible()) {
  // ...
}
```

**Window Properties:**

- Dimensions: 600x500 pixels (min 400x400)
- Standard frame (not frameless)
- Resizable
- Auto-hides on Escape key
- Single instance (focuses existing window if already open)

## Settings Sections

The settings UI is organized into 6 tabs:

| Tab                | Configuration                                          |
| ------------------ | ------------------------------------------------------ |
| **Hotkeys**        | Voice input and text input hotkey bindings             |
| **Voice Input**    | Push-to-talk vs toggle recording mode                  |
| **Speech-to-Text** | Backend selection (cloud/local), API key, Whisper path |
| **AI Routing**     | Anthropic API key, model selection                     |
| **Logging**        | Log level, message content logging toggle              |
| **Advanced**       | WebSocket port                                         |

## React Components

Location: `src/settings/components/`

Reusable input components for settings forms:

| Component         | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| `SettingsSection` | Container with title and description            |
| `HotkeyInput`     | Hotkey capture with Electron accelerator format |
| `SecretInput`     | Masked credential input with show/hide toggle   |
| `SelectInput`     | Dropdown for enum values                        |
| `NumberInput`     | Number input with min/max validation            |
| `ToggleInput`     | Accessible toggle switch                        |
| `PathInput`       | File path input with native browse button       |

## IPC Integration

The settings window uses the main preload script (`electronAPI`) for:

**Configuration:**

```typescript
// Load config on mount
const { config } = await window.electronAPI.getConfig();

// Save changes
await window.electronAPI.setConfig(updates);

// Listen for external changes
const unsub = window.electronAPI.onConfigChanged((config, changedKeys) => {
  // Handle external config updates
});
```

**Credentials:**

```typescript
// Check if credential is configured (for UI state)
const hasKey = await window.electronAPI.hasCredential("anthropic-api-key");

// Store new credential
await window.electronAPI.storeCredential("anthropic-api-key", value);

// Clear credential
await window.electronAPI.deleteCredential("anthropic-api-key");
```

**File Dialogs:**

```typescript
// Open file/directory picker
const result = await window.electronAPI.showOpenDialog({
  title: "Select Directory",
  properties: ["openDirectory"],
});
if (!result.canceled && result.filePaths.length > 0) {
  // Use selected path
}
```

## Dialog IPC Channel

Location: `src/ipc/dialog-handler.ts`

| Channel       | Direction        | Payload             | Response             | Description             |
| ------------- | ---------------- | ------------------- | -------------------- | ----------------------- |
| `dialog:open` | Renderer -> Main | `DialogOpenOptions` | `DialogOpenResponse` | Show native file dialog |

### DialogOpenOptions

```typescript
interface DialogOpenOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: ("openFile" | "openDirectory" | "multiSelections")[];
}
```

### DialogOpenResponse

```typescript
interface DialogOpenResponse {
  canceled: boolean;
  filePaths: string[];
}
```

## State Management

The settings UI manages:

- **Config state**: Local copy of `AppConfig` for editing
- **Original config**: Baseline for detecting changes
- **Dirty detection**: Compare current vs original to enable/disable save
- **Validation errors**: Inline error display for invalid inputs
- **External change handling**: Warning when config changes while editing

## Validation

Validation runs on every config change:

| Field          | Rule                           |
| -------------- | ------------------------------ |
| WebSocket Port | Must be between 1024 and 65535 |
| Voice Hotkey   | Required (cannot be empty)     |

Invalid inputs display inline error messages and disable the Save button.

## Build Configuration

The settings window has its own Vite configuration:

- `vite.settings-renderer.config.ts` - Settings React UI build

Entry point: `src/settings/index.html`

Forge configuration in `forge.config.ts` includes the `settings_window` renderer entry.

## Tray Menu Integration

The "Settings..." menu item opens the settings window:

```typescript
// In tray menu actions
onSettings: () => {
  getSettingsWindow().show();
};
```

## Keyboard Shortcuts

| Key        | Action                                  |
| ---------- | --------------------------------------- |
| Cmd/Ctrl+S | Save changes (when dirty and valid)     |
| Escape     | Cancel changes if dirty, close if clean |

## Styling

Location: `src/settings/index.css`

Features:

- CSS custom properties for theming
- Dark mode support via `prefers-color-scheme`
- High contrast mode support
- Responsive layout
- Accessible focus indicators
