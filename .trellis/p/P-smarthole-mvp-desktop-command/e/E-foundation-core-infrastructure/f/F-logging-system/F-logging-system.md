---
id: F-logging-system
title: Logging System
status: open
priority: high
parent: E-foundation-core-infrastructure
prerequisites:
  - F-core-types-ipc-architecture
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T02:20:46.767Z
updated: 2026-01-29T02:20:46.767Z
---

# Logging System

## Purpose

Implement a structured logging system using pino that provides consistent, performant logging throughout the application. The logger supports configurable log levels, outputs to both console and file, and includes privacy-aware message handling to respect user preferences about content logging.

## Key Components

### 1. Pino Logger Setup (`src/services/logger.ts`)

- Initialize pino with appropriate configuration for Electron
- Configure log levels: Error, Warn, Info, Debug, Trace
- Set up pretty-printing for development (pino-pretty)
- Configure JSON output for production logs

### 2. File Transport (`src/services/logger.ts`)

- Use `electron-log` or `pino-file` transport for writing logs to disk
- Log file location: Use Electron's `app.getPath('logs')` for platform-appropriate location
- Implement log rotation (size-based or date-based)
- Ensure file writes don't block the main process

### 3. Privacy-Aware Logging

- Implement `logMessageContent` configuration flag
- When disabled, redact or omit message content from logs
- Create utility to sanitize sensitive data (API keys, passwords, etc.)
- Contextual logging with component identifiers (e.g., `[TrayService]`, `[IPC]`)

### 4. IPC Integration

- Implement the log IPC channel handler in main process
- Connect renderer process logging through the preload bridge
- Ensure renderer logs include source context

### 5. Logger Service API

```typescript
interface Logger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;
  child(bindings: Record<string, unknown>): Logger;
}
```

## Technical Requirements

- Use `pino` as the core logging library
- Use `electron-log` for file transport only if it simplifies cross-platform file handling; otherwise use pino's native file transport
- Integrate with types defined in F-core-types-ipc-architecture
- Logger must be importable as singleton or factory
- Support child loggers for component-specific contexts

## Implementation Guidance

**Directory Creation:**

- Create `src/services/` directory
- Files: `logger.ts`, `index.ts` (barrel export)

**Main Process Setup:**

```typescript
// In main.ts, initialize logger early
import { initializeLogger } from "./services/logger";

const logger = initializeLogger({
  level: "info", // from config
  logMessageContent: false, // from config
});

logger.info("Application starting", { version: app.getVersion() });
```

**Renderer Process Usage:**

```typescript
// Logger calls go through IPC to main process
window.electronAPI.log("info", "Button clicked", { component: "App" });
```

## Acceptance Criteria

1. [ ] Pino logger initialized with configurable log levels
2. [ ] Console output works in development with readable formatting
3. [ ] File output writes to `app.getPath('logs')` directory
4. [ ] Log rotation implemented (prevent unbounded file growth)
5. [ ] Privacy-aware logging respects `logMessageContent` setting
6. [ ] Sensitive data sanitization utility implemented
7. [ ] Child loggers support component-specific context
8. [ ] IPC handler in main process receives logs from renderer
9. [ ] Preload bridge `log` method implemented
10. [ ] Logger doesn't impact performance at Info level (no expensive computations for disabled levels)
11. [ ] Unit tests for logger configuration and privacy sanitization

## Testing Requirements

- Unit tests for log level filtering
- Unit tests for privacy sanitization (ensure sensitive patterns are redacted)
- Integration test for file writing
- Verify IPC logging works from renderer

## Performance Requirements

- Log calls at disabled levels must be no-ops (use pino's built-in level checking)
- File writes must be asynchronous and non-blocking
- Avoid string interpolation for disabled log levels

## Security Considerations

- Never log API keys, tokens, or credentials
- Respect `logMessageContent` for user privacy
- Log files should have appropriate permissions (user-only readable)

## Dependencies

- F-core-types-ipc-architecture (for LogLevel types, IPC channel definitions)
