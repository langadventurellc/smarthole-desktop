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

### IPC Handlers

- `src/ipc/log-handler.ts` - Handles log messages from renderer process

## Logging System

The application uses a centralized logging system built on [pino](https://github.com/pinojs/pino).

### Logger Initialization

Initialize the logger early in the main process (before other operations):

```typescript
import { initializeLogger } from "./services/logger";
import { LogLevel } from "./types";

const logger = initializeLogger({
  level: "info" as LogLevel,
  logMessageContent: false, // Privacy: don't log user content
  prettyPrint: !app.isPackaged, // Pretty print in development
});
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

## Guidelines

- When adding libraries, use `npm install <package>` to get the latest version
- The app primarily runs as a tray application - dock/taskbar visibility is hidden on macOS
- For IPC between main and renderer, use contextBridge in preload.ts
