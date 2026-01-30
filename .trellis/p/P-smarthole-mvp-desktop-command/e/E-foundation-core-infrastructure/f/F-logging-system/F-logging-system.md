---
id: F-logging-system
title: Logging System
status: done
priority: high
parent: E-foundation-core-infrastructure
prerequisites:
  - F-core-types-ipc-architecture
affectedFiles:
  src/services/logger.ts: Created main logger implementation with Logger
    interface, LoggerConfig, initializeLogger(), getLogger(), createLogger(),
    file transport with rotation, and child logger support; Added
    SENSITIVE_PATTERNS and CONTENT_FIELDS constants, isSensitiveKey(),
    isContentKey(), sanitizeLogData(), sanitizeArray(), applyContentRedaction(),
    applyContentRedactionArray(), and processLogContext() functions. Modified
    LoggerWrapper to accept logMessageContent flag and apply sanitization to all
    log context. Updated initializeLogger() and createLogger() to pass
    logMessageContent to LoggerWrapper.
  src/services/index.ts: Created barrel export for services module
  src/services/logger.test.ts: Created comprehensive unit tests (30 tests) for
    logger configuration, level filtering, and child loggers; Added 51 new tests
    for sanitizeLogData (sensitive pattern detection, non-sensitive data
    preservation, nested object handling, array handling, mixed data),
    applyContentRedaction (all content fields, nested objects, arrays,
    null/undefined handling), and Logger Privacy Integration tests.
  package.json: Added pino and pino-pretty dependencies
  package-lock.json: Updated with new dependencies
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
  src/services/logger.integration.test.ts: Created new integration test file with
    21 tests covering file writing, log rotation, IPC flow, log level filtering,
    and privacy features
log:
  - "Created feature branch feature/F-logging-system. Verified all 4 tasks exist
    with correct dependencies. Execution order: T-implement-core-pino-logger →
    T-implement-privacy-aware → T-implement-ipc-log-handler-in →
    T-create-integration-tests-for"
  - Completed T-implement-core-pino-logger. Created src/services/logger.ts with
    Logger interface, initializeLogger(), getLogger(), createLogger(), file
    transport with rotation (10MB), and child logger support. 30 tests passing.
    Committed as af2525e. Proceeding to T-implement-privacy-aware.
  - Completed T-implement-privacy-aware. Added SENSITIVE_PATTERNS,
    CONTENT_FIELDS, sanitizeLogData(), applyContentRedaction(), and
    processLogContext() to logger. LoggerWrapper now applies privacy
    sanitization to all log calls. 51 new tests (81 total). Committed as
    df9033c. Proceeding to T-implement-ipc-log-handler-in.
  - Completed T-implement-ipc-log-handler-in. Added logger initialization in
    main.ts, created src/ipc/log-handler.ts with createLogMessageHandler() and
    processLogMessage(). Handler validates payloads, enriches context with
    source:'renderer' and rendererTimestamp. 32 tests. Committed as 48e6810.
    Proceeding to T-create-integration-tests-for.
  - "Auto-completed: All child tasks are complete"
  - Completed T-create-integration-tests-for. Created
    src/services/logger.integration.test.ts with 21 integration tests covering
    file transport, log rotation, IPC flow, log level filtering, and privacy
    features. All tests use temp directories with proper cleanup. Committed as
    70d3355. All 4 tasks complete.
  - Documentation updated (CLAUDE.md and README.md). Feature complete with all 4
    tasks done, 5 commits on feature branch, 706 tests passing.
schema: v1.0
childrenIds:
  - T-create-integration-tests-for
  - T-implement-core-pino-logger
  - T-implement-ipc-log-handler-in
  - T-implement-privacy-aware
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
