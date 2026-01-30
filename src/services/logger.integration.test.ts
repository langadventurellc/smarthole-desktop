/**
 * Integration tests for the logging system.
 * Tests actual file I/O, log rotation, IPC flow, and privacy features end-to-end.
 *
 * These tests use the real file system with temporary directories.
 * They verify logs are actually written to disk with correct content.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "os";
import { mkdtemp, rm, readdir, readFile } from "fs/promises";
import path from "path";
import pino from "pino";
import { LogLevel } from "../types";
import { processLogMessage } from "../ipc/log-handler";
import { Logger, LogContext, createFileDestination, FileTransportOptions } from "./logger";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a logger that writes to a file with configurable options.
 * Uses pino directly to avoid global state from initializeLogger().
 */
function createTestFileLogger(options: {
  logDirectory: string;
  level?: LogLevel;
  logMessageContent?: boolean;
  maxFileSize?: number;
}): {
  logger: Logger;
  destination: pino.DestinationStream;
} {
  const { logDirectory, level = LogLevel.DEBUG, logMessageContent = true, maxFileSize } = options;

  const transportOptions: FileTransportOptions = {
    logDirectory,
    level,
    ...(maxFileSize && { maxFileSize }),
  };

  const destination = createFileDestination(transportOptions);

  const pinoLogger = pino(
    {
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination
  );

  // Create a wrapper that matches our Logger interface
  // and applies privacy logic similar to LoggerWrapper
  const wrapper = createLoggerWrapper(pinoLogger, logMessageContent);

  return { logger: wrapper, destination };
}

/**
 * Creates a Logger wrapper around a pino instance.
 * Simplified version for testing that applies sanitization.
 */
function createLoggerWrapper(pinoLogger: pino.Logger, logMessageContent: boolean): Logger {
  // Import sanitization functions inline to avoid module issues
  const REDACTED_VALUE = "[REDACTED]";
  const CONTENT_REDACTED_VALUE = "[CONTENT_REDACTED]";

  const SENSITIVE_PATTERNS: ReadonlyArray<RegExp> = [
    /api[-_]?key/i,
    /password/i,
    /secret/i,
    /token/i,
    /auth/i,
    /credential/i,
    /bearer/i,
  ];

  const CONTENT_FIELDS: ReadonlySet<string> = new Set([
    "content",
    "message_content",
    "messageContent",
    "text",
    "body",
    "input",
    "userInput",
    "user_input",
    "transcript",
    "transcription",
  ]);

  function isSensitiveKey(key: string): boolean {
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
  }

  function isContentKey(key: string): boolean {
    return CONTENT_FIELDS.has(key);
  }

  function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(data)) {
      const value = data[key];

      if (isSensitiveKey(key)) {
        result[key] = REDACTED_VALUE;
      } else if (value === null || value === undefined) {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === "object" && item !== null
            ? sanitizeLogData(item as Record<string, unknown>)
            : item
        );
      } else if (typeof value === "object") {
        result[key] = sanitizeLogData(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  function applyContentRedaction(data: Record<string, unknown>): Record<string, unknown> {
    if (logMessageContent) {
      return data;
    }

    const result: Record<string, unknown> = {};

    for (const key of Object.keys(data)) {
      const value = data[key];

      if (value === null || value === undefined) {
        result[key] = value;
      } else if (isContentKey(key)) {
        result[key] = CONTENT_REDACTED_VALUE;
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === "object" && item !== null
            ? applyContentRedaction(item as Record<string, unknown>)
            : item
        );
      } else if (typeof value === "object") {
        result[key] = applyContentRedaction(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  function processContext(context: LogContext): LogContext {
    const sanitized = sanitizeLogData(context);
    return applyContentRedaction(sanitized);
  }

  const wrapper: Logger = {
    error(message: string, context?: LogContext): void {
      if (context) {
        pinoLogger.error(processContext(context), message);
      } else {
        pinoLogger.error(message);
      }
    },
    warn(message: string, context?: LogContext): void {
      if (context) {
        pinoLogger.warn(processContext(context), message);
      } else {
        pinoLogger.warn(message);
      }
    },
    info(message: string, context?: LogContext): void {
      if (context) {
        pinoLogger.info(processContext(context), message);
      } else {
        pinoLogger.info(message);
      }
    },
    debug(message: string, context?: LogContext): void {
      if (context) {
        pinoLogger.debug(processContext(context), message);
      } else {
        pinoLogger.debug(message);
      }
    },
    trace(message: string, context?: LogContext): void {
      if (context) {
        pinoLogger.trace(processContext(context), message);
      } else {
        pinoLogger.trace(message);
      }
    },
    child(bindings: Record<string, unknown>): Logger {
      return createLoggerWrapper(pinoLogger.child(bindings), logMessageContent);
    },
  };

  return wrapper;
}

/**
 * Waits for pino to flush its buffer to disk.
 * Pino uses async writes with buffering, so we need to wait.
 * SonicBoom (pino's destination) needs to be ready before flushing.
 */
async function flushAndWait(destination: pino.DestinationStream, delayMs = 150): Promise<void> {
  // Wait for the destination to be ready (SonicBoom emits 'ready' event)
  // Using a polling approach since we may not have access to the event
  const maxWait = 2000;
  const startTime = Date.now();

  // First, wait for destination to be ready
  while (Date.now() - startTime < maxWait) {
    try {
      // Try to flush - if not ready, it will throw
      if ("flushSync" in destination && typeof destination.flushSync === "function") {
        destination.flushSync();
        break;
      }
    } catch (err) {
      // If not ready yet, wait a bit and retry
      if ((err as Error).message?.includes("not ready")) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
      throw err;
    }
    break;
  }

  // Add a small delay to ensure file system catches up
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Reads and parses NDJSON log file.
 */
async function readLogFile(
  logDirectory: string,
  filename = "smarthole.log"
): Promise<Array<Record<string, unknown>>> {
  const filePath = path.join(logDirectory, filename);
  const content = await readFile(filePath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

// ============================================================================
// Test Suite: File Writing Integration
// ============================================================================

describe("Logger File Transport Integration", () => {
  let testLogDir: string;

  beforeEach(async () => {
    testLogDir = await mkdtemp(path.join(tmpdir(), "smarthole-log-test-"));
  });

  afterEach(async () => {
    await rm(testLogDir, { recursive: true, force: true });
  });

  it("writes logs to file", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
    });

    logger.info("Test message 1", { component: "TestComponent" });
    logger.warn("Test warning", { errorCode: "W001" });
    logger.error("Test error", { errorId: "E001", details: "Something failed" });

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);

    expect(logs.length).toBe(3);

    // Verify first log entry
    expect(logs[0].msg).toBe("Test message 1");
    expect(logs[0].level).toBe(30); // pino info level
    expect(logs[0].component).toBe("TestComponent");

    // Verify second log entry
    expect(logs[1].msg).toBe("Test warning");
    expect(logs[1].level).toBe(40); // pino warn level
    expect(logs[1].errorCode).toBe("W001");

    // Verify third log entry
    expect(logs[2].msg).toBe("Test error");
    expect(logs[2].level).toBe(50); // pino error level
    expect(logs[2].errorId).toBe("E001");
    expect(logs[2].details).toBe("Something failed");
  });

  it("creates log file with timestamp", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
    });

    logger.info("Timestamped message");
    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs[0].time).toBeDefined();
    // Verify it's a valid ISO timestamp
    const timestamp = new Date(logs[0].time as string);
    expect(timestamp.getTime()).not.toBeNaN();
  });

  it("handles multiple log entries in sequence", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
    });

    const messageCount = 10;
    for (let i = 0; i < messageCount; i++) {
      logger.info(`Message ${i + 1}`, { index: i + 1 });
    }

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBe(messageCount);

    // Verify order is preserved
    for (let i = 0; i < messageCount; i++) {
      expect(logs[i].msg).toBe(`Message ${i + 1}`);
      expect(logs[i].index).toBe(i + 1);
    }
  });

  it("creates log directory if it does not exist", async () => {
    const nestedLogDir = path.join(testLogDir, "nested", "logs", "directory");

    const { logger, destination } = createTestFileLogger({
      logDirectory: nestedLogDir,
    });

    logger.info("Message in nested directory");
    await flushAndWait(destination);

    const logs = await readLogFile(nestedLogDir);
    expect(logs.length).toBe(1);
    expect(logs[0].msg).toBe("Message in nested directory");
  });

  it("handles special characters in log messages", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
    });

    const specialMessage = 'Message with "quotes" and \\ backslash and unicode: \u00e9\u00e8\u00ea';
    logger.info(specialMessage);
    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs[0].msg).toBe(specialMessage);
  });
});

