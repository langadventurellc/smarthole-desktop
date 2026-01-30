---
id: T-implement-ipc-log-handler-in
title: Implement IPC log handler in main process
status: open
priority: high
parent: F-logging-system
prerequisites:
  - T-implement-privacy-aware
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T01:28:05.036Z
updated: 2026-01-30T01:28:05.036Z
---

# Implement IPC Log Handler in Main Process

## Context

This task connects the renderer process logging (via preload bridge) to the main process logger. The preload bridge already has the `log` method implemented in `src/preload.ts` that sends to `IPC_CHANNELS.LOG_MESSAGE`. This task implements the receiving handler.

**Parent Feature**: F-logging-system
**Prerequisite Task**: T-implement-privacy-aware

## What to Build

### 1. IPC Handler Registration

In `src/main.ts`, register a handler for the `LOG_MESSAGE` IPC channel:

```typescript
import { ipcMain } from "electron";
import { IPC_CHANNELS, isLogMessagePayload } from "./types";
import { logger } from "./services";

ipcMain.on(IPC_CHANNELS.LOG_MESSAGE, (event, payload) => {
  if (!isLogMessagePayload(payload)) {
    logger.warn("Invalid log message payload received", { payload });
    return;
  }

  const { level, message, context, timestamp } = payload;

  // Add renderer context
  const enrichedContext = {
    ...context,
    source: "renderer",
    timestamp,
  };

  logger[level](message, enrichedContext);
});
```

### 2. Logger Initialization in Main Process

Initialize the logger early in `src/main.ts`:

```typescript
import { initializeLogger } from "./services/logger";

// Initialize before other operations
const logger = initializeLogger({
  level: "info", // Will come from config in later feature
  logMessageContent: false,
});

logger.info("Application starting", { version: app.getVersion() });
```

### 3. Renderer Log Enrichment

When receiving logs from renderer:

- Add `source: 'renderer'` to distinguish from main process logs
- Preserve original timestamp from renderer
- Apply same sanitization as main process logs

### 4. Child Logger for IPC

Create a child logger specifically for IPC-related logging:

```typescript
const ipcLogger = logger.child({ component: "IPC" });
```

## File Locations

- Modify: `src/main.ts` - Add logger initialization and IPC handler

## Technical Approach

1. Import logger and IPC utilities at top of main.ts
2. Initialize logger early in app startup (after imports, before app.on('ready'))
3. Register IPC handler after app is ready
4. Use type guard `isLogMessagePayload` from `src/types/ipc.ts` for validation
5. Map LogLevel to pino method calls

## Acceptance Criteria

- [ ] Logger initialized early in main.ts
- [ ] IPC handler registered for LOG_MESSAGE channel
- [ ] Handler validates payload using `isLogMessagePayload`
- [ ] Invalid payloads logged as warnings (not errors)
- [ ] Renderer logs include `source: 'renderer'` context
- [ ] Original renderer timestamp preserved
- [ ] Application startup logged with version
- [ ] Unit tests for IPC handler (mock ipcMain)

## Testing Requirements

- Unit tests mocking ipcMain.on
- Test valid payload processing
- Test invalid payload rejection
- Test log level mapping (error, warn, info, debug, trace)
- Test context enrichment (source, timestamp)

## Dependencies

- T-implement-privacy-aware (must be completed first)
- Uses `IPC_CHANNELS.LOG_MESSAGE` from `src/types/ipc.ts`
- Uses `isLogMessagePayload` from `src/types/ipc.ts`
- Uses `LogMessagePayload` from `src/types/ipc.ts`
