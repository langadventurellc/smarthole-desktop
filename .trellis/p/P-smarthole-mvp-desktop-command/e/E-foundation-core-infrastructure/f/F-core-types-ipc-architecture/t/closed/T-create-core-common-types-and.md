---
id: T-create-core-common-types-and
title: Create core common types and utilities
status: done
priority: high
parent: F-core-types-ipc-architecture
prerequisites: []
affectedFiles:
  src/types/common.ts: Created core utility types including Result<T,E>,
    Brand<T,B>, MessageId, ClientId, ISOTimestamp, NonEmptyString with factory
    functions (createMessageId, createClientId, createTimestamp,
    createNonEmptyString), type guards (isMessageId, isClientId, isISOTimestamp,
    isNonEmptyString), and helpers (ok, err, parseTimestamp)
  src/types/index.ts: Created barrel export file re-exporting all types from common.ts
  src/types/common.test.ts: Created comprehensive unit tests for all types and
    functions (37 tests) including type-level constraint verification
log:
  - Research complete. Verified project structure, TypeScript config (strict
    mode enabled), test setup (Vitest with globals). Starting implementation of
    src/types/common.ts and src/types/index.ts.
  - Implementation complete. Created src/types/common.ts with all required types
    (Result, Brand, MessageId, ClientId, ISOTimestamp, NonEmptyString) and
    factory functions. Created src/types/index.ts barrel export. All 38 tests
    pass. Quality checks pass (lint, format, type-check).
  - Created the core common types and utilities foundation for the SmartHole
    application. Implemented Result type with ok/err helpers for type-safe error
    handling, Brand utility type for nominal typing, branded ID types
    (MessageId, ClientId) with factory functions and type guards, ISOTimestamp
    for validated timestamp strings, and NonEmptyString for validated non-empty
    strings. All types use strict TypeScript with no `any` types. Includes
    comprehensive unit tests (37 tests) covering factory functions, type guards,
    and type-level constraints using @ts-expect-error comments.
schema: v1.0
childrenIds: []
created: 2026-01-29T02:34:56.515Z
updated: 2026-01-29T02:34:56.515Z
---

# Create Core Common Types and Utilities

## Context

This is the first task in the F-core-types-ipc-architecture feature. It establishes the foundational utility types and patterns that all other types will build upon.

**Parent Feature**: F-core-types-ipc-architecture
**Related Requirements**: [smarthole-mvp.md](/docs/requirements/smarthole-mvp.md)

## Objective

Create the `src/types/` directory structure and implement common utility types including Result patterns, branded types for IDs, and other shared type utilities.

## Implementation Details

### Files to Create

1. `src/types/common.ts` - Core utility types
2. `src/types/index.ts` - Barrel export (initial, will be extended by other tasks)

### Types to Implement in `common.ts`

```typescript
// Result type for operations that can fail
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };

// Branded type utility for nominal typing
export type Brand<T, B> = T & { readonly __brand: B };

// Branded ID types (used for type-safe IDs)
export type MessageId = Brand<string, "MessageId">;
export type ClientId = Brand<string, "ClientId">;

// Factory functions for creating branded IDs
export function createMessageId(id: string): MessageId;
export function createClientId(id: string): ClientId;

// Type guard helpers
export function isMessageId(value: unknown): value is MessageId;
export function isClientId(value: unknown): value is ClientId;

// Timestamp type (ISO 8601 string)
export type ISOTimestamp = Brand<string, "ISOTimestamp">;
export function createTimestamp(date?: Date): ISOTimestamp;

// NonEmptyString for validated strings
export type NonEmptyString = Brand<string, "NonEmptyString">;
export function createNonEmptyString(value: string): NonEmptyString | null;
```

### Barrel Export (`index.ts`)

```typescript
export * from "./common";
// Other exports will be added by subsequent tasks
```

## Technical Approach

1. Create `src/types/` directory
2. Implement `common.ts` with all utility types
3. Use TypeScript's intersection types for branding pattern
4. Factory functions should validate input where appropriate (e.g., non-empty strings)
5. Create `index.ts` with re-exports
6. Ensure all types compile with strict TypeScript settings

## Acceptance Criteria

1. [ ] `src/types/` directory created
2. [ ] `Result<T, E>` type implemented with success/error discriminated union
3. [ ] `Brand<T, B>` utility type implemented for nominal typing
4. [ ] `MessageId` and `ClientId` branded types implemented
5. [ ] Factory functions for creating branded IDs implemented
6. [ ] Type guards for branded types implemented
7. [ ] `ISOTimestamp` branded type with factory function implemented
8. [ ] `NonEmptyString` branded type with validation implemented
9. [ ] Barrel export (`index.ts`) created and exports all types
10. [ ] No `any` types used
11. [ ] Types importable via `import { ... } from '../types'`

## Testing Requirements

Write unit tests in `src/types/common.test.ts`:

- Test factory functions create correct branded types
- Test type guards correctly identify branded types
- Test `createNonEmptyString` returns null for empty strings
- Test `createTimestamp` produces valid ISO 8601 strings
- Use `@ts-expect-error` comments to verify type-level constraints

## Security Considerations

- Branded IDs should use UUID format for unpredictability if generating new IDs
- Factory functions should validate input to prevent invalid data

## Dependencies

None - this is the first task in the feature
