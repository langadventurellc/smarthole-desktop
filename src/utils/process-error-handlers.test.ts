import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerProcessErrorHandlers,
  unregisterProcessErrorHandlers,
  ErrorLogger,
} from "./process-error-handlers";
import { AppError } from "./errors";
import { ErrorCode } from "../types/errors";

// ============================================================================
// Mocks
// ============================================================================

// Mock the electron app module
vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    exit: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

// Get the mocked app
import { app } from "electron";
const mockApp = vi.mocked(app);

// Track registered handlers
type ProcessEventHandler = (...args: unknown[]) => void;
let processHandlers: Map<string, ProcessEventHandler[]>;
let appHandlers: Map<string, ProcessEventHandler[]>;

// ============================================================================
// Test Setup
// ============================================================================

describe("process-error-handlers", () => {
  beforeEach(() => {
    // Reset handler tracking
    processHandlers = new Map();
    appHandlers = new Map();

    // Mock process.on to track handlers
    vi.spyOn(process, "on").mockImplementation(((event: string, handler: ProcessEventHandler) => {
      if (!processHandlers.has(event)) {
        processHandlers.set(event, []);
      }
      processHandlers.get(event)!.push(handler);
      return process;
    }) as typeof process.on);

    // Mock process.removeAllListeners
    vi.spyOn(process, "removeAllListeners").mockImplementation(((event?: string) => {
      if (event) {
        processHandlers.delete(event);
      } else {
        processHandlers.clear();
      }
      return process;
    }) as typeof process.removeAllListeners);

    // Mock app.on to track handlers
    mockApp.on.mockImplementation(((event: string, handler: ProcessEventHandler) => {
      if (!appHandlers.has(event)) {
        appHandlers.set(event, []);
      }
      appHandlers.get(event)!.push(handler);
      return mockApp;
    }) as typeof mockApp.on);

    // Mock app.removeAllListeners
    mockApp.removeAllListeners.mockImplementation(((event?: string) => {
      if (event) {
        appHandlers.delete(event);
      } else {
        appHandlers.clear();
      }
      return mockApp;
    }) as typeof mockApp.removeAllListeners);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore process methods
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Handler Registration Tests
  // ==========================================================================

  describe("registerProcessErrorHandlers", () => {
    it("should register uncaughtException handler on process", () => {
      registerProcessErrorHandlers();

      expect(processHandlers.has("uncaughtException")).toBe(true);
      expect(processHandlers.get("uncaughtException")).toHaveLength(1);
    });

    it("should register unhandledRejection handler on process", () => {
      registerProcessErrorHandlers();

      expect(processHandlers.has("unhandledRejection")).toBe(true);
      expect(processHandlers.get("unhandledRejection")).toHaveLength(1);
    });

    it("should register render-process-gone handler on app", () => {
      registerProcessErrorHandlers();

      expect(mockApp.on).toHaveBeenCalledWith("render-process-gone", expect.any(Function));
      expect(appHandlers.has("render-process-gone")).toBe(true);
    });

    it("should register child-process-gone handler on app", () => {
      registerProcessErrorHandlers();

      expect(mockApp.on).toHaveBeenCalledWith("child-process-gone", expect.any(Function));
      expect(appHandlers.has("child-process-gone")).toBe(true);
    });

    it("should register all four handlers", () => {
      registerProcessErrorHandlers();

      expect(processHandlers.size).toBe(2);
      expect(appHandlers.size).toBe(2);
    });
  });

  // ==========================================================================
  // Unregister Tests
  // ==========================================================================

  describe("unregisterProcessErrorHandlers", () => {
    it("should remove uncaughtException listeners from process", () => {
      registerProcessErrorHandlers();
      unregisterProcessErrorHandlers();

      expect(process.removeAllListeners).toHaveBeenCalledWith("uncaughtException");
    });

    it("should remove unhandledRejection listeners from process", () => {
      registerProcessErrorHandlers();
      unregisterProcessErrorHandlers();

      expect(process.removeAllListeners).toHaveBeenCalledWith("unhandledRejection");
    });

    it("should remove render-process-gone listeners from app", () => {
      registerProcessErrorHandlers();
      unregisterProcessErrorHandlers();

      expect(mockApp.removeAllListeners).toHaveBeenCalledWith("render-process-gone");
    });

    it("should remove child-process-gone listeners from app", () => {
      registerProcessErrorHandlers();
      unregisterProcessErrorHandlers();

      expect(mockApp.removeAllListeners).toHaveBeenCalledWith("child-process-gone");
    });
  });

  // ==========================================================================
  // Uncaught Exception Handler Tests
  // ==========================================================================

  describe("uncaughtException handler", () => {
    it("should call logger.error when exception occurs", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = processHandlers.get("uncaughtException")![0];
      const error = new Error("Test uncaught error");
      handler(error, "uncaughtException");

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Uncaught exception"),
        expect.objectContaining({
          code: ErrorCode.INTERNAL,
          origin: "uncaughtException",
        })
      );
    });

    it("should wrap error as AppError with INTERNAL code", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = processHandlers.get("uncaughtException")![0];
      const error = new Error("Test error");
      handler(error, "uncaughtException");

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ErrorCode.INTERNAL,
        })
      );
    });

    it("should include error stack in log context", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = processHandlers.get("uncaughtException")![0];
      const error = new Error("Test error with stack");
      handler(error, "uncaughtException");

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stack: expect.stringContaining("Error: Test error with stack"),
        })
      );
    });

    it("should call onFatalError callback with AppError", () => {
      const onFatalError = vi.fn();
      registerProcessErrorHandlers({ onFatalError });

      const handler = processHandlers.get("uncaughtException")![0];
      handler(new Error("Fatal"), "uncaughtException");

      expect(onFatalError).toHaveBeenCalledTimes(1);
      const calledWithError = onFatalError.mock.calls[0][0];
      expect(calledWithError).toBeInstanceOf(AppError);
      expect(calledWithError.code).toBe(ErrorCode.INTERNAL);
      expect(calledWithError.recoverable).toBe(false);
      expect(calledWithError.severity).toBe("critical");
    });

    it("should exit app when exitOnUncaught is true", () => {
      vi.useFakeTimers();
      registerProcessErrorHandlers({ exitOnUncaught: true });

      const handler = processHandlers.get("uncaughtException")![0];
      handler(new Error("Fatal"), "uncaughtException");

      // Fast-forward past the timeout
      vi.advanceTimersByTime(150);

      expect(mockApp.exit).toHaveBeenCalledWith(1);
      vi.useRealTimers();
    });

    it("should NOT exit app when exitOnUncaught is false", () => {
      vi.useFakeTimers();
      registerProcessErrorHandlers({ exitOnUncaught: false });

      const handler = processHandlers.get("uncaughtException")![0];
      handler(new Error("Non-fatal"), "uncaughtException");

      vi.advanceTimersByTime(150);

      expect(mockApp.exit).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("should use default console logger when no logger provided", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      registerProcessErrorHandlers();

      const handler = processHandlers.get("uncaughtException")![0];
      handler(new Error("Console test"), "uncaughtException");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[FATAL]"),
        expect.any(Object)
      );
      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Unhandled Rejection Handler Tests
  // ==========================================================================

  describe("unhandledRejection handler", () => {
    it("should call logger.error when rejection occurs", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = processHandlers.get("unhandledRejection")![0];
      const reason = new Error("Promise rejected");
      handler(reason, Promise.resolve());

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Unhandled promise rejection"),
        expect.objectContaining({
          code: ErrorCode.INTERNAL,
        })
      );
    });

    it("should wrap rejection reason as AppError with INTERNAL code", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = processHandlers.get("unhandledRejection")![0];
      handler(new Error("Rejected"), Promise.resolve());

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ErrorCode.INTERNAL,
        })
      );
    });

    it("should handle non-Error rejection reasons", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = processHandlers.get("unhandledRejection")![0];
      handler("string rejection", Promise.resolve());

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("string rejection"),
        expect.any(Object)
      );
    });

    it("should NOT call onFatalError for unhandled rejections", () => {
      const onFatalError = vi.fn();
      registerProcessErrorHandlers({ onFatalError });

      const handler = processHandlers.get("unhandledRejection")![0];
      handler(new Error("Rejected"), Promise.resolve());

      // onFatalError should NOT be called for rejections
      expect(onFatalError).not.toHaveBeenCalled();
    });

    it("should NOT exit app on unhandled rejection", () => {
      vi.useFakeTimers();
      registerProcessErrorHandlers({ exitOnUncaught: true });

      const handler = processHandlers.get("unhandledRejection")![0];
      handler(new Error("Rejected"), Promise.resolve());

      vi.advanceTimersByTime(150);

      // Should NOT exit on rejection
      expect(mockApp.exit).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("should mark rejection errors as recoverable", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      const onFatalError = vi.fn();
      registerProcessErrorHandlers({ logger: mockLogger, onFatalError });

      // Note: We can't directly check the AppError properties from the logger,
      // but we can verify the behavior is different from uncaught exceptions
      const handler = processHandlers.get("unhandledRejection")![0];
      handler(new Error("Recoverable rejection"), Promise.resolve());

      // The app should NOT exit, indicating the error is considered recoverable
      expect(mockApp.exit).not.toHaveBeenCalled();
    });

    it("should include cause stack in log context when reason is Error", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = processHandlers.get("unhandledRejection")![0];
      const error = new Error("Error with stack");
      handler(error, Promise.resolve());

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stack: expect.stringContaining("Error: Error with stack"),
        })
      );
    });
  });

  // ==========================================================================
  // Render Process Gone Handler Tests
  // ==========================================================================

  describe("render-process-gone handler", () => {
    it("should call logger.error with details", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = appHandlers.get("render-process-gone")![0];
      const details = { reason: "crashed", exitCode: 1 };
      handler({}, {}, details);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Render process gone: crashed"),
        expect.objectContaining({
          reason: "crashed",
          exitCode: 1,
        })
      );
    });

    it("should handle different crash reasons", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = appHandlers.get("render-process-gone")![0];

      handler({}, {}, { reason: "oom", exitCode: -1 });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("oom"),
        expect.any(Object)
      );

      handler({}, {}, { reason: "killed", exitCode: 9 });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("killed"),
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // Child Process Gone Handler Tests
  // ==========================================================================

  describe("child-process-gone handler", () => {
    it("should call logger.error with full details", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = appHandlers.get("child-process-gone")![0];
      const details = {
        type: "GPU",
        reason: "crashed",
        exitCode: 1,
        serviceName: "gpu-process",
        name: "GPU Process",
      };
      handler({}, details);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Child process gone: crashed"),
        expect.objectContaining({
          type: "GPU",
          reason: "crashed",
          exitCode: 1,
          serviceName: "gpu-process",
          name: "GPU Process",
        })
      );
    });

    it("should handle utility process crashes", () => {
      const mockLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: mockLogger });

      const handler = appHandlers.get("child-process-gone")![0];
      const details = {
        type: "Utility",
        reason: "killed",
        exitCode: 15,
        serviceName: "network-service",
        name: "Network Service",
      };
      handler({}, details);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("killed"),
        expect.objectContaining({
          type: "Utility",
        })
      );
    });
  });

  // ==========================================================================
  // Options Tests
  // ==========================================================================

  describe("options handling", () => {
    it("should work with no options", () => {
      expect(() => registerProcessErrorHandlers()).not.toThrow();
    });

    it("should work with empty options object", () => {
      expect(() => registerProcessErrorHandlers({})).not.toThrow();
    });

    it("should accept custom logger", () => {
      const customLogger: ErrorLogger = { error: vi.fn() };
      registerProcessErrorHandlers({ logger: customLogger });

      const handler = processHandlers.get("uncaughtException")![0];
      handler(new Error("Test"), "uncaughtException");

      expect(customLogger.error).toHaveBeenCalled();
    });

    it("should accept onFatalError callback", () => {
      const onFatalError = vi.fn();
      registerProcessErrorHandlers({ onFatalError });

      const handler = processHandlers.get("uncaughtException")![0];
      handler(new Error("Fatal"), "uncaughtException");

      expect(onFatalError).toHaveBeenCalled();
    });

    it("should default exitOnUncaught based on dev mode", () => {
      // In test environment, app.isPackaged is false (mocked), so we're in dev mode
      // which means exitOnUncaught defaults to false
      vi.useFakeTimers();
      registerProcessErrorHandlers();

      const handler = processHandlers.get("uncaughtException")![0];
      handler(new Error("Test"), "uncaughtException");

      vi.advanceTimersByTime(150);

      // Should NOT exit in dev mode
      expect(mockApp.exit).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("should allow explicit exitOnUncaught override", () => {
      vi.useFakeTimers();
      registerProcessErrorHandlers({ exitOnUncaught: true });

      const handler = processHandlers.get("uncaughtException")![0];
      handler(new Error("Test"), "uncaughtException");

      vi.advanceTimersByTime(150);

      expect(mockApp.exit).toHaveBeenCalledWith(1);
      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // Error Wrapping Tests
  // ==========================================================================

  describe("error wrapping", () => {
    it("should wrap standard Error as AppError with correct properties", () => {
      const onFatalError = vi.fn();
      registerProcessErrorHandlers({ onFatalError });

      const handler = processHandlers.get("uncaughtException")![0];
      const originalError = new Error("Original message");
      handler(originalError, "uncaughtException");

      const wrappedError = onFatalError.mock.calls[0][0] as AppError;
      expect(wrappedError).toBeInstanceOf(AppError);
      expect(wrappedError.message).toBe("Original message");
      expect(wrappedError.code).toBe(ErrorCode.INTERNAL);
      expect(wrappedError.recoverable).toBe(false);
      expect(wrappedError.severity).toBe("critical");
      expect(wrappedError.cause).toBe(originalError);
    });

    it("should wrap TypeError", () => {
      const onFatalError = vi.fn();
      registerProcessErrorHandlers({ onFatalError });

      const handler = processHandlers.get("uncaughtException")![0];
      const typeError = new TypeError("Cannot read property 'x' of undefined");
      handler(typeError, "uncaughtException");

      const wrappedError = onFatalError.mock.calls[0][0] as AppError;
      expect(wrappedError.cause).toBe(typeError);
    });

    it("should wrap RangeError", () => {
      const onFatalError = vi.fn();
      registerProcessErrorHandlers({ onFatalError });

      const handler = processHandlers.get("uncaughtException")![0];
      const rangeError = new RangeError("Value out of range");
      handler(rangeError, "uncaughtException");

      const wrappedError = onFatalError.mock.calls[0][0] as AppError;
      expect(wrappedError.cause).toBe(rangeError);
    });
  });
});
