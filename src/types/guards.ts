/**
 * Type guards and validation utilities for the SmartHole application.
 * These utilities provide runtime validation for data crossing process boundaries
 * (IPC, WebSocket) where compile-time types cannot guarantee safety.
 *
 * This module provides:
 * 1. Generic validation helpers (isObject, isOneOf, etc.) - building blocks for type guards
 * 2. Validation result types (ValidationError, ValidationResult) - for detailed error reporting
 * 3. Detailed validation functions (validateClientRegistration, etc.) - return specific errors
 *
 * Note: Basic type guards (isLogLevel, isIpcChannel, etc.) are defined in their respective
 * modules (config.ts, ipc.ts, messages.ts) and re-exported from index.ts.
 *
 * Design principles:
 * - Guards never throw - they return false for invalid data
 * - Guards check ALL fields, not just some
 * - Validation functions provide detailed error information
 * - All functions are pure (no side effects)
 */

import {
  type ClientRegistration,
  type RoutedMessage,
  type ClientResponse,
  type WebSocketMessage,
  type MessageMetadata,
} from "./messages";

// ============================================================================
// Generic Validation Helpers
// ============================================================================

/**
 * Check if value is a non-null object (not an array).
 * This is the foundational check used by all object type guards.
 * Checking for non-array is important to avoid prototype pollution.
 *
 * @param value - The value to check
 * @returns true if the value is a non-null, non-array object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check if value is one of the allowed values.
 * Type-safe helper for validating string literal unions.
 *
 * @param value - The value to check
 * @param allowed - Array of allowed string values
 * @returns true if the value is one of the allowed strings
 *
 * @example
 * ```ts
 * const validTypes = ["info", "warning", "error"] as const;
 * if (isOneOf(value, validTypes)) {
 *   // value is narrowed to "info" | "warning" | "error"
 * }
 * ```
 */
export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/**
 * Check if value is a string (possibly empty).
 *
 * @param value - The value to check
 * @returns true if the value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Check if value is a non-empty string.
 * Note: This is different from common.ts isNonEmptyString which also trims whitespace.
 * This version only checks for length > 0.
 *
 * @param value - The value to check
 * @returns true if the value is a string with length > 0
 */
export function isNonEmptyStringRaw(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Check if value is a number (excludes NaN).
 *
 * @param value - The value to check
 * @returns true if the value is a finite number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

/**
 * Check if value is a boolean.
 *
 * @param value - The value to check
 * @returns true if the value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Check if value is an array.
 *
 * @param value - The value to check
 * @returns true if the value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if value is an array where all elements pass the provided guard.
 *
 * @param value - The value to check
 * @param guard - Type guard function to apply to each element
 * @returns true if value is an array and all elements pass the guard
 *
 * @example
 * ```ts
 * if (isArrayOf(value, isString)) {
 *   // value is string[]
 * }
 * ```
 */
export function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

/**
 * Check if value is undefined or passes the provided guard.
 * Useful for validating optional fields.
 *
 * @param value - The value to check
 * @param guard - Type guard function to apply if value is not undefined
 * @returns true if value is undefined or passes the guard
 *
 * @example
 * ```ts
 * if (isOptional(value, isString)) {
 *   // value is string | undefined
 * }
 * ```
 */
export function isOptional<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T | undefined {
  return value === undefined || guard(value);
}

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Represents a single validation error with path and details.
 */
export interface ValidationError {
  /** Dot-notation path to the invalid field (e.g., "metadata.inputMethod") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** The actual value that was received */
  received: unknown;
}

/**
 * Result of a validation operation.
 * Either contains the validated data or an array of errors.
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean;
  /** The validated data (only present if success is true) */
  data?: T;
  /** Array of validation errors (only present if success is false) */
  errors?: ValidationError[];
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Creates a successful validation result.
 *
 * @param data - The validated data
 * @returns A successful ValidationResult
 */
export function validationOk<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}

/**
 * Creates a failed validation result.
 *
 * @param errors - Array of validation errors
 * @returns A failed ValidationResult
 */
export function validationErr<T>(errors: ValidationError[]): ValidationResult<T> {
  return { success: false, errors };
}