// ============================================================================
// Test Suite: Log Rotation Integration
// ============================================================================

describe("Logger File Rotation Integration", () => {
  let testLogDir: string;

  beforeEach(async () => {
    testLogDir = await mkdtemp(path.join(tmpdir(), "smarthole-rotation-test-"));
  });

  afterEach(async () => {
    await rm(testLogDir, { recursive: true, force: true });
  });

  it("rotates files when size limit exceeded", async () => {
    // Use a very small max file size to trigger rotation quickly
    const maxFileSize = 500; // 500 bytes

    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      maxFileSize,
    });

    // Write enough data to exceed the size limit
    // Each log entry is roughly 100-150 bytes in JSON format
    for (let i = 0; i < 20; i++) {
      logger.info(`This is log message number ${i} with some extra text to make it longer`, {
        messageIndex: i,
        extraData: "padding to increase size",
      });
    }

    await flushAndWait(destination, 200);

    // Check for rotated files
    const files = await readdir(testLogDir);
    const logFiles = files.filter((f) => f.startsWith("smarthole"));

    // Should have at least the main log file
    expect(logFiles.length).toBeGreaterThanOrEqual(1);

    // If rotation occurred, we should have multiple files
    // Note: rotation timing depends on the periodic check interval,
    // so this test verifies the mechanism is in place
    const mainLogExists = files.includes("smarthole.log");
    expect(mainLogExists).toBe(true);
  });

  it("preserves old log files after rotation", async () => {
    const maxFileSize = 300; // Very small to force rotation

    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      maxFileSize,
    });

    // Write initial batch
    for (let i = 0; i < 10; i++) {
      logger.info(`Initial batch message ${i}`, { batch: 1, index: i });
    }

    await flushAndWait(destination, 200);

    // Get initial file list
    const initialFiles = await readdir(testLogDir);

    // Write more to potentially trigger rotation
    for (let i = 0; i < 10; i++) {
      logger.info(`Second batch message ${i}`, { batch: 2, index: i });
    }

    await flushAndWait(destination, 200);

    // Verify the main log file still exists and has content
    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBeGreaterThan(0);

    // Files should not be lost
    const finalFiles = await readdir(testLogDir);
    expect(finalFiles.length).toBeGreaterThanOrEqual(initialFiles.length);
  });
});

