/**
 * Unit tests for the logger service.
 * Tests singleton pattern, sanitization, and content redaction.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initializeLogger,
  getLogger,
  getLoggerConfig,
  resetLogger,
  LoggerConfig,
  sanitizeLogData,
  applyContentRedaction,
} from "./logger";
import { LogLevel } from "../types";

// Mock pino module
vi.mock("pino", async () => {
  const createMockLogger = (level: string) => {
    return {
      _level: level,
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(() => createMockLogger(level)),
    };
  };

  const mockPino = vi.fn((options?: { level?: string }) => {
    return createMockLogger(options?.level || "info");
  });

  Object.assign(mockPino, {
    destination: vi.fn(() => ({ write: vi.fn(), end: vi.fn(), level: "info" })),
    multistream: vi.fn((streams: unknown) => ({ write: vi.fn(), streams })),
    transport: vi.fn(() => ({ write: vi.fn() })),
    stdTimeFunctions: { isoTime: () => `,"time":"${new Date().toISOString()}"` },
  });

  return { default: mockPino };
});

vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 1000 })),
  readdirSync: vi.fn(() => []),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock("path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
  dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
  basename: vi.fn((p: string) => p.split("/").pop() || ""),
  extname: vi.fn((p: string) => {
    const base = p.split("/").pop() || "";
    const dotIndex = base.lastIndexOf(".");
    return dotIndex > 0 ? base.slice(dotIndex) : "";
  }),
}));

describe("Logger Service", () => {
  beforeEach(() => {
    resetLogger();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetLogger();
  });

  it("should throw if getLogger called before initialization", () => {
    expect(() => getLogger()).toThrow(
      "Logger not initialized. Call initializeLogger() before using getLogger()."
    );
  });

  it("should return the same singleton instance on subsequent calls", () => {
    const config: LoggerConfig = { level: LogLevel.INFO, logMessageContent: false };

    const logger1 = initializeLogger(config);
    const logger2 = initializeLogger(config);

    expect(logger1).toBe(logger2);
    expect(getLoggerConfig()).toEqual(config);
  });

  it("should reset the logger instance and config", () => {
    initializeLogger({ level: LogLevel.INFO, logMessageContent: false });
    expect(getLoggerConfig()).not.toBeNull();

    resetLogger();

    expect(getLoggerConfig()).toBeNull();
    expect(() => getLogger()).toThrow();
  });
});

describe("sanitizeLogData", () => {
  it("should redact sensitive keys and preserve non-sensitive data", () => {
    const result = sanitizeLogData({
      apiKey: "sk-1234567890",
      password: "secret123",
      token: "jwt-token",
      userId: "usr_123",
      count: 42,
    });

    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
    expect(result.token).toBe("[REDACTED]");
    expect(result.userId).toBe("usr_123");
    expect(result.count).toBe(42);
  });

  it("should sanitize sensitive keys in nested objects", () => {
    const result = sanitizeLogData({
      user: { id: "usr_123", apiKey: "sk-nested" },
    });

    expect(result.user).toEqual({ id: "usr_123", apiKey: "[REDACTED]" });
  });
});

describe("applyContentRedaction", () => {
  it("should redact content fields when logMessageContent is false", () => {
    const result = applyContentRedaction(
      { content: "Hello", text: "text", userId: "usr_123" },
      false
    );

    expect(result.content).toBe("[CONTENT_REDACTED]");
    expect(result.text).toBe("[CONTENT_REDACTED]");
    expect(result.userId).toBe("usr_123");
  });

  it("should preserve content fields when logMessageContent is true", () => {
    const data = { content: "Hello", text: "text", userId: "usr_123" };
    const result = applyContentRedaction(data, true);
    expect(result).toEqual(data);
  });
});