/**
 * Creates a validation error object.
 *
 * @param path - Dot-notation path to the invalid field
 * @param message - Human-readable error message
 * @param received - The actual value received
 * @returns A ValidationError object
 */
export function makeError(path: string, message: string, received: unknown): ValidationError {
  return { path, message, received };
}

// ============================================================================
// Internal Type Guard Helpers (for validation functions)
// ============================================================================

/**
 * Valid input methods for message metadata.
 */
const INPUT_METHODS = ["voice", "text"] as const;

/**
 * Valid client response types.
 */
const CLIENT_RESPONSE_TYPES = ["ack", "reject", "notification"] as const;

/**
 * Valid WebSocket message types.
 */
const WEBSOCKET_MESSAGE_TYPES = ["registration", "message", "response"] as const;

// ============================================================================
// Detailed Validation Functions
// ============================================================================

/**
 * Validate ClientRegistration with detailed error messages.
 * Unlike type guards, this function returns specific errors for each invalid field.
 *
 * @param value - The value to validate
 * @returns ValidationResult with either the valid data or detailed errors
 */
export function validateClientRegistration(value: unknown): ValidationResult<ClientRegistration> {
  const errors: ValidationError[] = [];

  if (!isObject(value)) {
    return validationErr([makeError("", "Expected an object", value)]);
  }

  // name: required non-empty string
  if (!isNonEmptyStringRaw(value.name)) {
    errors.push(makeError("name", "Expected a non-empty string", value.name));
  }

  // description: required string
  if (!isString(value.description)) {
    errors.push(makeError("description", "Expected a string", value.description));
  }

  // version: optional string
  if (value.version !== undefined && !isString(value.version)) {
    errors.push(makeError("version", "Expected a string or undefined", value.version));
  }

  // capabilities: optional string array
  if (value.capabilities !== undefined) {
    if (!isArray(value.capabilities)) {
      errors.push(makeError("capabilities", "Expected an array or undefined", value.capabilities));
    } else {
      value.capabilities.forEach((cap, index) => {
        if (!isString(cap)) {
          errors.push(makeError(`capabilities[${index}]`, "Expected a string", cap));
        }
      });
    }
  }

  if (errors.length > 0) {
    return validationErr(errors);
  }

  return validationOk(value as unknown as ClientRegistration);
}

/**
 * Validate MessageMetadata with detailed error messages.
 *
 * @param value - The value to validate
 * @param pathPrefix - Optional prefix for error paths (used for nested validation)
 * @returns ValidationResult with either the valid data or detailed errors
 */
export function validateMessageMetadata(
  value: unknown,
  pathPrefix = ""
): ValidationResult<MessageMetadata> {
  const errors: ValidationError[] = [];
  const prefix = pathPrefix ? `${pathPrefix}.` : "";

  if (!isObject(value)) {
    return validationErr([makeError(pathPrefix || "", "Expected an object", value)]);
  }

  // inputMethod: required
  if (!isOneOf(value.inputMethod, INPUT_METHODS)) {
    errors.push(
      makeError(
        `${prefix}inputMethod`,
        `Expected one of: ${INPUT_METHODS.join(", ")}`,
        value.inputMethod
      )
    );
  }

  // directRouted: required boolean
  if (!isBoolean(value.directRouted)) {
    errors.push(makeError(`${prefix}directRouted`, "Expected a boolean", value.directRouted));
  }

  // confidence: optional number
  if (value.confidence !== undefined && !isNumber(value.confidence)) {
    errors.push(
      makeError(`${prefix}confidence`, "Expected a number or undefined", value.confidence)
    );
  }

  // routingReason: optional string
  if (value.routingReason !== undefined && !isString(value.routingReason)) {
    errors.push(
      makeError(`${prefix}routingReason`, "Expected a string or undefined", value.routingReason)
    );
  }

  if (errors.length > 0) {
    return validationErr(errors);
  }

  return validationOk(value as unknown as MessageMetadata);
}

/**
 * Validate RoutedMessage with detailed error messages.
 * Unlike type guards, this function returns specific errors for each invalid field.
 *
 * @param value - The value to validate
 * @returns ValidationResult with either the valid data or detailed errors
 */
