---
id: T-fix-runaway-process-by
title: Fix runaway process by deferring service initialization to app.whenReady()
status: done
priority: high
parent: none
prerequisites: []
affectedFiles:
  src/main.ts: Moved all service initialization (logger, notification service,
    notification queue, error handlers, IPC handlers) from module load time into
    app.whenReady().then() callback. Added Logger type import and declared
    module-level logger variable.
  src/services/logger.ts: Removed pino.transport() which caused 100% CPU. Now uses
    pino.destination() with pino.multistream() for all modes. Marked prettyPrint
    option as deprecated with instructions to use CLI piping instead.
log:
  - "Starting implementation: Moving all service initialization inside
    app.whenReady() to fix 100% CPU issue caused by pino worker threads failing
    before Electron is fully initialized."
  - Fixed the 100% CPU usage issue by deferring all service initialization to
    after app.whenReady(). Previously, initializeLogger(),
    initializeNotificationService(), initializeNotificationQueue(),
    registerProcessErrorHandlers(), and IPC handlers were all called at module
    load time (before Electron was fully initialized). This caused pino's worker
    threads to fail communication, resulting in a busy-wait loop. All service
    initialization is now inside app.whenReady().then() callback, ensuring
    Electron is fully initialized before spawning pino worker threads.
  - >-
    Initial fix (deferring to app.whenReady()) did not resolve the issue. Root
    cause identified: pino.transport() spawns worker threads that cause 100% CPU
    in Electron main process due to Atomics.waitAsync incompatibility.


    Final fix: Removed pino.transport() entirely from logger.ts. Now uses
    pino.destination() with pino.multistream() for all logging. Pretty printing
    is available via CLI piping: `npm run dev | npx pino-pretty`.


    Verified fix:

    - App runs at 0.0% CPU (was 100%+)

    - Logs written to file successfully

    - All 832 tests pass
schema: v1.0
childrenIds: []
created: 2026-01-30T03:08:24.818Z
updated: 2026-01-30T03:08:24.818Z
---

# Fix Runaway Process / 100% CPU Issue

## Problem

The SmartHole desktop app experiences 100%+ CPU usage immediately on startup due to premature service initialization. The main Electron process consumes an entire CPU core and becomes unresponsive.

### Root Cause

In `src/main.ts`, all services are initialized at **module load time** (before `app.whenReady()`):

- `initializeLogger()` at line 18-22 uses `pino.transport()` which spawns worker threads
- `initializeNotificationService()` at line 42
- `initializeNotificationQueue()` at line 50-54 starts a `setInterval` every 1 second
- `registerProcessErrorHandlers()` at line 57-63
- IPC handlers at lines 73-79

The `pino.transport()` function spawns worker threads using `Atomics.waitAsync` for synchronization. When Electron isn't fully initialized, the worker thread communication fails, causing a busy-wait loop in pino's ThreadStream `wait()` function (via repeated `setImmediate(check)` calls).

### Evidence

- Log file (`logs/smarthole.log`) is NOT updated during runs - pino workers aren't processing
- CPU usage is 100%+ from immediate startup, not from user interaction
- App must be force-killed to stop

## Implementation

### Changes Required in `src/main.ts`

Move ALL service initialization inside `app.whenReady().then()`:

**Before (problematic):**

```typescript
// These run at module load time - TOO EARLY
const logger = initializeLogger({...});
const notificationService = initializeNotificationService();
const notificationQueue = initializeNotificationQueue(...);
registerProcessErrorHandlers({...});
ipcMain.on(IPC_CHANNELS.LOG_MESSAGE, ...);
ipcMain.on(IPC_CHANNELS.NOTIFY_SHOW, ...);

app.whenReady().then(() => {
  createTray();
  // ...
});
```

**After (fixed):**

```typescript
let logger: Logger;
let tray: Tray | null = null;

app.whenReady().then(() => {
  // Initialize logger AFTER Electron is ready
  logger = initializeLogger({
    level: "info" as LogLevel,
    logMessageContent: false,
    prettyPrint: !app.isPackaged,
  });

  const ipcLogger = logger.child({ component: "IPC" });
  const notifyLogger = logger.child({ component: "NotificationIPC" });

  // Initialize notification services
  const notificationService = initializeNotificationService();
  logger.info("Notification service initialized", {
    supported: notificationService.isSupported(),
  });

  const notificationQueue = initializeNotificationQueue(notificationService, {
    maxPerMinute: 10,
    maxQueueDepth: 20,
    minInterval: 1000,
  });

  // Register error handlers
  registerProcessErrorHandlers({
    logger,
    onFatalError: (error) => {
      logger.error("Fatal error occurred", { message: error.message, stack: error.stack });
    },
  });

  // Register IPC handlers
  ipcMain.on(IPC_CHANNELS.LOG_MESSAGE, createLogMessageHandler(logger, ipcLogger));
  ipcMain.on(IPC_CHANNELS.NOTIFY_SHOW, createNotificationHandler(notificationQueue, notifyLogger));

  logger.info("Application starting", { version: app.getVersion() });

  createTray();

  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }

  logger.info("Application ready", { platform: process.platform });
});
```

### Testing

1. Run `mise run dev` and verify the app starts without high CPU usage
2. Check that the tray icon appears and is responsive
3. Verify logs are written to `logs/smarthole.log`
4. Click on tray icon menu items to ensure they work
5. Check Activity Monitor to confirm normal CPU usage (should be near 0% when idle)

## Acceptance Criteria

- [ ] All service initialization moved inside `app.whenReady().then()`
- [ ] App starts without 100% CPU usage
- [ ] Tray icon is responsive to clicks
- [ ] Logs are written to `logs/smarthole.log`
- [ ] Existing tests continue to pass (`mise run test`)
- [ ] App quits cleanly via tray menu

## Files to Modify

- `src/main.ts` - Main process entry point (primary changes)

## Related Investigation

This issue was identified through technical discovery of Epic E-foundation-core-infrastructure. The pino library's ThreadStream uses `Atomics.waitAsync` for worker thread synchronization, which creates a tight loop when workers fail to communicate properly before Electron is fully initialized.
