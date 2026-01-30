# SmartHole Desktop - Claude Instructions

This is the SmartHole desktop application built with Electron, React, and TypeScript.

## Project Overview

- **Type**: Cross-platform desktop application (Windows, macOS)
- **UI**: System tray application with minimal window UI
- **Build Tool**: Electron Forge with Vite
- **Task Runner**: mise

## Key Technologies

- Electron 40+
- React 19
- TypeScript 5.9+
- Vite 7
- Vitest for testing
- ESLint 9 (flat config) + Prettier

## Development Commands

Use mise for all development tasks:

```bash
mise run dev        # Start in development mode
mise run build      # Build for distribution
mise run lint       # Run ESLint
mise run format     # Format with Prettier
mise run type-check # TypeScript checking
mise run quality    # All quality checks
mise run test       # Run tests
```

## Architecture Notes

### Core Entry Points

- `src/main.ts` - Electron main process, handles tray icon and system-level functionality
- `src/preload.ts` - Preload script for secure IPC between main and renderer
- `src/renderer.tsx` - React entry point for any window UIs
- `src/App.tsx` - Main React component

### Services

- `src/services/logger.ts` - Centralized logging service using pino
- `src/services/notifications.ts` - Native OS notification service wrapping Electron's Notification API
- `src/services/notification-queue.ts` - Notification queue with priority ordering, rate limiting, and coalescing

### IPC Handlers

- `src/ipc/log-handler.ts` - Handles log messages from renderer process
- `src/ipc/notification-handler.ts` - Handles notification requests from renderer process

## Logging System

The application uses a centralized logging system built on [pino](https://github.com/pinojs/pino).

### Logger Initialization

Initialize the logger inside `app.whenReady()` in the main process:

```typescript
import { initializeLogger } from "./services/logger";
import { LogLevel } from "./types";

app.whenReady().then(() => {
  const logger = initializeLogger({
    level: "info" as LogLevel,
    logMessageContent: false, // Privacy: don't log user content
  });
  // ... rest of initialization
});
```

**Important**: All service initialization must happen inside `app.whenReady()` to avoid CPU issues with pino's worker threads.

For pretty-printed logs during development, pipe through pino-pretty:

```bash
mise run dev 2>&1 | npx pino-pretty
```

### Logging from Main Process

```typescript
import { getLogger } from "./services/logger";

const logger = getLogger();
logger.info("Application starting", { version: app.getVersion() });
logger.error("Something failed", { error: err.message });

// Child loggers for component isolation
const ipcLogger = logger.child({ component: "IPC" });
ipcLogger.debug("Message received", { channel: "log:message" });
```

### Logging from Renderer Process

The renderer uses the `electronAPI` exposed via preload:

```typescript
// In renderer code
window.electronAPI.logInfo("User action", { action: "button-click" });
window.electronAPI.logError("Component error", { component: "Settings" });
```

### Privacy-Aware Logging

The logger automatically sanitizes sensitive data:

- **Always redacted**: Keys matching patterns like `apiKey`, `password`, `token`, `secret`, `auth`, `credential`, `bearer`
- **Conditionally redacted**: User content fields (`content`, `text`, `body`, `input`, `transcript`) when `logMessageContent: false`

### Log File Location

Logs are written to:

- Development: `{project}/logs/smarthole.log`
- Production: Platform-specific logs directory via `app.getPath('logs')`

Log files rotate at 10MB, keeping the 5 most recent rotated files.

## Notification System

The application uses a native OS notification system built on Electron's Notification API, with a queue that provides rate limiting, priority ordering, and notification coalescing.

### Notification Initialization

Initialize the notification service after the logger, inside `app.whenReady()`:

```typescript
import { initializeNotificationService } from "./services/notifications";
import { initializeNotificationQueue } from "./services/notification-queue";

app.whenReady().then(() => {
  // Initialize logger first...

  const notificationService = initializeNotificationService();
  const notificationQueue = initializeNotificationQueue(notificationService, {
    maxPerMinute: 10, // Maximum notifications per minute
    maxQueueDepth: 20, // Maximum queue size before dropping low priority
    minInterval: 1000, // Minimum ms between notifications
  });
});
```

### Showing Notifications from Main Process

```typescript
import { getNotificationQueue } from "./services/notification-queue";

const queue = getNotificationQueue();
queue.enqueue({
  title: "Notification Title",
  body: "Notification body text",
  type: "info", // "info" | "warning" | "error" | "success"
  priority: "medium", // "low" | "medium" | "high"
});
```

### Showing Notifications from Renderer Process

The renderer uses the `electronAPI` exposed via preload:

```typescript
// Convenience methods
window.electronAPI.notifyInfo("Title", "Body text");
window.electronAPI.notifyWarning("Warning", "Something needs attention");
window.electronAPI.notifyError("Error", "Something went wrong");
window.electronAPI.notifySuccess("Success", "Operation completed");

// Full options
window.electronAPI.notify({
  title: "Custom Notification",
  body: "With all options",
  type: "info",
  priority: "high",
});
```

### Queue Features

- **Priority Ordering**: High priority notifications shown before medium/low
- **Rate Limiting**: Configurable max per minute and minimum interval
- **Coalescing**: Similar notifications combined (e.g., "3 occurrences")
- **Queue Overflow**: Low priority dropped first when queue is full

## Guidelines

- When adding libraries, use `npm install <package>` to get the latest version
- The app primarily runs as a tray application - dock/taskbar visibility is hidden on macOS
- For IPC between main and renderer, use contextBridge in preload.ts
