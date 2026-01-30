/**
 * Unit tests for the IPC log message handler.
 * Tests payload validation, log level mapping, and context enrichment.
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { IpcMainEvent } from "electron";
import { createLogMessageHandler, processLogMessage } from "./log-handler";
import { Logger } from "../services/logger";
import { LogMessagePayload } from "../types";

/**
 * Creates a mock logger for testing.
 */
function createMockLogger(): Logger & {
  error: Mock;
  warn: Mock;
  info: Mock;
  debug: Mock;
  trace: Mock;
  child: Mock;
} {
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
  return mockLogger;
}

/**
 * Creates a mock IpcMainEvent for testing.
 */
function createMockEvent(): IpcMainEvent {
  return {
    sender: {} as Electron.WebContents,
    frameId: 1,
    processId: 1,
    reply: vi.fn(),
    returnValue: undefined,
    ports: [],
    senderFrame: {} as Electron.WebFrameMain,
  } as unknown as IpcMainEvent;
}

describe("IPC Log Handler", () => {
  let logger: ReturnType<typeof createMockLogger>;
  let ipcLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
    ipcLogger = createMockLogger();
    vi.clearAllMocks();
  });

  describe("createLogMessageHandler", () => {
    it("should return a function", () => {
      const handler = createLogMessageHandler(logger, ipcLogger);
      expect(typeof handler).toBe("function");
    });

    it("should process valid payloads", () => {
      const handler = createLogMessageHandler(logger, ipcLogger);
      const event = createMockEvent();
      const payload: LogMessagePayload = {
        level: "info",
        message: "Test message",
        context: { component: "TestComponent" },
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      handler(event, payload);

      expect(logger.info).toHaveBeenCalledWith("Test message", {
        component: "TestComponent",
        source: "renderer",
        rendererTimestamp: "2024-01-15T10:30:00.000Z",
      });
    });

    it("should reject invalid payloads", () => {
      const handler = createLogMessageHandler(logger, ipcLogger);
      const event = createMockEvent();
      const invalidPayload = { invalid: "data" };

      handler(event, invalidPayload);

      expect(ipcLogger.warn).toHaveBeenCalledWith("Invalid log message payload received", {
        payload: invalidPayload,
      });
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe("processLogMessage", () => {
    describe("payload validation", () => {
      it("should return false for null payload", () => {
        const result = processLogMessage(null, logger, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalledWith("Invalid log message payload received", {
          payload: null,
        });
      });

      it("should return false for undefined payload", () => {
        const result = processLogMessage(undefined, logger, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for non-object payload", () => {
        const result = processLogMessage("not an object", logger, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for payload missing level", () => {
        const result = processLogMessage({ message: "Test" }, logger, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for payload missing message", () => {
        const result = processLogMessage({ level: "info" }, logger, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for invalid log level", () => {
        const result = processLogMessage({ level: "invalid", message: "Test" }, logger, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for non-string level", () => {
        const result = processLogMessage({ level: 123, message: "Test" }, logger, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for non-string message", () => {
        const result = processLogMessage({ level: "info", message: 123 }, logger, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for non-object context", () => {
        const result = processLogMessage(
          { level: "info", message: "Test", context: "invalid" },
          logger,
          ipcLogger
        );

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for non-string timestamp", () => {
        const result = processLogMessage(
          { level: "info", message: "Test", timestamp: 12345 },
          logger,
          ipcLogger
        );

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });
    });

    describe("valid payload processing", () => {
      it("should return true for valid payload", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "Test message",
        };

        const result = processLogMessage(payload, logger, ipcLogger);

        expect(result).toBe(true);
        expect(ipcLogger.warn).not.toHaveBeenCalled();
      });

      it("should accept payload with all optional fields", () => {
        const payload: LogMessagePayload = {
          level: "debug",
          message: "Full payload",
          context: { key: "value" },
          timestamp: "2024-01-15T10:30:00.000Z",
        };

        const result = processLogMessage(payload, logger, ipcLogger);

        expect(result).toBe(true);
      });

      it("should accept payload without optional fields", () => {
        const payload: LogMessagePayload = {
          level: "warn",
          message: "Minimal payload",
        };

        const result = processLogMessage(payload, logger, ipcLogger);

        expect(result).toBe(true);
      });
    });

    describe("log level mapping", () => {
      it("should forward error level logs", () => {
        const payload: LogMessagePayload = {
          level: "error",
          message: "Error message",
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.error).toHaveBeenCalledWith("Error message", {
          source: "renderer",
          rendererTimestamp: undefined,
        });
      });

      it("should forward warn level logs", () => {
        const payload: LogMessagePayload = {
          level: "warn",
          message: "Warning message",
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.warn).toHaveBeenCalledWith("Warning message", {
          source: "renderer",
          rendererTimestamp: undefined,
        });
      });

      it("should forward info level logs", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "Info message",
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.info).toHaveBeenCalledWith("Info message", {
          source: "renderer",
          rendererTimestamp: undefined,
        });
      });

      it("should forward debug level logs", () => {
        const payload: LogMessagePayload = {
          level: "debug",
          message: "Debug message",
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.debug).toHaveBeenCalledWith("Debug message", {
          source: "renderer",
          rendererTimestamp: undefined,
        });
      });

      it("should forward trace level logs", () => {
        const payload: LogMessagePayload = {
          level: "trace",
          message: "Trace message",
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.trace).toHaveBeenCalledWith("Trace message", {
          source: "renderer",
          rendererTimestamp: undefined,
        });
      });
    });

    describe("context enrichment", () => {
      it("should add source: renderer to context", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "Test",
          context: {},
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.info).toHaveBeenCalledWith(
          "Test",
          expect.objectContaining({ source: "renderer" })
        );
      });

      it("should preserve original timestamp as rendererTimestamp", () => {
        const timestamp = "2024-01-15T10:30:00.000Z";
        const payload: LogMessagePayload = {
          level: "info",
          message: "Test",
          timestamp,
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.info).toHaveBeenCalledWith(
          "Test",
          expect.objectContaining({ rendererTimestamp: timestamp })
        );
      });

      it("should preserve original context properties", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "Test",
          context: {
            component: "Button",
            action: "click",
            userId: "usr_123",
          },
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.info).toHaveBeenCalledWith(
          "Test",
          expect.objectContaining({
            component: "Button",
            action: "click",
            userId: "usr_123",
          })
        );
      });

      it("should combine all context correctly", () => {
        const payload: LogMessagePayload = {
          level: "debug",
          message: "User action",
          context: { component: "Form", field: "email" },
          timestamp: "2024-01-15T10:30:00.000Z",
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.debug).toHaveBeenCalledWith("User action", {
          component: "Form",
          field: "email",
          source: "renderer",
          rendererTimestamp: "2024-01-15T10:30:00.000Z",
        });
      });

      it("should handle undefined context", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "No context",
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.info).toHaveBeenCalledWith("No context", {
          source: "renderer",
          rendererTimestamp: undefined,
        });
      });

      it("should handle empty context object", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "Empty context",
          context: {},
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.info).toHaveBeenCalledWith("Empty context", {
          source: "renderer",
          rendererTimestamp: undefined,
        });
      });
    });

    describe("edge cases", () => {
      it("should handle nested context objects", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "Nested context",
          context: {
            user: { id: "123", name: "John" },
            meta: { nested: { deep: true } },
          },
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.info).toHaveBeenCalledWith(
          "Nested context",
          expect.objectContaining({
            user: { id: "123", name: "John" },
            meta: { nested: { deep: true } },
          })
        );
      });

      it("should handle array values in context", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "Array context",
          context: {
            tags: ["tag1", "tag2"],
            ids: [1, 2, 3],
          },
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.info).toHaveBeenCalledWith(
          "Array context",
          expect.objectContaining({
            tags: ["tag1", "tag2"],
            ids: [1, 2, 3],
          })
        );
      });

      it("should handle special characters in message", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "Special chars: \n\t\"'<>&",
        };

        processLogMessage(payload, logger, ipcLogger);

        expect(logger.info).toHaveBeenCalledWith("Special chars: \n\t\"'<>&", expect.any(Object));
      });

      it("should handle empty message string", () => {
        const payload: LogMessagePayload = {
          level: "info",
          message: "",
        };

        const result = processLogMessage(payload, logger, ipcLogger);

        expect(result).toBe(true);
        expect(logger.info).toHaveBeenCalledWith("", expect.any(Object));
      });

      it("should handle very long messages", () => {
        const longMessage = "a".repeat(10000);
        const payload: LogMessagePayload = {
          level: "info",
          message: longMessage,
        };

        const result = processLogMessage(payload, logger, ipcLogger);

        expect(result).toBe(true);
        expect(logger.info).toHaveBeenCalledWith(longMessage, expect.any(Object));
      });
    });
  });
});