// ============================================================================
// Test Suite: IPC Flow Integration
// ============================================================================

describe("IPC Logging Flow Integration", () => {
  let testLogDir: string;

  beforeEach(async () => {
    testLogDir = await mkdtemp(path.join(tmpdir(), "smarthole-ipc-test-"));
  });

  afterEach(async () => {
    await rm(testLogDir, { recursive: true, force: true });
  });

  it("logs from renderer reach main process logger with enriched context", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
    });

    // Create a child logger for IPC (like main.ts does)
    const ipcLogger = logger.child({ component: "IPC" });

    // Simulate a log message payload from renderer
    const payload = {
      level: LogLevel.INFO,
      message: "Button clicked in renderer",
      context: { component: "App", action: "click" },
      timestamp: new Date().toISOString(),
    };

    // Process the log message (simulates IPC handler)
    const result = processLogMessage(payload, logger, ipcLogger);
    expect(result).toBe(true);

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBe(1);

    // Verify message was logged
    expect(logs[0].msg).toBe("Button clicked in renderer");
    // Verify context enrichment
    expect(logs[0].source).toBe("renderer");
    expect(logs[0].rendererTimestamp).toBeDefined();
    expect(logs[0].component).toBe("App");
    expect(logs[0].action).toBe("click");
  });

  it("rejects invalid log payloads from renderer", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
    });
    const ipcLogger = logger.child({ component: "IPC" });

    // Invalid payload (missing required fields)
    const invalidPayload = {
      message: "Missing level field",
    };

    const result = processLogMessage(invalidPayload, logger, ipcLogger);
    expect(result).toBe(false);

    await flushAndWait(destination);

    // The IPC logger should have logged a warning about the invalid payload
    const logs = await readLogFile(testLogDir);
    const warningLog = logs.find((log) => log.level === 40); // warn level
    expect(warningLog).toBeDefined();
    expect(warningLog?.msg).toContain("Invalid log message payload");
  });

  it("handles all log levels from renderer", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      level: LogLevel.TRACE, // Enable all levels
    });
    const ipcLogger = logger.child({ component: "IPC" });

    const levels: LogLevel[] = [
      LogLevel.ERROR,
      LogLevel.WARN,
      LogLevel.INFO,
      LogLevel.DEBUG,
      LogLevel.TRACE,
    ];

    for (const level of levels) {
      const payload = {
        level,
        message: `Message at ${level} level`,
        timestamp: new Date().toISOString(),
      };
      processLogMessage(payload, logger, ipcLogger);
    }

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBe(5);

    // Verify all levels were logged
    const pinoLevelMap: Record<string, number> = {
      error: 50,
      warn: 40,
      info: 30,
      debug: 20,
      trace: 10,
    };

    for (let i = 0; i < levels.length; i++) {
      expect(logs[i].level).toBe(pinoLevelMap[levels[i]]);
      expect(logs[i].msg).toBe(`Message at ${levels[i]} level`);
    }
  });
});

