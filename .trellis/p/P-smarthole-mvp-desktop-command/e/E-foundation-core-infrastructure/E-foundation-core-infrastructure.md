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
    type export from preload module; Added export for errors.ts to barrel export
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
  src/types/errors.ts: Created ErrorCode enum with all error codes, ErrorSeverity
    type, ERROR_SEVERITIES constant, and type guards (isErrorSeverity,
    isErrorCode)
  src/utils/errors.ts: "Created AppError base class with toJSON/fromJSON methods,
    SerializedAppError interface, and subclasses: ConfigurationError,
    NetworkError, IpcError, ServiceError"
  src/utils/index.ts: Created barrel export for utils module; Added export for
    error-messages module; Added export for error-utils module; Added export for
    error-recovery module; Added export for process-error-handlers module
  src/utils/errors.test.ts: Created comprehensive test suite with 40 tests
    covering all error classes, serialization, prototype chain, and error cause
    chaining
  src/utils/error-messages.ts: Created ERROR_MESSAGES constant mapping all
    ErrorCode values to user-friendly messages, getUserMessage() and
    getUserMessageSafe() helper functions, and re-exported isErrorCode type
    guard
  src/utils/error-messages.test.ts: Created comprehensive test suite with 26 tests
    covering message completeness, quality (no jargon, actionable, concise),
    getUserMessage, getUserMessageSafe, and isErrorCode
  src/utils/error-utils.ts: Created error wrapping utility with wrapError(),
    isAppError(), isErrorOfType(), and getRootCause() functions
  src/utils/error-utils.test.ts: Created comprehensive test suite with 56 tests
    covering all error wrapping scenarios
  src/components/ErrorBoundary.tsx: Created Error Boundary component with
    getDerivedStateFromError, componentDidCatch, reset functionality, IPC
    reporting, and support for custom fallback UI
  src/components/ErrorBoundary.test.tsx: Created comprehensive test suite with 25
    tests covering all acceptance criteria
  src/components/index.ts: Created barrel export for components module
  src/test-setup.ts: Created vitest setup file for jest-dom matchers
  vitest.config.ts: Updated to use jsdom environment, added React plugin, and setup file
  package.json: Added @testing-library/react, @testing-library/jest-dom, and jsdom
    dev dependencies; Added pino and pino-pretty dependencies
  src/utils/error-recovery.ts: Created error recovery utilities with
    retryWithBackoff(), withFallback(), withFallbackSync(),
    getRecoveryStrategy(), and isRetryable() functions
  src/utils/error-recovery.test.ts: Created comprehensive test suite with 59 tests
    covering all acceptance criteria
  src/utils/process-error-handlers.ts: Created new module with
    registerProcessErrorHandlers() and unregisterProcessErrorHandlers()
    functions, ErrorLogger and ProcessErrorHandlerOptions interfaces, and
    isDev() helper
  src/utils/process-error-handlers.test.ts: Created comprehensive test suite with
    36 tests covering handler registration, unregistration, uncaughtException
    handling, unhandledRejection handling, render-process-gone,
    child-process-gone, options handling, and error wrapping
  src/main.ts: "Added import and early registration of process error handlers with
    onFatalError callback; Added logger initialization early in startup, created
    IPC child logger, registered IPC handler for LOG_MESSAGE channel, added
    application startup logging; Added notification system integration: imports
    for NotificationService, NotificationQueue, and notification handler;
    initialization of notification service and queue after logger; child logger
    for notification IPC; IPC handler registration for NOTIFY_SHOW channel;
    cleanup on will-quit event to destroy the queue"
  src/services/logger.ts: Created main logger implementation with Logger
    interface, LoggerConfig, initializeLogger(), getLogger(), createLogger(),
    file transport with rotation, and child logger support; Added
    SENSITIVE_PATTERNS and CONTENT_FIELDS constants, isSensitiveKey(),
    isContentKey(), sanitizeLogData(), sanitizeArray(), applyContentRedaction(),
    applyContentRedactionArray(), and processLogContext() functions. Modified
    LoggerWrapper to accept logMessageContent flag and apply sanitization to all
    log context. Updated initializeLogger() and createLogger() to pass
    logMessageContent to LoggerWrapper.
  src/services/index.ts: Created barrel export for services module; Added export
    for notifications module; Added export for notification-queue module
  src/services/logger.test.ts: Created comprehensive unit tests (30 tests) for
    logger configuration, level filtering, and child loggers; Added 51 new tests
    for sanitizeLogData (sensitive pattern detection, non-sensitive data
    preservation, nested object handling, array handling, mixed data),
    applyContentRedaction (all content fields, nested objects, arrays,
    null/undefined handling), and Logger Privacy Integration tests.
  package-lock.json: Updated with new dependencies
  src/ipc/log-handler.ts: Created new module with createLogMessageHandler() and
    processLogMessage() functions for handling renderer log messages with
    payload validation and context enrichment
  src/ipc/index.ts: Created barrel export for IPC module; Added export for
    notification-handler module to barrel export file.
  src/ipc/log-handler.test.ts: Created comprehensive unit tests (32 tests)
    covering handler creation, payload validation, log level mapping, context
    enrichment, and edge cases
  src/services/logger.integration.test.ts: Created new integration test file with
    21 tests covering file writing, log rotation, IPC flow, log level filtering,
    and privacy features
  src/services/notifications.ts: Created new NotificationService with singleton
    pattern, Electron Notification API wrapper, content sanitization, and
    graceful degradation
  src/services/notifications.test.ts: Created comprehensive unit tests (33 tests)
    for NotificationService including singleton pattern, all methods, content
    sanitization, and graceful degradation
  src/services/notification-queue.ts: Created NotificationQueue class with
    priority ordering, rate limiting (sliding window), notification coalescing,
    queue overflow handling, and singleton pattern
  src/services/notification-queue.test.ts: Created comprehensive unit tests (34
    tests) covering singleton pattern, priority ordering, rate limiting,
    coalescing, queue overflow, clear/destroy methods, and edge cases
  src/ipc/notification-handler.ts: Created IPC notification handler with
    createNotificationHandler() factory function and processNotification() for
    testing. Validates payloads using isNotifyShowPayload(), logs invalid
    payloads as warnings, converts valid payloads to NotificationOptions, and
    enqueues via NotificationQueue.
  src/ipc/notification-handler.test.ts: Created comprehensive unit tests (31
    tests) covering payload validation (missing title/body/type/priority,
    invalid types), valid payload processing, notification enqueuing, error
    handling when queue throws, and edge cases (empty strings, long content,
    special characters).
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
