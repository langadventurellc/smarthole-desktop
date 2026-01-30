---
id: T-implement-ipc-log-handler-in
title: Implement IPC log handler in main process
status: done
priority: high
parent: F-logging-system
prerequisites:
  - T-implement-privacy-aware
affectedFiles:
  src/main.ts: Added logger initialization early in startup, created IPC child
    logger, registered IPC handler for LOG_MESSAGE channel, added application
    startup logging
  src/ipc/log-handler.ts: Created new module with createLogMessageHandler() and
    processLogMessage() functions for handling renderer log messages with
    payload validation and context enrichment
  src/ipc/index.ts: Created barrel export for IPC module
  src/ipc/log-handler.test.ts: Created comprehensive unit tests (32 tests)
    covering handler creation, payload validation, log level mapping, context
    enrichment, and edge cases
log:
  - >-
    Research complete. Verified existing code:

    - src/main.ts: Existing structure with tray setup, has placeholder comment
    for logger

    - src/services/logger.ts: Complete logger implementation with
    initializeLogger(), getLogger(), sanitization

    - src/types/ipc.ts: IPC_CHANNELS.LOG_MESSAGE, isLogMessagePayload(),
    LogMessagePayload defined

    - src/preload.ts: log() method already implemented, sends to LOG_MESSAGE
    channel with timestamp

    - Test patterns in logger.test.ts: Uses vitest, mocks pino, fs, path modules


    Implementation plan:

    1. Add ipcMain import and initialize logger early in main.ts

    2. Register LOG_MESSAGE IPC handler with payload validation

    3. Create IPC child logger for IPC-specific logging

    4. Enrich renderer logs with source: 'renderer' and preserve timestamp

    5. Create unit tests mocking ipcMain.on
  - "Implemented IPC log handler in main process that connects renderer process
    logging to the main process logger via IPC. The implementation includes: (1)
    Logger initialized early in main.ts with configurable level and privacy
    settings, (2) IPC handler registered for LOG_MESSAGE channel that validates
    payloads using isLogMessagePayload type guard, (3) Invalid payloads logged
    as warnings via child IPC logger, (4) Renderer logs enriched with source:
    'renderer' and preserved renderer timestamp, (5) Application startup logged
    with version, (6) Comprehensive unit tests (32 tests) covering payload
    validation, log level mapping, and context enrichment."
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
