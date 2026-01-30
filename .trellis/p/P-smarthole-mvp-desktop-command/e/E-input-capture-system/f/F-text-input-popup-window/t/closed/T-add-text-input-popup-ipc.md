---
id: T-add-text-input-popup-ipc
title: Add text input popup IPC channels and types
status: done
priority: high
parent: F-text-input-popup-window
prerequisites: []
affectedFiles:
  src/types/ipc.ts: Added 5 text input popup IPC channels, TextInputSubmitPayload
    and TextInputOpenPayload interfaces, updated IpcPayloadMap with new channel
    mappings, added isTextInputSubmitPayload type guard
  src/types/ipc.test.ts: Added tests for new text input popup channels,
    TextInputSubmitPayload type guard tests, TextInputOpenPayload interface
    tests, updated channel count test from 21 to 26, updated naming convention
    regex to allow camelCase domains
log:
  - Added text input popup IPC channels and types to enable communication
    between the main process and the popup renderer. Implemented 5 new IPC
    channels (TEXT_INPUT_OPEN, TEXT_INPUT_CLOSE, TEXT_INPUT_SUBMIT,
    TEXT_INPUT_FOCUSED, TEXT_INPUT_DISMISSED), two payload types
    (TextInputSubmitPayload, TextInputOpenPayload), updated IpcPayloadMap with
    the new channels, and added a type guard for TextInputSubmitPayload. Also
    updated tests to verify the new channels exist, test the type guard
    functionality, and updated the channel count from 21 to 26.
schema: v1.0
childrenIds: []
created: 2026-01-30T23:41:34.684Z
updated: 2026-01-30T23:41:34.684Z
---

# Add Text Input Popup IPC Channels and Types

## Goal

Define IPC channels and types for text input popup communication. This is the foundation that other tasks depend on.

## Key File to Modify

`/Users/zach/code/smarthole-desktop/src/types/ipc.ts`

## Pattern to Follow

Follow the existing IPC channel pattern in the file:

- Channel naming: `textInput:{action}` (matching `input:stateChanged`, `hotkey:activated`)
- Payload interfaces with JSDoc documentation
- Type maps for type-safe handlers

## Implementation Details

### 1. Add IPC Channels (around line 67, after INPUT_GET_STATE)

```typescript
// Text input popup channels
TEXT_INPUT_OPEN: "textInput:open",           // Request to open popup
TEXT_INPUT_CLOSE: "textInput:close",         // Request to close popup
TEXT_INPUT_SUBMIT: "textInput:submit",       // Popup -> main with text
TEXT_INPUT_FOCUSED: "textInput:focused",     // Popup gained focus
TEXT_INPUT_DISMISSED: "textInput:dismissed", // Popup closed without submit
```

### 2. Add Payload Types (new section after Input State IPC Types)

```typescript
// ============================================================================
// Text Input Popup IPC Types
// ============================================================================

/**
 * Payload for textInput:open channel.
 * Used when requesting the text input popup to open.
 */
export interface TextInputOpenPayload {
  /** Optional custom placeholder text for the input field */
  placeholder?: string;
}

/**
 * Payload for textInput:submit channel.
 * Sent from popup to main when user submits text.
 */
export interface TextInputSubmitPayload {
  /** The submitted text from the input field */
  text: string;
  /** ISO 8601 timestamp when the text was submitted */
  submittedAt: string;
}
```

### 3. Update IpcPayloadMap (around line 400)

Add these entries to the `IpcPayloadMap` interface:

```typescript
[IPC_CHANNELS.TEXT_INPUT_OPEN]: TextInputOpenPayload | void;
[IPC_CHANNELS.TEXT_INPUT_CLOSE]: void;
[IPC_CHANNELS.TEXT_INPUT_SUBMIT]: TextInputSubmitPayload;
[IPC_CHANNELS.TEXT_INPUT_FOCUSED]: void;
[IPC_CHANNELS.TEXT_INPUT_DISMISSED]: void;
```

### 4. Add Type Guard (after existing type guards)

```typescript
/**
 * Checks if a value is a valid TextInputSubmitPayload.
 *
 * @param value - The value to check
 * @returns true if the value is a valid text input submit payload
 */
export function isTextInputSubmitPayload(value: unknown): value is TextInputSubmitPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return typeof obj.text === "string" && typeof obj.submittedAt === "string";
}

/**
 * Checks if a value is a valid TextInputOpenPayload.
 *
 * @param value - The value to check
 * @returns true if the value is a valid text input open payload
 */
export function isTextInputOpenPayload(value: unknown): value is TextInputOpenPayload {
  if (typeof value !== "object" || value === null) {
    return true; // Empty object is valid (all fields optional)
  }

  const obj = value as Record<string, unknown>;

  // Optional placeholder must be a string if present
  if (obj.placeholder !== undefined && typeof obj.placeholder !== "string") {
    return false;
  }

  return true;
}
```

### 5. Update src/types/ipc.test.ts

Add tests for the new type guards:

```typescript
describe("isTextInputSubmitPayload", () => {
  it("returns true for valid payload", () => {
    expect(isTextInputSubmitPayload({ text: "hello", submittedAt: "2024-01-01T00:00:00Z" })).toBe(
      true
    );
  });

  it("returns false for missing text", () => {
    expect(isTextInputSubmitPayload({ submittedAt: "2024-01-01T00:00:00Z" })).toBe(false);
  });

  it("returns false for missing submittedAt", () => {
    expect(isTextInputSubmitPayload({ text: "hello" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTextInputSubmitPayload(null)).toBe(false);
  });
});
```

## Acceptance Criteria

- [ ] 5 IPC channels defined in `IPC_CHANNELS` constant
- [ ] `TextInputOpenPayload` interface with optional `placeholder` field
- [ ] `TextInputSubmitPayload` interface with `text` and `submittedAt` fields
- [ ] `IpcPayloadMap` updated with all 5 new channels
- [ ] `isTextInputSubmitPayload` type guard implemented
- [ ] `isTextInputOpenPayload` type guard implemented
- [ ] All types have JSDoc documentation
- [ ] Tests pass: `mise run test`
- [ ] Quality checks pass: `mise run quality`

## Dependencies

None - this is the first task.

## Estimated Complexity

Low - straightforward type definitions following existing patterns.
