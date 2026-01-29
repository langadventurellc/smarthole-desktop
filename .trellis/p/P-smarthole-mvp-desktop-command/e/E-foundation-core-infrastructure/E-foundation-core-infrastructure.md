---
id: E-foundation-core-infrastructure
title: Foundation & Core Infrastructure
status: in-progress
priority: high
parent: P-smarthole-mvp-desktop-command
prerequisites: []
affectedFiles:
  src/types/common.ts: Created core utility types including Result<T,E>,
    Brand<T,B>, MessageId, ClientId, ISOTimestamp, NonEmptyString with factory
    functions (createMessageId, createClientId, createTimestamp,
    createNonEmptyString), type guards (isMessageId, isClientId, isISOTimestamp,
    isNonEmptyString), and helpers (ok, err, parseTimestamp)
  src/types/index.ts: Created barrel export file re-exporting all types from
    common.ts; Updated barrel export to include config types export; Updated
    barrel export to include messages module; Updated barrel export to include
    IPC types; Updated barrel export to include guards module; Added ElectronAPI
    type export from preload module
  src/types/common.test.ts: Created comprehensive unit tests for all types and
    functions (37 tests) including type-level constraint verification
  src/types/config.ts: Created configuration type definitions including LogLevel,
    VoiceInputMode, SttBackend, LlmProvider, SttConfig, LlmConfig, HotkeyConfig,
    AppConfig interfaces plus DEFAULT_CONFIG values and type guards
  src/types/config.test.ts: Created comprehensive unit tests for configuration
    types (44 tests) covering type guards, DEFAULT_CONFIG values, interface
    validation, and type-level constraints
  src/types/messages.ts: Created WebSocket message type definitions including
    ClientRegistration, RegisteredClient, MessageMetadata, RoutedMessage,
    ClientResponse types, response payload types (RejectPayload,
    NotificationPayload, AckPayload), WebSocketMessage discriminated union, and
    type guards for all message and response types
  src/types/messages.test.ts: Created comprehensive unit tests (61 tests) covering
    all interfaces, type guards, discriminated union behavior, and type-level
    constraints using @ts-expect-error
  src/types/ipc.ts: Created IPC channel definitions and types including
    IPC_CHANNELS constant, IpcChannel type, all payload interfaces
    (LogMessagePayload, NotifyShowPayload, etc.), type maps (IpcPayloadMap,
    IpcResponseMap), and comprehensive type guards
  src/types/ipc.test.ts: Created 86 unit tests covering IPC channel values, all
    type guards, interface structures, type maps, and type-level constraints
    using @ts-expect-error
  src/types/guards.ts: Created type guards and validation utilities module with
    generic helpers (isObject, isOneOf, isString, isNonEmptyStringRaw, isNumber,
    isBoolean, isArray, isArrayOf, isOptional), validation result types
    (ValidationError, ValidationResult), helper functions (validationOk,
    validationErr, makeError), and detailed validation functions
    (validateClientRegistration, validateMessageMetadata, validateRoutedMessage,
    validateClientResponse, validateWebSocketMessage)
  src/types/guards.test.ts: Created comprehensive unit tests (72 tests) covering
    all generic helpers, validation result helpers, and detailed validation
    functions including edge cases, nested validation, and error path
    verification
  src/preload.ts: Updated with fully-typed electronAPI object containing logging,
    notification, configuration, and app lifecycle methods using
    ipcRenderer.send and ipcRenderer.invoke patterns
  src/types/electron.d.ts: Created global Window interface augmentation declaring
    electronAPI property with ElectronAPI type
  src/preload.test.ts: Created comprehensive unit tests (29 tests) mocking
    ipcRenderer to verify IPC channels, payload structures, convenience methods,
    and onConfigChanged unsubscribe functionality
log: []
schema: v1.0
childrenIds:
  - F-core-types-ipc-architecture
  - F-error-handling-framework
  - F-logging-system
  - F-system-notifications
created: 2026-01-29T01:44:00.864Z
updated: 2026-01-29T01:44:00.864Z
---

# Foundation & Core Infrastructure

## Purpose and Goals

Establish the foundational infrastructure that all other epics depend on. This includes the logging system, error handling patterns, notification utilities, TypeScript type definitions, and core architecture scaffolding. This epic must be completed first as it provides the shared utilities and patterns used throughout the application.

## Major Components and Deliverables

### 1. Logging System

- Structured logging with configurable levels (Error, Warn, Info, Debug, Trace)
- Log output to file and console
- Privacy-aware message logging (configurable content logging)
- Contextual logging with component identifiers

### 2. Error Handling Framework

- Centralized error types and handling patterns
- User-facing error message mapping
- Error recovery strategies (retry, fallback, notify)
- Graceful degradation patterns

### 3. System Notifications

- Native OS notification integration (Electron Notification API)
- Notification queue management
- Priority-based notification handling (low, medium, high)

### 4. Core Type Definitions

- Shared TypeScript interfaces for messages, clients, configuration
- Type guards and validation utilities
- API response/request types

### 5. IPC Architecture

- Define preload bridge API structure
- Main-to-renderer communication patterns
- Type-safe IPC channel definitions

### 6. Project Structure

- Create `src/services/`, `src/types/`, `src/utils/`, `src/components/` directories
- Establish module patterns and export conventions
- Set up barrel exports for clean imports

## Technical Considerations

- Use `pino` or `winston` for structured logging
- Leverage Electron's built-in `Notification` API
- Define strict TypeScript types (no `any`)
- Establish patterns for dependency injection in services

## Dependencies

- None (this is the foundational epic)

## Estimated Scale

3-4 features covering logging, error handling, notifications, and core types/structure

## User Stories

- As a developer, I can use consistent logging throughout the codebase with appropriate log levels
- As a developer, I can handle errors uniformly and provide user feedback
- As a user, I receive system notifications for important events (recording start/stop, errors)
- As a developer, I have well-defined TypeScript types for all shared data structures

## Non-Functional Requirements

- Logging must not impact application performance when at Info level or above
- Notifications must respect OS notification settings
- Error handling must never expose sensitive information (API keys, message content unless configured)

## Acceptance Criteria

1. [ ] Logging system implemented with configurable levels (Error through Trace)
2. [ ] Log output writes to both file and console
3. [ ] Privacy-aware logging respects `logMessageContent` configuration
4. [ ] Error handling patterns established and documented
5. [ ] User-facing error messages are clear and actionable
6. [ ] System notifications work on macOS and Windows
7. [ ] Core TypeScript types defined for messages, clients, and configuration
8. [ ] IPC bridge structure defined in preload.ts
9. [ ] Project directory structure created (`services/`, `types/`, `utils/`, `components/`)
10. [ ] Unit tests exist for logging and error handling utilities