export function validateRoutedMessage(value: unknown): ValidationResult<RoutedMessage> {
  const errors: ValidationError[] = [];

  if (!isObject(value)) {
    return validationErr([makeError("", "Expected an object", value)]);
  }

  // id: required string
  if (!isString(value.id)) {
    errors.push(makeError("id", "Expected a string", value.id));
  }

  // text: required string
  if (!isString(value.text)) {
    errors.push(makeError("text", "Expected a string", value.text));
  }

  // timestamp: required string
  if (!isString(value.timestamp)) {
    errors.push(makeError("timestamp", "Expected a string", value.timestamp));
  }

  // metadata: required object with specific structure
  if (!isObject(value.metadata)) {
    errors.push(makeError("metadata", "Expected an object", value.metadata));
  } else {
    const metadataResult = validateMessageMetadata(value.metadata, "metadata");
    if (!metadataResult.success && metadataResult.errors) {
      errors.push(...metadataResult.errors);
    }
  }

  if (errors.length > 0) {
    return validationErr(errors);
  }

  return validationOk(value as unknown as RoutedMessage);
}

/**
 * Validate ClientResponse with detailed error messages.
 * Unlike type guards, this function returns specific errors for each invalid field.
 *
 * @param value - The value to validate
 * @returns ValidationResult with either the valid data or detailed errors
 */
export function validateClientResponse(value: unknown): ValidationResult<ClientResponse> {
  const errors: ValidationError[] = [];

  if (!isObject(value)) {
    return validationErr([makeError("", "Expected an object", value)]);
  }

  // messageId: required string
  if (!isString(value.messageId)) {
    errors.push(makeError("messageId", "Expected a string", value.messageId));
  }

  // type: required, one of "ack" | "reject" | "notification"
  if (!isOneOf(value.type, CLIENT_RESPONSE_TYPES)) {
    errors.push(
      makeError("type", `Expected one of: ${CLIENT_RESPONSE_TYPES.join(", ")}`, value.type)
    );
  }

  // payload: required object
  if (!isObject(value.payload)) {
    errors.push(makeError("payload", "Expected an object", value.payload));
  }

  if (errors.length > 0) {
    return validationErr(errors);
  }

  return validationOk(value as unknown as ClientResponse);
}

/**
 * Validate WebSocketMessage with detailed error messages.
 * Validates the discriminated union structure and delegates to specific validators.
 *
 * @param value - The value to validate
 * @returns ValidationResult with either the valid data or detailed errors
 */
export function validateWebSocketMessage(value: unknown): ValidationResult<WebSocketMessage> {
  const errors: ValidationError[] = [];

  if (!isObject(value)) {
    return validationErr([makeError("", "Expected an object", value)]);
  }

  // type: required, one of the valid message types
  if (!isOneOf(value.type, WEBSOCKET_MESSAGE_TYPES)) {
    errors.push(
      makeError("type", `Expected one of: ${WEBSOCKET_MESSAGE_TYPES.join(", ")}`, value.type)
    );
    return validationErr(errors);
  }

  // payload: required, structure depends on type
  if (value.payload === undefined) {
    errors.push(makeError("payload", "Expected a payload object", value.payload));
    return validationErr(errors);
  }

  // Validate payload based on type
  switch (value.type) {
    case "registration": {
      const result = validateClientRegistration(value.payload);
      if (!result.success && result.errors) {
        // Prefix all errors with "payload."
        errors.push(
          ...result.errors.map((e) => ({
            ...e,
            path: e.path ? `payload.${e.path}` : "payload",
          }))
        );
      }
      break;
    }
    case "message": {
      const result = validateRoutedMessage(value.payload);
      if (!result.success && result.errors) {
        errors.push(
          ...result.errors.map((e) => ({
            ...e,
            path: e.path ? `payload.${e.path}` : "payload",
          }))
        );
      }
      break;
    }
    case "response": {
      const result = validateClientResponse(value.payload);
      if (!result.success && result.errors) {
        errors.push(
          ...result.errors.map((e) => ({
            ...e,
            path: e.path ? `payload.${e.path}` : "payload",
          }))
        );
      }
      break;
    }
  }

  if (errors.length > 0) {
    return validationErr(errors);
  }

  return validationOk(value as unknown as WebSocketMessage);
}
