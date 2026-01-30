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

/** Placeholder for redacted sensitive data */
const REDACTED_VALUE = "[REDACTED]";

/** Placeholder for redacted message content */
const CONTENT_REDACTED_VALUE = "[CONTENT_REDACTED]";

/**
 * Patterns for detecting sensitive data in object keys.
 * These keys will always have their values redacted.
 */
const SENSITIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /api[-_]?key/i,
  /password/i,
  /secret/i,
  /token/i,
  /auth/i,
  /credential/i,
  /bearer/i,
];

/**
 * Fields that represent user-generated content.
 * These are redacted when logMessageContent is false.
 */
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

// ============================================================================
// Sanitization Utilities
// ============================================================================

/**
 * Checks if a key matches any sensitive pattern.
 *
 * @param key - The key to check
 * @returns true if the key matches a sensitive pattern
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Checks if a key represents user content that should be redacted
 * when logMessageContent is disabled.
 *
 * @param key - The key to check
 * @returns true if the key represents user content
 */
function isContentKey(key: string): boolean {
  return CONTENT_FIELDS.has(key);
}

/**
 * Recursively sanitizes log data by redacting sensitive values.
 * Always redacts values for keys matching SENSITIVE_PATTERNS.
 *
 * @param data - The data to sanitize
 * @returns A new object with sensitive values redacted
 *
 * @example
 * ```typescript
 * sanitizeLogData({ apiKey: 'sk-1234', userId: 'usr_123' });
 * // Returns: { apiKey: '[REDACTED]', userId: 'usr_123' }
 * ```
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(data)) {
    const value = data[key];

    if (isSensitiveKey(key)) {
      // Always redact sensitive keys
      result[key] = REDACTED_VALUE;
    } else if (value === null || value === undefined) {
      // Preserve null/undefined
      result[key] = value;
    } else if (Array.isArray(value)) {
      // Recursively sanitize arrays
      result[key] = sanitizeArray(value);
    } else if (typeof value === "object") {
      // Recursively sanitize nested objects
      result[key] = sanitizeLogData(value as Record<string, unknown>);
    } else {
      // Preserve primitive values
      result[key] = value;
    }
  }

  return result;
}

/**
 * Recursively sanitizes an array, handling nested objects and arrays.
 *
 * @param arr - The array to sanitize
 * @returns A new array with sensitive values redacted
 */
function sanitizeArray(arr: unknown[]): unknown[] {
  return arr.map((item) => {
    if (item === null || item === undefined) {
      return item;
    } else if (Array.isArray(item)) {
      return sanitizeArray(item);
    } else if (typeof item === "object") {
      return sanitizeLogData(item as Record<string, unknown>);
    } else {
      return item;
    }
  });
}

/**
 * Applies content redaction to log data when logMessageContent is disabled.
 * Redacts values for keys in CONTENT_FIELDS.
 *
 * @param data - The data to process
 * @param logMessageContent - Whether message content should be logged
 * @returns A new object with content values redacted if logMessageContent is false
 *
 * @example
 * ```typescript
 * // With logMessageContent: false
 * applyContentRedaction({ content: 'Hello world', userId: 'usr_123' }, false);
 * // Returns: { content: '[CONTENT_REDACTED]', userId: 'usr_123' }
 * ```
 */
export function applyContentRedaction(
  data: Record<string, unknown>,
  logMessageContent: boolean
): Record<string, unknown> {
  if (logMessageContent) {
    // Content logging enabled, no redaction needed
    return data;
  }

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(data)) {
    const value = data[key];

    if (value === null || value === undefined) {
      // Preserve null/undefined (even for content fields)
      result[key] = value;
    } else if (isContentKey(key)) {
      // Redact content field
      result[key] = CONTENT_REDACTED_VALUE;
    } else if (Array.isArray(value)) {
      // Recursively process arrays
      result[key] = applyContentRedactionArray(value, logMessageContent);
    } else if (typeof value === "object") {
      // Recursively process nested objects
      result[key] = applyContentRedaction(value as Record<string, unknown>, logMessageContent);
    } else {
      // Preserve primitive values
      result[key] = value;
    }
  }

  return result;
}

/**
 * Applies content redaction to an array recursively.
 *
 * @param arr - The array to process
 * @param logMessageContent - Whether message content should be logged
 * @returns A new array with content values redacted if logMessageContent is false
 */
function applyContentRedactionArray(arr: unknown[], logMessageContent: boolean): unknown[] {
  return arr.map((item) => {
    if (item === null || item === undefined) {
      return item;
    } else if (Array.isArray(item)) {
      return applyContentRedactionArray(item, logMessageContent);
    } else if (typeof item === "object") {
      return applyContentRedaction(item as Record<string, unknown>, logMessageContent);
    } else {
      return item;
    }
  });
}

/**
 * Processes log context by applying both sensitive data sanitization
 * and content redaction based on configuration.
 *
 * @param context - The log context to process
 * @param logMessageContent - Whether message content should be logged
 * @returns Processed context with appropriate redactions applied
 */
function processLogContext(context: LogContext, logMessageContent: boolean): LogContext {
  // First apply sensitive data sanitization (always)
  const sanitized = sanitizeLogData(context);
  // Then apply content redaction based on config
  return applyContentRedaction(sanitized, logMessageContent);
}

// ============================================================================
// Logger Wrapper
// ============================================================================

/**
 * Wraps a pino logger instance to match the Logger interface.
 * Handles the difference between pino's API and our Logger interface.
 * Applies privacy sanitization to all log context.
 */
class LoggerWrapper implements Logger {
  constructor(
    private readonly pinoLogger: PinoLogger,
    private readonly logMessageContent: boolean = false
  ) {}

  error(message: string, context?: LogContext): void {
    if (context) {
      const processed = processLogContext(context, this.logMessageContent);
      this.pinoLogger.error(processed, message);
    } else {
      this.pinoLogger.error(message);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (context) {
      const processed = processLogContext(context, this.logMessageContent);
      this.pinoLogger.warn(processed, message);
    } else {
      this.pinoLogger.warn(message);
    }
  }

  info(message: string, context?: LogContext): void {
    if (context) {
      const processed = processLogContext(context, this.logMessageContent);
      this.pinoLogger.info(processed, message);
    } else {
      this.pinoLogger.info(message);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (context) {
      const processed = processLogContext(context, this.logMessageContent);
      this.pinoLogger.debug(processed, message);
    } else {
      this.pinoLogger.debug(message);
    }
  }

  trace(message: string, context?: LogContext): void {
    if (context) {
      const processed = processLogContext(context, this.logMessageContent);
      this.pinoLogger.trace(processed, message);
    } else {
      this.pinoLogger.trace(message);
    }
  }

  child(bindings: Record<string, unknown>): Logger {
    // Child loggers inherit the logMessageContent setting
    return new LoggerWrapper(this.pinoLogger.child(bindings), this.logMessageContent);
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

  const { level, logMessageContent, logDirectory, prettyPrint = false } = config;

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

  loggerInstance = new LoggerWrapper(pinoLogger, logMessageContent);
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
  const { level, logMessageContent, prettyPrint = false } = config;

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

  return new LoggerWrapper(pinoLogger, logMessageContent);
}
