---
id: T-create-user-facing-error
title: Create User-Facing Error Message Mapping
status: open
priority: high
parent: F-error-handling-framework
prerequisites:
  - T-create-error-types-and-error
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T04:30:59.417Z
updated: 2026-01-29T04:30:59.417Z
---

# Create User-Facing Error Message Mapping

## Context

This task is part of the **F-error-handling-framework** feature. It creates the mapping from error codes to user-friendly, actionable messages.

Reference: [F-error-handling-framework](trellis://F-error-handling-framework)  
Prerequisite: [T-create-error-types-and-error](trellis://T-create-error-types-and-error)

## Overview

Create a mapping system that converts technical error codes into clear, actionable messages for end users. Messages should tell users what happened and what they can do about it.

## Files to Create/Modify

- `src/utils/error-messages.ts` - Error code to message mapping
- Update `src/utils/index.ts` - Add export

## Implementation Requirements

### Error Message Mapping

```typescript
import { ErrorCode } from "../types/errors";

/**
 * User-facing error messages keyed by ErrorCode.
 * Messages should be:
 * - Clear and non-technical
 * - Actionable (tell user what to do)
 * - Never expose sensitive information
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNKNOWN]: "An unexpected error occurred. Please try again.",
  [ErrorCode.INTERNAL]: "Something went wrong. Please restart the application.",

  [ErrorCode.CONFIG_INVALID]:
    "Your settings appear to be corrupted. Default settings will be restored.",
  [ErrorCode.CONFIG_LOAD_FAILED]: "Could not load your settings. Using default settings.",
  [ErrorCode.CONFIG_SAVE_FAILED]:
    "Could not save your settings. Please check if you have write permissions.",

  [ErrorCode.NETWORK_UNAVAILABLE]:
    "No internet connection. Please check your network and try again.",
  [ErrorCode.NETWORK_TIMEOUT]:
    "The connection timed out. Please check your internet and try again.",
  [ErrorCode.NETWORK_REQUEST_FAILED]: "Could not connect to the server. Please try again later.",

  [ErrorCode.IPC_CHANNEL_INVALID]:
    "An internal communication error occurred. Please restart the application.",
  [ErrorCode.IPC_PAYLOAD_INVALID]:
    "An internal communication error occurred. Please restart the application.",
  [ErrorCode.IPC_HANDLER_FAILED]: "An operation failed. Please try again.",

  [ErrorCode.SERVICE_UNAVAILABLE]:
    "A required service is not available. Please restart the application.",
  [ErrorCode.SERVICE_INITIALIZATION_FAILED]:
    "Could not start a required service. Please restart the application.",

  [ErrorCode.STT_INITIALIZATION_FAILED]:
    "Could not start speech recognition. Please check your microphone settings.",
  [ErrorCode.STT_TRANSCRIPTION_FAILED]: "Could not transcribe audio. Please try again.",
  [ErrorCode.LLM_REQUEST_FAILED]:
    "Could not process your request. Please check your API key and try again.",
  [ErrorCode.LLM_RESPONSE_INVALID]: "Received an invalid response. Please try again.",
};

/**
 * Gets the user-facing message for an error code.
 * Falls back to UNKNOWN message if code not found.
 */
export function getUserMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES[ErrorCode.UNKNOWN];
}

/**
 * Type guard to check if a string is a valid ErrorCode.
 */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ErrorCode;
}
```

## Message Guidelines

Messages must:

1. **Be actionable** - Tell users what to do ("Please check...", "Please try again")
2. **Avoid jargon** - No technical terms (IPC, API, etc.) in user messages
3. **Be concise** - One or two sentences maximum
4. **Never expose** - No file paths, no stack traces, no API keys

## Acceptance Criteria

1. [ ] `ERROR_MESSAGES` record maps all `ErrorCode` values to user messages
2. [ ] `getUserMessage()` function returns appropriate message for code
3. [ ] `getUserMessage()` falls back to UNKNOWN for undefined codes
4. [ ] `isErrorCode()` type guard validates error codes
5. [ ] All messages are actionable (include guidance for user)
6. [ ] No technical jargon in messages
7. [ ] Export added to `src/utils/index.ts`
8. [ ] Unit tests verify all codes have messages

## Testing Requirements

Create `src/utils/error-messages.test.ts` with tests for:

- Every ErrorCode has a corresponding message
- `getUserMessage()` returns correct messages
- `getUserMessage()` fallback behavior
- `isErrorCode()` type guard
- Messages don't contain technical terms (automated lint-style check)

## Security Considerations

- Messages must NEVER include:
  - File paths (especially with usernames)
  - API keys or tokens
  - Stack traces
  - Internal error details
- Review each message for information leakage