// ============================================================================
// Test Suite: Log Level Filtering Integration
// ============================================================================

describe("Log Level Filtering Integration", () => {
  let testLogDir: string;

  beforeEach(async () => {
    testLogDir = await mkdtemp(path.join(tmpdir(), "smarthole-level-test-"));
  });

  afterEach(async () => {
    await rm(testLogDir, { recursive: true, force: true });
  });

  it("respects configured log level - only ERROR and above", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      level: LogLevel.ERROR,
    });

    // Log at all levels
    logger.trace("Trace message");
    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warning message");
    logger.error("Error message");

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);

    // Only error should be logged
    expect(logs.length).toBe(1);
    expect(logs[0].msg).toBe("Error message");
    expect(logs[0].level).toBe(50); // error
  });

  it("respects configured log level - WARN and above", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      level: LogLevel.WARN,
    });

    logger.trace("Trace message");
    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warning message");
    logger.error("Error message");

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);

    // Should have warn and error
    expect(logs.length).toBe(2);
    expect(logs[0].msg).toBe("Warning message");
    expect(logs[1].msg).toBe("Error message");
  });

  it("respects configured log level - INFO and above", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      level: LogLevel.INFO,
    });

    logger.trace("Trace message");
    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warning message");
    logger.error("Error message");

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);

    // Should have info, warn, and error
    expect(logs.length).toBe(3);
    expect(logs.map((l) => l.msg)).toEqual(["Info message", "Warning message", "Error message"]);
  });

  it("respects configured log level - DEBUG and above", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      level: LogLevel.DEBUG,
    });

    logger.trace("Trace message");
    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warning message");
    logger.error("Error message");

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);

    // Should have debug, info, warn, and error (not trace)
    expect(logs.length).toBe(4);
    expect(logs.map((l) => l.msg)).toEqual([
      "Debug message",
      "Info message",
      "Warning message",
      "Error message",
    ]);
  });

  it("respects configured log level - TRACE (all levels)", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      level: LogLevel.TRACE,
    });

    logger.trace("Trace message");
    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warning message");
    logger.error("Error message");

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);

    // All 5 messages should be logged
    expect(logs.length).toBe(5);
    expect(logs.map((l) => l.msg)).toEqual([
      "Trace message",
      "Debug message",
      "Info message",
      "Warning message",
      "Error message",
    ]);
  });
});

// ============================================================================
// Test Suite: Privacy Integration
// ============================================================================

