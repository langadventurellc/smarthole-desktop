/**
 * Unit tests for the IPC log message handler.
 * Tests payload validation, log level mapping, and context enrichment.
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { processLogMessage } from "./log-handler";
import { Logger } from "../services/logger";
import { LogMessagePayload } from "../types";

function createMockLogger(): Logger & {
  error: Mock;
  warn: Mock;
  info: Mock;
  debug: Mock;
  trace: Mock;
  child: Mock;
} {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
}

describe("processLogMessage", () => {
  let logger: ReturnType<typeof createMockLogger>;
  let ipcLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
    ipcLogger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should reject invalid payloads", () => {
    expect(processLogMessage(null, logger, ipcLogger)).toBe(false);
    expect(processLogMessage({ message: "Test" }, logger, ipcLogger)).toBe(false); // missing level
    expect(processLogMessage({ level: "info" }, logger, ipcLogger)).toBe(false); // missing message
    expect(processLogMessage({ level: "invalid", message: "Test" }, logger, ipcLogger)).toBe(false);

    expect(ipcLogger.warn).toHaveBeenCalled();
  });

  it("should forward logs to correct logger method based on level", () => {
    const levels = ["error", "warn", "info", "debug", "trace"] as const;

    for (const level of levels) {
      vi.clearAllMocks();
      processLogMessage({ level, message: `${level} message` }, logger, ipcLogger);
      expect(logger[level]).toHaveBeenCalledWith(`${level} message`, expect.any(Object));
    }
  });

  it("should enrich context with source and preserve original fields", () => {
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
});
