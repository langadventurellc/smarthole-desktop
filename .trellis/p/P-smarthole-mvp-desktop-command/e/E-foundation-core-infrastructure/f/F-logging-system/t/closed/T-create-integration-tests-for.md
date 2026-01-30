---
id: T-create-integration-tests-for
title: Create integration tests for logging system
status: done
priority: medium
parent: F-logging-system
prerequisites:
  - T-implement-ipc-log-handler-in
affectedFiles:
  src/services/logger.integration.test.ts: Created new integration test file with
    21 tests covering file writing, log rotation, IPC flow, log level filtering,
    and privacy features
log:
  - >-
    Starting implementation. Reviewed:

    - src/services/logger.ts - Core logger with pino, file transport, rotation,
    privacy sanitization

    - src/ipc/log-handler.ts - IPC handler for renderer logs

    - src/services/logger.test.ts - Unit tests (mocked pino)

    - src/types/ - LogLevel, LogMessagePayload, type guards

    - vitest.config.ts - Test configuration


    Plan:

    1. Create integration tests using real file system

    2. Test file writing and reading

    3. Test log rotation with low threshold

    4. Test IPC flow (simulated)

    5. Test log level filtering with file verification

    6. Test privacy integration with file verification
  - >-
    Created comprehensive integration tests for the logging system at
    src/services/logger.integration.test.ts. The tests verify end-to-end
    functionality using real file system I/O with temporary directories that are
    cleaned up after each test.


    Test coverage includes:

    1. **File Writing Integration** (5 tests): Verifies logs are written to disk
    with correct content, timestamps, multiple entries, nested directories, and
    special characters.

    2. **Log Rotation Integration** (2 tests): Verifies size-based log rotation
    triggers correctly and preserves old log files.

    3. **IPC Flow Integration** (3 tests): Verifies renderer-to-main logging via
    processLogMessage, including context enrichment (source, rendererTimestamp),
    invalid payload rejection, and all log levels.

    4. **Log Level Filtering Integration** (5 tests): Verifies each log level
    (ERROR, WARN, INFO, DEBUG, TRACE) correctly filters messages in the output
    files.

    5. **Privacy Integration** (6 tests): Verifies sensitive data redaction
    (apiKey, password, token, etc.), content redaction when logMessageContent is
    false, nested object handling, array handling, and combined sanitization.


    Key implementation details:

    - Uses temp directories via mkdtemp() with cleanup in afterEach

    - Handles pino's async SonicBoom destination with proper ready-state waiting

    - Tests use real pino file transport (not mocked) for true integration
    testing

    - Low rotation threshold (500 bytes) for practical rotation testing
schema: v1.0
childrenIds: []
created: 2026-01-30T01:28:25.513Z
updated: 2026-01-30T01:28:25.513Z
---

# Create Integration Tests for Logging System

## Context

This task creates integration tests that verify the complete logging system works end-to-end, including file writing and IPC flow from renderer to main process.

**Parent Feature**: F-logging-system
**Prerequisite Task**: T-implement-ipc-log-handler-in

## What to Build

### 1. File Writing Integration Test

Test that logs are actually written to disk:

```typescript
describe("Logger file transport", () => {
  it("writes logs to file", async () => {
    // Initialize logger with test log directory
    // Log messages
    // Read log file and verify contents
  });

  it("rotates files when size limit exceeded", async () => {
    // Write enough data to trigger rotation
    // Verify new file created
    // Verify old file preserved or archived
  });
});
```

### 2. IPC Flow Integration Test

Test renderer-to-main logging flow:

```typescript
describe("IPC logging flow", () => {
  it("logs from renderer reach main process logger", async () => {
    // Simulate IPC message
    // Verify logger received message
    // Verify context enrichment
  });
});
```

### 3. Log Level Filtering Integration

Verify log levels work correctly end-to-end:

```typescript
describe("Log level filtering", () => {
  it("respects configured log level", async () => {
    // Set level to 'warn'
    // Log at all levels
    // Verify only warn and above appear in file
  });
});
```

### 4. Privacy Integration Test

Verify privacy features work in integrated environment:

```typescript
describe("Privacy integration", () => {
  it("redacts content when logMessageContent is false", async () => {
    // Configure with logMessageContent: false
    // Log with user content
    // Read file and verify redaction
  });
});
```

## File Locations

- Create: `src/services/logger.integration.test.ts`

## Technical Approach

1. Use temp directories for log files (cleanup after tests)
2. Mock Electron's `app.getPath()` to return test directory
3. For IPC tests, mock `ipcMain` and `ipcRenderer`
4. Use real file system (not mocked) for file transport tests
5. Add cleanup in `afterEach` to remove test files

## Test Infrastructure

```typescript
import { tmpdir } from "os";
import { mkdtemp, rm, readFile } from "fs/promises";
import path from "path";

let testLogDir: string;

beforeEach(async () => {
  testLogDir = await mkdtemp(path.join(tmpdir(), "smarthole-log-test-"));
});

afterEach(async () => {
  await rm(testLogDir, { recursive: true, force: true });
});
```

## Acceptance Criteria

- [ ] Integration test file created at `src/services/logger.integration.test.ts`
- [ ] File writing test verifies logs appear on disk
- [ ] Log rotation test verifies size-based rotation works
- [ ] IPC flow test verifies renderer->main logging
- [ ] Log level filtering test verifies level configuration
- [ ] Privacy test verifies content redaction in files
- [ ] All tests clean up temp files after execution
- [ ] Tests pass in CI environment

## Testing Requirements

- Use vitest for test runner (matches existing setup)
- Tests should be isolated (no shared state between tests)
- Use realistic test data (not just "test message")
- Verify actual file contents, not just that logging doesn't error

## Performance Considerations

- Integration tests may be slower - consider separate test script
- Use reasonable file sizes for rotation tests (don't write 10MB in CI)
- Set rotation threshold low (e.g., 1KB) for testing purposes

## Dependencies

- T-implement-ipc-log-handler-in (full logging system must be complete)
- vitest (already installed)
- Node.js fs/promises for file operations
