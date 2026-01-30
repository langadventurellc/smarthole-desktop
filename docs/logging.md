# Logging System

The application uses a centralized logging system built on [pino](https://github.com/pinojs/pino).

## Initialization

Initialize the logger inside `app.whenReady()` in the main process:

```typescript
import { initializeLogger } from "./services/logger";
import { LogLevel } from "./types";

app.whenReady().then(() => {
  const logger = initializeLogger({
    level: "info" as LogLevel,
    logMessageContent: false, // Privacy: don't log user content
  });
});
```

**Important**: All service initialization must happen inside `app.whenReady()` to avoid CPU issues with pino's worker threads.

## Usage

### Main Process

```typescript
import { getLogger } from "./services/logger";

const logger = getLogger();
logger.info("Application starting", { version: app.getVersion() });
logger.error("Something failed", { error: err.message });

// Child loggers for component isolation
const ipcLogger = logger.child({ component: "IPC" });
ipcLogger.debug("Message received", { channel: "log:message" });
```

### Renderer Process

The renderer uses the `electronAPI` exposed via preload:

```typescript
window.electronAPI.logInfo("User action", { action: "button-click" });
window.electronAPI.logError("Component error", { component: "Settings" });
```

## Privacy-Aware Logging

The logger automatically sanitizes sensitive data:

- **Always redacted**: Keys matching patterns like `apiKey`, `password`, `token`, `secret`, `auth`, `credential`, `bearer`
- **Conditionally redacted**: User content fields (`content`, `text`, `body`, `input`, `transcript`) when `logMessageContent: false`

## Log File Location

- **Development**: `{project}/logs/smarthole.log`
- **Production**: Platform-specific logs directory via `app.getPath('logs')`

Log files rotate at 10MB, keeping the 5 most recent rotated files.
