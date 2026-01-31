---
id: T-implement-config-ipc-handlers
title: Implement config IPC handlers and main process integration
status: done
priority: high
parent: F-configuration-storage-ipc
prerequisites:
  - T-implement-config-manager
affectedFiles:
  src/ipc/config-handler.ts: Created IPC handler for config management with
    createConfigGetHandler, createConfigSetHandler, and broadcastConfigChange
    functions
  src/ipc/config-handler.test.ts: Created 11 unit tests covering get/set handlers and broadcast functionality
  src/main.ts: Added config manager imports, state tracking, initialization in
    app.whenReady(), IPC handler registration, and config change event wiring to
    broadcast
log:
  - >-
    Starting implementation. Researched codebase patterns:

    - IPC handler pattern from client-status-handler.ts

    - Config manager service interface

    - Preload bridge already has getConfig/setConfig/onConfigChanged stubs
    calling IPC channels

    - IPC types already defined in types/ipc.ts (ConfigGetResponse,
    ConfigSetPayload, ConfigChangedPayload)
  - >-
    Implementation complete:

    1. Created src/ipc/config-handler.ts with createConfigGetHandler,
    createConfigSetHandler, and broadcastConfigChange functions

    2. Created src/ipc/config-handler.test.ts with 11 unit tests

    3. Updated src/main.ts to initialize config manager and register IPC
    handlers

    4. All 844 tests pass

    5. All quality checks pass (lint, format, type-check)
  - Implemented config IPC handlers and main process integration. Created
    createConfigGetHandler and createConfigSetHandler functions following the
    existing IPC handler patterns from client-status-handler.ts. Added
    broadcastConfigChange function to send config changes to all renderer
    windows. Integrated into main.ts by initializing config manager early in
    app.whenReady() and registering IPC handlers for CONFIG_GET and CONFIG_SET
    channels. Wired configChanged events to broadcast to all renderer windows.
    The renderer can now call window.electronAPI.getConfig() and
    window.electronAPI.setConfig() and changes will persist via electron-store.
schema: v1.0
childrenIds: []
created: 2026-01-31T06:29:27.101Z
updated: 2026-01-31T06:29:27.101Z
---

# Implement Config IPC Handlers and Main Process Integration

## Context

Create the IPC handlers that connect the renderer process to the config manager service, and integrate everything into the main process. The preload bridge already exposes `getConfig()`, `setConfig()`, and `onConfigChanged()` stubs that call these IPC channels.

**Parent Feature:** F-configuration-storage-ipc (Configuration Storage & IPC Implementation)

**Reference Files:**

- `src/ipc/client-status-handler.ts` - IPC handler pattern reference
- `src/main.ts` - Main process integration pattern
- `src/preload/main.ts` - Preload bridge (already has config methods at lines 161-193)
- `src/types/ipc.ts` - IPC channels and payload types already defined

## Implementation Requirements

### 1. Create `src/ipc/config-handler.ts`

Follow the pattern from `client-status-handler.ts`:

```typescript
import { IpcMainInvokeEvent, BrowserWindow } from "electron";
import { ConfigGetResponse, ConfigChangedPayload, IPC_CHANNELS } from "../types";
import { ConfigManagerService } from "../services/config-manager";
import { Logger } from "../services/logger";

/**
 * Creates handler for CONFIG_GET channel.
 * Returns the current AppConfig.
 */
export function createConfigGetHandler(
  getConfigManager: () => ConfigManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => ConfigGetResponse;

/**
 * Creates handler for CONFIG_SET channel.
 * Updates config with partial values, broadcasts changes to all windows.
 */
export function createConfigSetHandler(
  getConfigManager: () => ConfigManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, payload: { updates: PartialAppConfig }) => void;

/**
 * Broadcasts CONFIG_CHANGED to all renderer windows.
 */
export function broadcastConfigChange(payload: ConfigChangedPayload): void;
```

**Handler Implementation Details:**

- `createConfigGetHandler`: Returns `{ config: configManager.getConfig() }`
- `createConfigSetHandler`: Calls `configManager.setConfig(updates)`, then broadcasts to all windows
- `broadcastConfigChange`: Iterates `BrowserWindow.getAllWindows()` and sends to non-destroyed windows
- Log operations at debug level, errors at error level

### 2. Update `src/main.ts`

Add config manager initialization and IPC registration inside `app.whenReady()`:

```typescript
// After logger initialization, before other services
import { initializeConfigManager, getConfigManager } from "./services/config-manager";
import {
  createConfigGetHandler,
  createConfigSetHandler,
  broadcastConfigChange,
} from "./ipc/config-handler";

// Initialize config manager
const configManager = initializeConfigManager();
logger.info("Config manager initialized");

// Register config IPC handlers
const configLogger = logger.child({ component: "ConfigIPC" });
ipcMain.handle(
  IPC_CHANNELS.CONFIG_GET,
  createConfigGetHandler(() => getConfigManager(), configLogger)
);
ipcMain.handle(
  IPC_CHANNELS.CONFIG_SET,
  createConfigSetHandler(() => getConfigManager(), configLogger)
);

// Wire config changes to broadcast
configManager.on("configChanged", (config, changedKeys) => {
  broadcastConfigChange({ config, changedKeys });
});
```

### 3. Unit Tests `src/ipc/config-handler.test.ts`

Test coverage:

- `createConfigGetHandler` returns current config
- `createConfigSetHandler` updates config and triggers broadcast
- Error handling for invalid updates
- Broadcast sends to all non-destroyed windows

## Technical Notes

- The preload bridge already has the renderer-side methods implemented
- IPC channels and payload types are already defined in `src/types/ipc.ts`
- Follow the existing error handling pattern: log errors, return graceful defaults

## Acceptance Criteria

- [ ] `src/ipc/config-handler.ts` created with get/set handlers and broadcast function
- [ ] Handlers registered in `main.ts` inside `app.whenReady()`
- [ ] Config manager initialized before other services that may depend on it
- [ ] CONFIG_CHANGED broadcasts to all renderer windows on config updates
- [ ] Renderer can call `window.electronAPI.getConfig()` and receive config
- [ ] Renderer can call `window.electronAPI.setConfig()` and changes persist
- [ ] Unit tests pass
- [ ] `mise run quality` passes

## Out of Scope

- Modifying the preload bridge (already complete)
- Settings UI (future feature)
- Schema migrations (future enhancement)
