# Tray Input Integration

Tray menu input controls and visual state indication for voice recording and text input.

## Overview

The tray input integration provides:

- **Input menu items** for "Open Text Input" and "Start/Stop Recording"
- **Dynamic state updates** that enable/disable items based on current input state
- **Tray icon state indication** showing recording status visually
- **Testable menu template** extracted to a separate module

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  InputState     │────▶│    Tray Menu     │────▶│   Tray Icon     │
│    Service      │     │   (buildTray...)  │     │  (state color)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌──────────────────┐
│  AudioCapture   │     │ TextInputPopup   │
│    Service      │     │    Service       │
└─────────────────┘     └──────────────────┘
```

## Tray Menu

### Menu Items

The tray context menu includes input controls between the client status and standard items:

| Item            | Description                                  | State Behavior                   |
| --------------- | -------------------------------------------- | -------------------------------- |
| Open Text Input | Opens the Spotlight-style text input popup   | Disabled during PROCESSING state |
| Start Recording | Begins voice recording (shown when idle)     | Enabled only in IDLE state       |
| Stop Recording  | Stops voice recording (shown when recording) | Enabled only in RECORDING state  |

### Menu Structure

```
├── [N] client(s) connected
├── Connected Clients (submenu, if clients present)
├── ─────────────────
├── Open Text Input
├── Start Recording / Stop Recording
├── ─────────────────
├── About SmartHole
├── ─────────────────
└── Quit
```

### State-Based Behavior

The menu items dynamically enable/disable based on the current input state:

| Input State | Open Text Input | Recording Toggle             |
| ----------- | --------------- | ---------------------------- |
| IDLE        | Enabled         | "Start Recording" - Enabled  |
| RECORDING   | Enabled         | "Stop Recording" - Enabled   |
| PROCESSING  | Disabled        | "Start Recording" - Disabled |

## Tray Icon State

### Icon Variants

| State     | Icon                        | Description                    |
| --------- | --------------------------- | ------------------------------ |
| Idle      | Black filled square (16x16) | Default state, no input active |
| Recording | Red filled circle (16x16)   | Voice recording in progress    |

### Icon Implementation

- **Idle icon**: Black square, marked as template image on macOS (adapts to menu bar theme)
- **Recording icon**: Red circle (RGB: 255, 59, 48), NOT a template image (preserves red color)
- **Caching**: Icons are created once and cached to avoid repeated buffer allocation

### Icon Updates

The icon automatically updates when the input state changes:

```typescript
// In main.ts
inputState.inputStateService.on("stateChanged", (event) => {
  updateTrayMenu();
  updateTrayIcon(event.newState);
});
```

## Module: tray-menu.ts

Location: `src/tray-menu.ts`

Extracted menu template building logic for testability without Electron dependencies.

### Types

```typescript
interface TrayMenuState {
  clientCount: number;
  connectedClients: { name: string; description?: string }[];
  currentInputState: InputState;
  isRecording: boolean;
}

interface TrayMenuActions {
  onOpenTextInput: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onAbout: () => void;
  onQuit: () => void;
}

interface MenuItemOptions {
  label?: string;
  type?: "separator" | "normal" | "submenu";
  enabled?: boolean;
  sublabel?: string;
  click?: () => void;
  submenu?: MenuItemOptions[];
}
```

### Building the Menu

```typescript
import { buildTrayMenuTemplate, TrayMenuActions } from "./tray-menu";

const state: TrayMenuState = {
  clientCount: registry.getClientCount(),
  connectedClients: registry.getAllClients().map((c) => ({
    name: c.name,
    description: c.description,
  })),
  currentInputState: getInputState().getCurrentState(),
  isRecording: getAudioCapture().isRecording(),
};

const actions: TrayMenuActions = {
  onOpenTextInput: () => getTextInputPopup().show(),
  onStartRecording: () => getAudioCapture().startRecording(),
  onStopRecording: () => getAudioCapture().stopRecording(),
  onAbout: () =>
    dialog.showMessageBox({
      /* ... */
    }),
  onQuit: () => app.quit(),
};

const template = buildTrayMenuTemplate(state, actions);
const menu = Menu.buildFromTemplate(template);
```

## Menu Updates

The tray menu is rebuilt on the following events:

1. **Client registration/unregistration** - Updates client count and list
2. **Input state changes** - Updates recording toggle and enabled states
3. **Recording start/stop** - Updates recording toggle label

```typescript
// Subscribe to events that trigger menu rebuild
registry.on("registered", () => updateTrayMenu());
registry.on("unregistered", () => updateTrayMenu());
inputState.inputStateService.on("stateChanged", () => updateTrayMenu());
```

## Testing

Location: `src/tray-menu.test.ts`

The extracted `buildTrayMenuTemplate()` function can be tested without Electron:

```typescript
import { buildTrayMenuTemplate, TrayMenuState, TrayMenuActions } from "./tray-menu";

// Create test state
const state: TrayMenuState = {
  clientCount: 0,
  connectedClients: [],
  currentInputState: InputState.IDLE,
  isRecording: false,
};

// Create mock actions
const actions: TrayMenuActions = {
  onOpenTextInput: vi.fn(),
  onStartRecording: vi.fn(),
  onStopRecording: vi.fn(),
  onAbout: vi.fn(),
  onQuit: vi.fn(),
};

// Test menu structure
const template = buildTrayMenuTemplate(state, actions);
expect(template[2].label).toBe("Open Text Input");
expect(template[3].label).toBe("Start Recording");
```

### Test Coverage

- Client status display (singular/plural, submenu presence)
- Open Text Input enabled states per input state
- Recording toggle label and enabled states
- Menu item order verification
- Action callback wiring

## Integration with Other Services

### TextInputPopupService

The "Open Text Input" menu item calls `getTextInputPopup().show()`:

```typescript
onOpenTextInput: () => {
  try {
    getTextInputPopup().show();
  } catch {
    // Service not initialized yet
  }
},
```

### AudioCaptureService

The recording toggle menu items call audio capture methods:

```typescript
onStartRecording: () => {
  try {
    void getAudioCapture().startRecording();
  } catch {
    // Service not initialized yet
  }
},
onStopRecording: () => {
  try {
    void getAudioCapture().stopRecording();
  } catch {
    // Service not initialized yet
  }
},
```

### InputStateService

The menu reads current state to determine enabled/disabled states:

```typescript
currentInputState = getInputState().getCurrentState();
```

## Dependencies

- `electron` - Tray, Menu, nativeImage APIs
- `./services/input-state` - Input state tracking
- `./services/audio-capture` - Recording state
- `./windows/text-input-popup` - Text input popup
- `./services/client-registry` - Client connection status