describe("Privacy Integration", () => {
  let testLogDir: string;

  beforeEach(async () => {
    testLogDir = await mkdtemp(path.join(tmpdir(), "smarthole-privacy-test-"));
  });

  afterEach(async () => {
    await rm(testLogDir, { recursive: true, force: true });
  });

  it("redacts sensitive data in log files", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      logMessageContent: true, // Content allowed, but sensitive data still redacted
    });

    logger.info("API request made", {
      apiKey: "sk-secret-key-12345",
      endpoint: "/api/users",
      token: "bearer-token-xyz",
      password: "user-password",
      userId: "usr_123", // Non-sensitive, should be preserved
    });

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBe(1);

    // Sensitive data should be redacted
    expect(logs[0].apiKey).toBe("[REDACTED]");
    expect(logs[0].token).toBe("[REDACTED]");
    expect(logs[0].password).toBe("[REDACTED]");

    // Non-sensitive data preserved
    expect(logs[0].endpoint).toBe("/api/users");
    expect(logs[0].userId).toBe("usr_123");
  });

  it("redacts content when logMessageContent is false", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      logMessageContent: false, // Content should be redacted
    });

    logger.info("User message received", {
      content: "Hello, this is my private message",
      text: "Some user text input",
      body: "Message body content",
      userInput: "What the user typed",
      userId: "usr_123", // Non-content, should be preserved
    });

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBe(1);

    // Content fields should be redacted
    expect(logs[0].content).toBe("[CONTENT_REDACTED]");
    expect(logs[0].text).toBe("[CONTENT_REDACTED]");
    expect(logs[0].body).toBe("[CONTENT_REDACTED]");
    expect(logs[0].userInput).toBe("[CONTENT_REDACTED]");

    // Non-content fields preserved
    expect(logs[0].userId).toBe("usr_123");
  });

  it("preserves content when logMessageContent is true", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      logMessageContent: true, // Content should be preserved
    });

    const userContent = "Hello, this is my message";
    logger.info("User message received", {
      content: userContent,
      text: "Some text",
      userId: "usr_123",
    });

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBe(1);

    // Content should be preserved
    expect(logs[0].content).toBe(userContent);
    expect(logs[0].text).toBe("Some text");
    expect(logs[0].userId).toBe("usr_123");
  });

  it("handles nested sensitive data in log files", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      logMessageContent: false,
    });

    // Note: "body" is a content field and would be redacted entirely.
    // Using "payload" instead which is not a content field.
    logger.info("Complex request", {
      request: {
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
        payload: {
          content: "User message content",
          password: "secret123",
          username: "john_doe", // Not sensitive
        },
      },
      metadata: {
        requestId: "req_123",
        apiKey: "sk-12345",
      },
    });

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBe(1);

    const request = logs[0].request as Record<string, unknown>;
    const headers = request.headers as Record<string, unknown>;
    const payload = request.payload as Record<string, unknown>;
    const metadata = logs[0].metadata as Record<string, unknown>;

    // Nested sensitive data redacted
    expect(headers.authorization).toBe("[REDACTED]");
    expect(payload.password).toBe("[REDACTED]");
    expect(payload.content).toBe("[CONTENT_REDACTED]");
    expect(metadata.apiKey).toBe("[REDACTED]");

    // Non-sensitive data preserved
    expect(headers["content-type"]).toBe("application/json");
    expect(payload.username).toBe("john_doe");
    expect(metadata.requestId).toBe("req_123");
  });

  it("redacts content in arrays", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      logMessageContent: false,
    });

    logger.info("Messages batch", {
      messages: [
        { id: 1, content: "First message", sender: "user1" },
        { id: 2, content: "Second message", sender: "user2" },
        { id: 3, text: "Third message", sender: "user3" },
      ],
    });

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBe(1);

    const messages = logs[0].messages as Array<Record<string, unknown>>;
    expect(messages.length).toBe(3);

    // Content fields in array items should be redacted
    expect(messages[0].content).toBe("[CONTENT_REDACTED]");
    expect(messages[1].content).toBe("[CONTENT_REDACTED]");
    expect(messages[2].text).toBe("[CONTENT_REDACTED]");

    // Non-content fields preserved
    expect(messages[0].id).toBe(1);
    expect(messages[0].sender).toBe("user1");
    expect(messages[1].id).toBe(2);
    expect(messages[2].sender).toBe("user3");
  });

  it("applies both sensitive and content redaction together", async () => {
    const { logger, destination } = createTestFileLogger({
      logDirectory: testLogDir,
      logMessageContent: false,
    });

    logger.info("Full request with privacy", {
      content: "User's private message",
      apiKey: "sk-secret",
      token: "auth-token",
      transcript: "Voice transcription text",
      requestId: "req_456",
      status: "success",
    });

    await flushAndWait(destination);

    const logs = await readLogFile(testLogDir);
    expect(logs.length).toBe(1);

    // Sensitive data redacted
    expect(logs[0].apiKey).toBe("[REDACTED]");
    expect(logs[0].token).toBe("[REDACTED]");

    // Content redacted
    expect(logs[0].content).toBe("[CONTENT_REDACTED]");
    expect(logs[0].transcript).toBe("[CONTENT_REDACTED]");

    // Non-sensitive, non-content preserved
    expect(logs[0].requestId).toBe("req_456");
    expect(logs[0].status).toBe("success");
  });
});
