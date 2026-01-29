/**
 * Core utility types and branded type patterns for the SmartHole application.
 * These types provide type-safe foundations for IDs, timestamps, and common patterns.
 */

// ============================================================================
// Result Type - For operations that can fail
// ============================================================================

/**
 * A discriminated union representing the result of an operation that can fail.
 * Use this instead of throwing exceptions for expected failure cases.
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return { success: false, error: "Division by zero" };
 *   return { success: true, value: a / b };
 * }
 * ```
 */
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };

/**
 * Helper to create a success result
 */
export function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Helper to create an error result
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================================================
// Brand Type Utility - For nominal/tagged typing
// ============================================================================

/**
 * Creates a branded type for nominal typing in TypeScript.
 * This allows us to distinguish between structurally identical types
 * (e.g., MessageId vs ClientId, both strings).
 *
 * The __brand property exists only at the type level and has no runtime cost.
 *
 * @example
 * ```ts
 * type UserId = Brand<string, "UserId">;
 * type OrderId = Brand<string, "OrderId">;
 * // UserId and OrderId are not assignable to each other
 * ```
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

// ============================================================================
// Branded ID Types
// ============================================================================

/**
 * Unique identifier for messages in the system.
 * Used for tracking individual messages through processing pipelines.
 */
export type MessageId = Brand<string, "MessageId">;

/**
 * Unique identifier for connected clients.
 * Used for managing WebSocket connections and client state.
 */
export type ClientId = Brand<string, "ClientId">;

// ============================================================================
// ID Factory Functions
// ============================================================================

/**
 * Creates a MessageId from a string value.
 * The string should be a valid identifier (typically UUID format).
 *
 * @param id - The string value to brand as a MessageId
 * @returns A branded MessageId
 */
export function createMessageId(id: string): MessageId {
  return id as MessageId;
}

/**
 * Creates a ClientId from a string value.
 * The string should be a valid identifier (typically UUID format).
 *
 * @param id - The string value to brand as a ClientId
 * @returns A branded ClientId
 */
export function createClientId(id: string): ClientId {
  return id as ClientId;
}

// ============================================================================
// Type Guards for Branded IDs
// ============================================================================

/**
 * Checks if a value is a valid MessageId.
 * At runtime, this checks that the value is a non-empty string.
 * The type guard narrows the type to MessageId for TypeScript.
 *
 * @param value - The value to check
 * @returns true if the value is a valid MessageId
 */
export function isMessageId(value: unknown): value is MessageId {
  return typeof value === "string" && value.length > 0;
}

/**
 * Checks if a value is a valid ClientId.
 * At runtime, this checks that the value is a non-empty string.
 * The type guard narrows the type to ClientId for TypeScript.
 *
 * @param value - The value to check
 * @returns true if the value is a valid ClientId
 */
export function isClientId(value: unknown): value is ClientId {
  return typeof value === "string" && value.length > 0;
}

// ============================================================================
// Timestamp Type
// ============================================================================

/**
 * ISO 8601 formatted timestamp string.
 * This branded type ensures timestamps are always in a consistent format.
 *
 * @example "2024-01-15T10:30:00.000Z"
 */
export type ISOTimestamp = Brand<string, "ISOTimestamp">;

/**
 * Regular expression to validate ISO 8601 timestamp format.
 * Matches: YYYY-MM-DDTHH:mm:ss.sssZ
 */
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/**
 * Creates an ISOTimestamp from the current time or a provided Date.
 *
 * @param date - Optional Date object to convert. Defaults to current time.
 * @returns A branded ISOTimestamp string
 */
export function createTimestamp(date?: Date): ISOTimestamp {
  const d = date ?? new Date();
  return d.toISOString() as ISOTimestamp;
}

/**
 * Checks if a value is a valid ISOTimestamp.
 * Validates both that it's a string and matches ISO 8601 format.
 *
 * @param value - The value to check
 * @returns true if the value is a valid ISOTimestamp
 */
export function isISOTimestamp(value: unknown): value is ISOTimestamp {
  return typeof value === "string" && ISO_TIMESTAMP_REGEX.test(value);
}

/**
 * Parses an ISOTimestamp string into a Date object.
 *
 * @param timestamp - The ISOTimestamp to parse
 * @returns A Date object representing the timestamp
 */
export function parseTimestamp(timestamp: ISOTimestamp): Date {
  return new Date(timestamp);
}

// ============================================================================
// NonEmptyString Type
// ============================================================================

/**
 * A string that is guaranteed to be non-empty (has at least one character).
 * Useful for required string fields that must have content.
 */
export type NonEmptyString = Brand<string, "NonEmptyString">;

/**
 * Attempts to create a NonEmptyString from a string value.
 * Returns null if the string is empty or only contains whitespace.
 *
 * @param value - The string to validate and brand
 * @returns A NonEmptyString if valid, null otherwise
 */
export function createNonEmptyString(value: string): NonEmptyString | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed as NonEmptyString;
}

/**
 * Checks if a value is a NonEmptyString.
 * At runtime, verifies the value is a non-empty, non-whitespace string.
 *
 * @param value - The value to check
 * @returns true if the value is a valid NonEmptyString
 */
export function isNonEmptyString(value: unknown): value is NonEmptyString {
  return typeof value === "string" && value.trim().length > 0;
}

// ============================================================================
// Additional Utility Types
// ============================================================================

/**
 * Makes all properties of T optional recursively.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Makes all properties of T readonly recursively.
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Extracts the value type from a Result.
 */
export type ResultValue<R> = R extends Result<infer T, unknown> ? T : never;

/**
 * Extracts the error type from a Result.
 */
export type ResultError<R> = R extends Result<unknown, infer E> ? E : never;
