---
id: T-implement-core-pino-logger
title: Implement core pino logger with file transport
status: open
priority: high
parent: F-logging-system
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T01:27:27.902Z
updated: 2026-01-30T01:27:27.902Z
---

# Implement Core Pino Logger with File Transport

## Context

This is the first task for the F-logging-system feature. It implements the core logging infrastructure using pino with both console and file output.

**Parent Feature**: F-logging-system
**Prerequisite Feature**: F-core-types-ipc-architecture (completed - provides LogLevel types)

## What to Build

Create `src/services/logger.ts` and `src/services/index.ts` with:

### 1. Logger Initialization

```typescript
interface LoggerConfig {
  level: LogLevel;
  logMessageContent: boolean;
}

export function initializeLogger(config: LoggerConfig): Logger;
```

### 2. Pino Configuration

- Use `pino` as the core logging library
- Configure log levels matching `LogLevel` from `src/types/config.ts` (error, warn, info, debug, trace)
- Use pino-pretty for development console output (readable formatting)
- Use JSON output for production

### 3. File Transport

- Write logs to Electron's `app.getPath('logs')` directory
- Use `pino/file` transport or `pino.destination()` for async file writes
- Implement log rotation to prevent unbounded file growth:
  - Consider using `rotating-file-stream` or size-based rotation
  - Rotate when file exceeds 10MB or on daily basis
- File writes must be non-blocking (async)

### 4. Logger API

Implement the Logger interface:

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

### 5. Child Loggers

- Support creating child loggers for component-specific contexts
- Child loggers inherit parent configuration and add bindings
- Example usage: `logger.child({ component: 'TrayService' })`

## File Locations

- Create: `src/services/logger.ts` - Main logger implementation
- Create: `src/services/index.ts` - Barrel export

## Technical Approach

1. Install dependencies: `npm install pino pino-pretty`
2. For log rotation in Electron, consider using `pino.transport()` with a custom worker or `rotating-file-stream`
3. Use singleton pattern for the main logger instance
4. Wrap pino methods to match our Logger interface
5. Handle Electron's log path (`app.getPath('logs')`) - may need to defer initialization until app is ready

## Acceptance Criteria

- [ ] `src/services/` directory created with logger.ts and index.ts
- [ ] Pino logger initialized with configurable log levels
- [ ] Console output works in development with pino-pretty formatting
- [ ] File output writes to `app.getPath('logs')` directory
- [ ] Log rotation implemented (size-based, 10MB limit)
- [ ] File writes are asynchronous and non-blocking
- [ ] Child loggers support component-specific context
- [ ] Logger exported as singleton or factory from `src/services`
- [ ] Unit tests for logger configuration (level filtering, child loggers)

## Testing Requirements

- Unit tests for log level filtering (verify disabled levels are no-ops)
- Unit tests for child logger bindings
- Mock file system for file transport tests
- Verify pino configuration matches expected options

## Dependencies

- Uses `LogLevel` from `src/types/config.ts`
- Import pattern: `import { LogLevel } from '../types'`
