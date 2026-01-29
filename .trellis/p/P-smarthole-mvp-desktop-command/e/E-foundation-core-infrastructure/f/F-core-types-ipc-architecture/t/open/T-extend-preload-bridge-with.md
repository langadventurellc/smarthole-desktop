---
id: T-extend-preload-bridge-with
title: Extend preload bridge with typed method stubs
status: open
priority: high
parent: F-core-types-ipc-architecture
prerequisites:
  - T-create-type-guards-and
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T02:37:05.367Z
updated: 2026-01-29T02:37:05.367Z
---

# Extend Preload Bridge with Typed Method Stubs

## Context

This task updates the existing `src/preload.ts` to expose a fully-typed `electronAPI` to the renderer process. The implementations will be stubs that call IPC methods - actual handlers will be implemented in later features.

**Parent Feature**: F-core-types-ipc-architecture
**Existing File**: [src/preload.ts](/src/preload.ts) - Currently has empty electronAPI object
**Depends On**: T-create-type-guards-and (for all types to be in place)

## Objective

Extend the preload bridge with typed method stubs for logging, notifications, and configuration. Also create TypeScript declaration file for the renderer to have proper types for `window.electronAPI`.

## Implementation Details

### Files to Modify/Create

1. `src/preload.ts` - Update with typed IPC methods
2. `src/types/electron.d.ts` - Type declarations for window.electronAPI

### Update preload.ts

```typescript
import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  LogMessagePayload,
  NotifyShowPayload,
  ConfigSetPayload,
  ConfigGetResponse,
  AppVersionResponse,
} from "./types";
import { LogLevel } from "./types";

/**
 * Electron API exposed to renderer process via contextBridge.
 * All methods communicate with main process via IPC.
 */
const electronAPI = {
  // ============================================
  // Logging
  // ============================================

  /**
   * Send a log message to the main process logger.
   */
  log: (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
    const payload: LogMessagePayload = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };
    ipcRenderer.send(IPC_CHANNELS.LOG_MESSAGE, payload);
  },

  // Convenience methods for each log level
  logError: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("error", message, context);
  },
  logWarn: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("warn", message, context);
  },
  logInfo: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("info", message, context);
  },
  logDebug: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("debug", message, context);
  },
  logTrace: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("trace", message, context);
  },

  // ============================================
  // Notifications
  // ============================================

  /**
   * Request the main process to show a system notification.
   */
  notify: (options: NotifyShowPayload): void => {
    ipcRenderer.send(IPC_CHANNELS.NOTIFY_SHOW, options);
  },

  // Convenience methods for notification types
  notifyInfo: (title: string, body: string): void => {
    electronAPI.notify({ title, body, type: "info", priority: "medium" });
  },
  notifyWarning: (title: string, body: string): void => {
    electronAPI.notify({ title, body, type: "warning", priority: "medium" });
  },
  notifyError: (title: string, body: string): void => {
    electronAPI.notify({ title, body, type: "error", priority: "high" });
  },
  notifySuccess: (title: string, body: string): void => {
    electronAPI.notify({ title, body, type: "success", priority: "medium" });
  },

  // ============================================
  // Configuration
  // ============================================

  /**
   * Get the current application configuration.
   */
  getConfig: (): Promise<ConfigGetResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET);
  },

  /**
   * Update application configuration.
   */
  setConfig: (updates: ConfigSetPayload["updates"]): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, { updates });
  },

  /**
   * Listen for configuration changes from main process.
   */
  onConfigChanged: (callback: (config: ConfigGetResponse["config"]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: ConfigGetResponse["config"]) => {
      callback(config);
    };
    ipcRenderer.on(IPC_CHANNELS.CONFIG_CHANGED, handler);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_CHANGED, handler);
    };
  },

  // ============================================
  // App Lifecycle
  // ============================================

  /**
   * Get application version information.
   */
  getVersion: (): Promise<AppVersionResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION);
  },

  /**
   * Request application quit.
   */
  quit: (): void => {
    ipcRenderer.send(IPC_CHANNELS.APP_QUIT);
  },
};

// Expose to renderer
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Export type for use in type declarations
export type ElectronAPI = typeof electronAPI;
```

### Create Type Declarations (electron.d.ts)

```typescript
import type { ElectronAPI } from "../preload";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

### Update Barrel Export

Add to `src/types/index.ts`:

```typescript
// ... existing exports
export type { ElectronAPI } from "../preload";
```

## Technical Approach

1. Update `src/preload.ts` with all typed methods
2. Import types from `./types` barrel export
3. Use `ipcRenderer.send` for fire-and-forget operations
4. Use `ipcRenderer.invoke` for request-response operations
5. Implement `onConfigChanged` with proper cleanup (returns unsubscribe function)
6. Create `electron.d.ts` for global Window type augmentation
7. Export `ElectronAPI` type for external use

## Acceptance Criteria

1. [ ] `src/preload.ts` updated with typed electronAPI object
2. [ ] `log` method implemented with all log levels
3. [ ] Convenience log methods implemented (logError, logWarn, etc.)
4. [ ] `notify` method implemented with NotifyShowPayload
5. [ ] Convenience notify methods implemented (notifyInfo, notifyError, etc.)
6. [ ] `getConfig` method implemented with invoke pattern
7. [ ] `setConfig` method implemented with invoke pattern
8. [ ] `onConfigChanged` listener implemented with unsubscribe function
9. [ ] `getVersion` method implemented
10. [ ] `quit` method implemented
11. [ ] `src/types/electron.d.ts` created with Window augmentation
12. [ ] `window.electronAPI` is properly typed in renderer code
13. [ ] No TypeScript errors when importing types
14. [ ] ElectronAPI type exported from types barrel

## Testing Requirements

Write unit tests in `src/preload.test.ts`:

- Mock `ipcRenderer` to verify correct channels are called
- Verify payload structure matches expected types
- Test `onConfigChanged` returns working unsubscribe function
- Test convenience methods call base methods correctly

Note: Full integration testing will happen in later features when handlers are implemented.

## Security Considerations

- Only expose necessary methods via contextBridge
- All IPC communication uses explicitly defined channels
- No dynamic channel names
- Validate data in main process handlers (implemented in later features)

## Dependencies

- T-create-type-guards-and (ensures all types are defined and exported)
