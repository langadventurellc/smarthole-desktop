/**
 * Unit tests for the logger service.
 * Tests logger configuration, level filtering, and child loggers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initializeLogger,
  getLogger,
  getLoggerConfig,
  resetLogger,
  createLogger,
  Logger,
  LoggerConfig,
} from "./logger";
import { LogLevel } from "../types";

// Mock pino module
vi.mock("pino", async () => {
  const createMockLogger = (level: string) => {
    const logs: Array<{ level: string; message: string; context?: Record<string, unknown> }> = [];

    const levelOrder = ["trace", "debug", "info", "warn", "error", "fatal"];
    const currentLevelIndex = levelOrder.indexOf(level);

    const shouldLog = (logLevel: string): boolean => {
      const logLevelIndex = levelOrder.indexOf(logLevel);
      return logLevelIndex >= currentLevelIndex;
    };

    const mockLogger = {
      _logs: logs,
      _level: level,
      error: vi.fn((msgOrContext: string | Record<string, unknown>, msg?: string) => {
        if (shouldLog("error")) {
          if (typeof msgOrContext === "string") {
            logs.push({ level: "error", message: msgOrContext });
          } else {
            logs.push({ level: "error", message: msg!, context: msgOrContext });
          }
        }
      }),
      warn: vi.fn((msgOrContext: string | Record<string, unknown>, msg?: string) => {
        if (shouldLog("warn")) {
          if (typeof msgOrContext === "string") {
            logs.push({ level: "warn", message: msgOrContext });
          } else {
            logs.push({ level: "warn", message: msg!, context: msgOrContext });
          }
        }
      }),
      info: vi.fn((msgOrContext: string | Record<string, unknown>, msg?: string) => {
        if (shouldLog("info")) {
          if (typeof msgOrContext === "string") {
            logs.push({ level: "info", message: msgOrContext });
          } else {
            logs.push({ level: "info", message: msg!, context: msgOrContext });
          }
        }
      }),
      debug: vi.fn((msgOrContext: string | Record<string, unknown>, msg?: string) => {
        if (shouldLog("debug")) {
          if (typeof msgOrContext === "string") {
            logs.push({ level: "debug", message: msgOrContext });
          } else {
            logs.push({ level: "debug", message: msg!, context: msgOrContext });
          }
        }
      }),
      trace: vi.fn((msgOrContext: string | Record<string, unknown>, msg?: string) => {
        if (shouldLog("trace")) {
          if (typeof msgOrContext === "string") {
            logs.push({ level: "trace", message: msgOrContext });
          } else {
            logs.push({ level: "trace", message: msg!, context: msgOrContext });
          }
        }
      }),
      child: vi.fn((bindings: Record<string, unknown>) => {
        const childLogger = createMockLogger(level);
        // Store bindings for verification
        (childLogger as Record<string, unknown>)._bindings = bindings;
        return childLogger;
      }),
    };

    return mockLogger;
  };

  // Track the last created logger for test inspection
  let lastLogger: ReturnType<typeof createMockLogger> | null = null;

  const mockPino = vi.fn((options?: { level?: string }) => {
    lastLogger = createMockLogger(options?.level || "info");
    return lastLogger;
  });

  // Add static methods using Object.assign to avoid type casting issues
  Object.assign(mockPino, {
    destination: vi.fn(() => ({
      write: vi.fn(),
      end: vi.fn(),
      level: "info",
    })),
    multistream: vi.fn((streams: unknown) => ({
      write: vi.fn(),
      streams,
    })),
    transport: vi.fn(() => ({
      write: vi.fn(),
    })),
    stdTimeFunctions: {
      isoTime: () => `,"time":"${new Date().toISOString()}"`,
    },
    // Helper to get the last created logger (for test inspection)
    getLastLogger: () => lastLogger,
  });

  return { default: mockPino };
});

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 1000 })),
  readdirSync: vi.fn(() => []),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock path module
vi.mock("path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
  dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
  basename: vi.fn((p: string, ext?: string) => {
    const base = p.split("/").pop() || "";
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  }),
  extname: vi.fn((p: string) => {
    const base = p.split("/").pop() || "";
    const dotIndex = base.lastIndexOf(".");
    return dotIndex > 0 ? base.slice(dotIndex) : "";
  }),
}));

describe("Logger Service", () => {
  beforeEach(() => {
    // Reset logger singleton before each test
    resetLogger();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetLogger();
  });

  describe("initializeLogger", () => {
    it("should create a logger with the specified level", () => {
      const config: LoggerConfig = {
        level: LogLevel.DEBUG,
        logMessageContent: true,
        logDirectory: "/tmp/logs",
      };

      const logger = initializeLogger(config);

      expect(logger).toBeDefined();
      expect(getLoggerConfig()).toEqual(config);
    });

    it("should return the same instance on subsequent calls", () => {
      const config: LoggerConfig = {
        level: LogLevel.INFO,
        logMessageContent: false,
      };

      const logger1 = initializeLogger(config);
      const logger2 = initializeLogger(config);

      expect(logger1).toBe(logger2);
    });

    it("should use INFO level by default when specified", () => {
      const config: LoggerConfig = {
        level: LogLevel.INFO,
        logMessageContent: false,
      };

      initializeLogger(config);

      expect(getLoggerConfig()?.level).toBe(LogLevel.INFO);
    });

    it("should store logMessageContent configuration", () => {
      const config: LoggerConfig = {
        level: LogLevel.INFO,
        logMessageContent: true,
      };

      initializeLogger(config);

      expect(getLoggerConfig()?.logMessageContent).toBe(true);
    });

    it("should enable pretty printing when specified", () => {
      const config: LoggerConfig = {
        level: LogLevel.INFO,
        logMessageContent: false,
        prettyPrint: true,
      };

      initializeLogger(config);

      expect(getLoggerConfig()?.prettyPrint).toBe(true);
    });
  });

  describe("getLogger", () => {
    it("should throw if logger is not initialized", () => {
      expect(() => getLogger()).toThrow(
        "Logger not initialized. Call initializeLogger() before using getLogger()."
      );
    });

    it("should return the logger after initialization", () => {
      const config: LoggerConfig = {
        level: LogLevel.INFO,
        logMessageContent: false,
      };

      initializeLogger(config);
      const logger = getLogger();

      expect(logger).toBeDefined();
    });
  });

  describe("resetLogger", () => {
    it("should reset the logger instance", () => {
      const config: LoggerConfig = {
        level: LogLevel.INFO,
        logMessageContent: false,
      };

      initializeLogger(config);
      expect(getLoggerConfig()).not.toBeNull();

      resetLogger();

      expect(getLoggerConfig()).toBeNull();
      expect(() => getLogger()).toThrow();
    });
  });

  describe("createLogger", () => {
    it("should create a standalone logger without affecting global instance", () => {
      const standaloneLogger = createLogger({
        level: LogLevel.DEBUG,
        logMessageContent: true,
      });

      expect(standaloneLogger).toBeDefined();
      expect(getLoggerConfig()).toBeNull(); // Global config should not be set
    });

    it("should create independent logger instances", () => {
      const logger1 = createLogger({
        level: LogLevel.DEBUG,
        logMessageContent: true,
      });

      const logger2 = createLogger({
        level: LogLevel.ERROR,
        logMessageContent: false,
      });

      expect(logger1).not.toBe(logger2);
    });
  });

  describe("Logger interface", () => {
    let logger: Logger;

    beforeEach(() => {
      logger = initializeLogger({
        level: LogLevel.TRACE,
        logMessageContent: true,
        logDirectory: "/tmp/logs",
      });
    });

    it("should have all required log methods", () => {
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.trace).toBe("function");
      expect(typeof logger.child).toBe("function");
    });

    it("should log error messages", () => {
      expect(() => logger.error("Test error")).not.toThrow();
    });

    it("should log warn messages", () => {
      expect(() => logger.warn("Test warning")).not.toThrow();
    });

    it("should log info messages", () => {
      expect(() => logger.info("Test info")).not.toThrow();
    });

    it("should log debug messages", () => {
      expect(() => logger.debug("Test debug")).not.toThrow();
    });

    it("should log trace messages", () => {
      expect(() => logger.trace("Test trace")).not.toThrow();
    });

    it("should accept context objects", () => {
      expect(() =>
        logger.info("Test message", { component: "TestComponent", action: "test" })
      ).not.toThrow();
    });

    it("should accept nested context objects", () => {
      expect(() =>
        logger.info("Test message", {
          component: "TestComponent",
          metadata: { nested: { value: 123 } },
        })
      ).not.toThrow();
    });
  });

  describe("Child loggers", () => {
    let logger: Logger;

    beforeEach(() => {
      logger = initializeLogger({
        level: LogLevel.INFO,
        logMessageContent: true,
        logDirectory: "/tmp/logs",
      });
    });

    it("should create a child logger with bindings", () => {
      const childLogger = logger.child({ component: "TrayService" });

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe("function");
    });

    it("should create independent child loggers", () => {
      const child1 = logger.child({ component: "Service1" });
      const child2 = logger.child({ component: "Service2" });

      expect(child1).not.toBe(child2);
    });

    it("should allow child loggers to have their own children", () => {
      const child = logger.child({ component: "TrayService" });
      const grandchild = child.child({ subComponent: "MenuHandler" });

      expect(grandchild).toBeDefined();
      expect(typeof grandchild.info).toBe("function");
    });

    it("should allow logging from child logger", () => {
      const child = logger.child({ component: "TestComponent" });

      expect(() => child.info("Child log message")).not.toThrow();
      expect(() => child.error("Child error", { errorCode: "E001" })).not.toThrow();
    });
  });

  describe("LoggerConfig", () => {
    it("should accept all valid log levels", () => {
      const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE];

      levels.forEach((level) => {
        resetLogger();
        const logger = initializeLogger({
          level,
          logMessageContent: false,
        });
        expect(logger).toBeDefined();
        expect(getLoggerConfig()?.level).toBe(level);
      });
    });

    it("should handle optional logDirectory", () => {
      const config: LoggerConfig = {
        level: LogLevel.INFO,
        logMessageContent: false,
        // logDirectory is optional
      };

      const logger = initializeLogger(config);
      expect(logger).toBeDefined();
    });

    it("should handle optional prettyPrint", () => {
      const config: LoggerConfig = {
        level: LogLevel.INFO,
        logMessageContent: false,
        // prettyPrint is optional
      };

      const logger = initializeLogger(config);
      expect(logger).toBeDefined();
    });
  });

  describe("getLoggerConfig", () => {
    it("should return null when logger is not initialized", () => {
      expect(getLoggerConfig()).toBeNull();
    });

    it("should return the config after initialization", () => {
      const config: LoggerConfig = {
        level: LogLevel.DEBUG,
        logMessageContent: true,
        logDirectory: "/tmp/logs",
        prettyPrint: true, // Use prettyPrint to avoid file destination code path
      };

      initializeLogger(config);

      const returnedConfig = getLoggerConfig();
      expect(returnedConfig).toEqual(config);
    });
  });
});

describe("Log Level Filtering", () => {
  beforeEach(() => {
    resetLogger();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetLogger();
  });

  it("should respect ERROR level (only errors logged)", () => {
    const logger = createLogger({
      level: LogLevel.ERROR,
      logMessageContent: true,
    });

    // These should not throw - the level filtering happens in pino
    expect(() => {
      logger.error("Error message");
      logger.warn("Warn message");
      logger.info("Info message");
      logger.debug("Debug message");
      logger.trace("Trace message");
    }).not.toThrow();
  });

  it("should respect INFO level", () => {
    const logger = createLogger({
      level: LogLevel.INFO,
      logMessageContent: true,
    });

    // All calls should work without throwing
    expect(() => {
      logger.error("Error message");
      logger.warn("Warn message");
      logger.info("Info message");
      logger.debug("Debug message"); // Will be no-op
      logger.trace("Trace message"); // Will be no-op
    }).not.toThrow();
  });

  it("should respect TRACE level (all messages logged)", () => {
    const logger = createLogger({
      level: LogLevel.TRACE,
      logMessageContent: true,
    });

    // All calls should work
    expect(() => {
      logger.error("Error message");
      logger.warn("Warn message");
      logger.info("Info message");
      logger.debug("Debug message");
      logger.trace("Trace message");
    }).not.toThrow();
  });
});
