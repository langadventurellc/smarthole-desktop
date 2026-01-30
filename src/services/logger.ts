/**
 * Centralized logging service using pino.
 * Provides structured logging with file transport and log rotation.
 *
 * @see F-logging-system feature specification
 */

import pino, { Logger as PinoLogger, DestinationStream } from "pino";
import { LogLevel } from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Context data for structured logging.
 * Allows attaching arbitrary metadata to log entries.
 */
export type LogContext = Record<string, unknown>;

/**
 * Logger interface matching the application's logging API.
 * All log methods accept an optional context object for structured logging.
 */
export interface Logger {
  /** Log an error-level message */
  error(message: string, context?: LogContext): void;
  /** Log a warn-level message */
  warn(message: string, context?: LogContext): void;
  /** Log an info-level message */
  info(message: string, context?: LogContext): void;
  /** Log a debug-level message */
  debug(message: string, context?: LogContext): void;
  /** Log a trace-level message */
  trace(message: string, context?: LogContext): void;
  /** Create a child logger with additional bindings */
  child(bindings: Record<string, unknown>): Logger;
}

/**
 * Configuration for logger initialization.
 */
export interface LoggerConfig {
  /** Minimum log level to record */
  level: LogLevel;
  /** Whether to log full message content (for privacy) */
  logMessageContent: boolean;
  /** Path to the log directory (defaults to process.cwd()/logs in non-Electron) */
  logDirectory?: string;
  /** Enable pretty printing for console output (development mode) */
  prettyPrint?: boolean;
}

/**
 * Options for creating a file transport.
 */
export interface FileTransportOptions {
  /** Directory where log files will be written */
  logDirectory: string;
  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxFileSize?: number;
  /** Log level for the file transport */
  level: LogLevel;
}

// ============================================================================
// Constants
// ============================================================================

/** Default maximum log file size: 10MB */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Log filename */
const LOG_FILENAME = "smarthole.log";

// ============================================================================
// Logger Wrapper
// ============================================================================

/**
 * Wraps a pino logger instance to match the Logger interface.
 * Handles the difference between pino's API and our Logger interface.
 */
class LoggerWrapper implements Logger {
  constructor(private readonly pinoLogger: PinoLogger) {}

  error(message: string, context?: LogContext): void {
    if (context) {
      this.pinoLogger.error(context, message);
    } else {
      this.pinoLogger.error(message);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (context) {
      this.pinoLogger.warn(context, message);
    } else {
      this.pinoLogger.warn(message);
    }
  }

  info(message: string, context?: LogContext): void {
    if (context) {
      this.pinoLogger.info(context, message);
    } else {
      this.pinoLogger.info(message);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (context) {
      this.pinoLogger.debug(context, message);
    } else {
      this.pinoLogger.debug(message);
    }
  }

  trace(message: string, context?: LogContext): void {
    if (context) {
      this.pinoLogger.trace(context, message);
    } else {
      this.pinoLogger.trace(message);
    }
  }

  child(bindings: Record<string, unknown>): Logger {
    return new LoggerWrapper(this.pinoLogger.child(bindings));
  }
}

// ============================================================================
// File Transport with Rotation
// ============================================================================

/**
 * Creates a file destination with size-based log rotation.
 * Uses pino.destination() for async non-blocking writes.
 *
 * Note: This is a simplified rotation implementation. For production use,
 * consider using pino.transport() with a dedicated worker or rotating-file-stream.
 *
 * @param options - File transport configuration options
 * @returns A pino destination stream for file logging
 */
export function createFileDestination(options: FileTransportOptions): DestinationStream {
  const { logDirectory, maxFileSize = DEFAULT_MAX_FILE_SIZE, level } = options;

  // Import fs and path modules (we're in Node/Electron main process)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");

  // Ensure log directory exists
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  const logFilePath = path.join(logDirectory, LOG_FILENAME);

  // Check if rotation is needed on startup
  rotateLogIfNeeded(logFilePath, maxFileSize);

  // Create async destination for non-blocking writes
  const destination = pino.destination({
    dest: logFilePath,
    sync: false, // Async writes
    minLength: 4096, // Buffer 4KB before flushing for performance
  });

  // Set up periodic rotation check (every minute)
  const rotationInterval = setInterval(() => {
    rotateLogIfNeeded(logFilePath, maxFileSize);
  }, 60000);

  // Clean up interval when destination closes
  const originalEnd = destination.end.bind(destination);
  destination.end = (...args: Parameters<typeof destination.end>) => {
    clearInterval(rotationInterval);
    return originalEnd(...args);
  };

  // Add level to destination for multi-stream support
  (destination as DestinationStream & { level?: string }).level = level;

  return destination;
}

/**
 * Rotates the log file if it exceeds the maximum size.
 * Renames current log to include timestamp and creates new log file.
 *
 * @param logFilePath - Path to the current log file
 * @param maxFileSize - Maximum file size in bytes
 */
function rotateLogIfNeeded(logFilePath: string, maxFileSize: number): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");

  try {
    if (!fs.existsSync(logFilePath)) {
      return;
    }

    const stats = fs.statSync(logFilePath);
    if (stats.size >= maxFileSize) {
      // Generate rotated filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dir = path.dirname(logFilePath);
      const ext = path.extname(logFilePath);
      const base = path.basename(logFilePath, ext);
      const rotatedPath = path.join(dir, `${base}-${timestamp}${ext}`);

      // Rename current log file
      fs.renameSync(logFilePath, rotatedPath);

      // Optionally: clean up old rotated files (keep last 5)
      cleanupOldLogs(dir, base, ext, 5);
    }
  } catch {
    // Silently ignore rotation errors to avoid crashing the application
    // The main log file will continue to grow if rotation fails
  }
}

/**
 * Cleans up old rotated log files, keeping only the most recent ones.
 *
 * @param logDirectory - Directory containing log files
 * @param baseName - Base name of log files (without extension)
 * @param extension - Log file extension
 * @param keepCount - Number of rotated files to keep
 */
function cleanupOldLogs(
  logDirectory: string,
  baseName: string,
  extension: string,
  keepCount: number
): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");

  try {
    const files = fs.readdirSync(logDirectory);
    const rotatedPattern = new RegExp(`^${baseName}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}`);

    const rotatedFiles = files
      .filter((file: string) => rotatedPattern.test(file) && file.endsWith(extension))
      .map((file: string) => ({
        name: file,
        path: path.join(logDirectory, file),
        mtime: fs.statSync(path.join(logDirectory, file)).mtime.getTime(),
      }))
      .sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime);

    // Delete files beyond keepCount
    rotatedFiles.slice(keepCount).forEach((file: { path: string }) => {
      fs.unlinkSync(file.path);
    });
  } catch {
    // Silently ignore cleanup errors
  }
}

// ============================================================================
// Logger Factory
// ============================================================================

/**
 * Singleton logger instance.
 * Initialized lazily via initializeLogger().
 */
let loggerInstance: Logger | null = null;

/**
 * Stored configuration for reference.
 */
let loggerConfig: LoggerConfig | null = null;

/**
 * Initializes the global logger instance with the provided configuration.
 * This should be called early in the application lifecycle.
 *
 * In Electron, call this after app.whenReady() to ensure app.getPath('logs') is available.
 *
 * @param config - Logger configuration options
 * @returns The initialized Logger instance
 *
 * @example
 * ```typescript
 * import { initializeLogger } from './services/logger';
 * import { LogLevel } from './types';
 *
 * const logger = initializeLogger({
 *   level: LogLevel.INFO,
 *   logMessageContent: false,
 *   logDirectory: app.getPath('logs'),
 *   prettyPrint: !app.isPackaged,
 * });
 *
 * logger.info('Application starting', { version: app.getVersion() });
 * ```
 */
export function initializeLogger(config: LoggerConfig): Logger {
  if (loggerInstance) {
    // Already initialized, return existing instance
    // Log a warning if config differs (but don't throw)
    return loggerInstance;
  }

  loggerConfig = config;

  const { level, logDirectory, prettyPrint = false } = config;

  // Determine if we're running in Electron main process
  const isElectron =
    typeof process !== "undefined" && process.versions && process.versions.electron;

  // Default log directory
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  const effectiveLogDirectory = logDirectory || path.join(process.cwd(), "logs");

  // Build pino options
  const pinoOptions: pino.LoggerOptions = {
    level,
    // Base object included in every log entry
    base: {
      pid: process.pid,
      ...(isElectron && { electron: true }),
    },
    // Timestamp format
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  let pinoLogger: PinoLogger;

  if (prettyPrint) {
    // Development mode: use pino-pretty for console output with file transport
    // Using pino.transport() for pretty printing
    const transport = pino.transport({
      targets: [
        {
          target: "pino-pretty",
          level,
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
        {
          target: "pino/file",
          level,
          options: {
            destination: path.join(effectiveLogDirectory, LOG_FILENAME),
            mkdir: true,
          },
        },
      ],
    });

    pinoLogger = pino(pinoOptions, transport);
  } else {
    // Production mode: JSON output to file and stdout
    const streams: pino.StreamEntry[] = [
      // Console output (JSON)
      { level, stream: process.stdout },
      // File output with rotation
      {
        level,
        stream: createFileDestination({
          logDirectory: effectiveLogDirectory,
          level,
        }),
      },
    ];

    pinoLogger = pino(pinoOptions, pino.multistream(streams));
  }

  loggerInstance = new LoggerWrapper(pinoLogger);
  return loggerInstance;
}

/**
 * Gets the current logger instance.
 * Throws if initializeLogger() has not been called.
 *
 * @returns The Logger instance
 * @throws Error if logger has not been initialized
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    throw new Error("Logger not initialized. Call initializeLogger() before using getLogger().");
  }
  return loggerInstance;
}

/**
 * Gets the current logger configuration.
 * Returns null if logger has not been initialized.
 *
 * @returns The current LoggerConfig or null
 */
export function getLoggerConfig(): LoggerConfig | null {
  return loggerConfig;
}

/**
 * Resets the logger instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetLogger(): void {
  loggerInstance = null;
  loggerConfig = null;
}

/**
 * Creates a standalone logger without affecting the global instance.
 * Useful for testing or isolated logging scenarios.
 *
 * @param config - Logger configuration options
 * @returns A new Logger instance
 */
export function createLogger(config: LoggerConfig): Logger {
  const { level, prettyPrint = false } = config;

  const pinoOptions: pino.LoggerOptions = {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  let pinoLogger: PinoLogger;

  if (prettyPrint) {
    const transport = pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    });
    pinoLogger = pino(pinoOptions, transport);
  } else {
    pinoLogger = pino(pinoOptions);
  }

  return new LoggerWrapper(pinoLogger);
}
