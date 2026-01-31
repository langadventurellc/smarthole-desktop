---
id: P-smarthole-mvp-desktop-command
title: SmartHole MVP - Desktop Command Hub
status: in-progress
priority: medium
parent: none
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
    type export from preload module; Added export for errors.ts to barrel
    export; Added export for client-registry types; Added export for input types
    module
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
    IpcResponseMap), and comprehensive type guards; Added WEBSOCKET_STATUS_GET
    and WEBSOCKET_STATUS_CHANGED IPC channels, WebSocketServerState type,
    WebSocketServerStatus interface, isWebSocketServerState and
    isWebSocketServerStatus type guards, and updated
    IpcPayloadMap/IpcResponseMap; Added 4 new IPC channels (MESSAGE_SEND,
    MESSAGE_SEND_MULTIPLE, MESSAGE_GET_STATUS, MESSAGE_GET_RECENT),
    IpcDeliveryResult, IpcDeliveryStatus, IpcRoutedMessage types for IPC
    serialization, and payload/response types for all new channels. Updated
    IpcPayloadMap and IpcResponseMap.; Added 4 client status IPC channels,
    ClientSummary, ClientDetails, ClientGetDetailsPayload, and
    ClientStatusChangedPayload types, plus payload/response map entries; Added 4
    new IPC channels (HOTKEY_ACTIVATED, HOTKEY_RELEASED, INPUT_STATE_CHANGED,
    INPUT_GET_STATE), imported and re-exported hotkey and input state types,
    updated IpcPayloadMap and IpcResponseMap; Added 5 text input popup IPC
    channels, TextInputSubmitPayload and TextInputOpenPayload interfaces,
    updated IpcPayloadMap with new channel mappings, added
    isTextInputSubmitPayload type guard
  src/types/ipc.test.ts: Created 86 unit tests covering IPC channel values, all
    type guards, interface structures, type maps, and type-level constraints
    using @ts-expect-error; Updated tests to include new WebSocket channels,
    increased channel count from 7 to 9, and updated naming convention regex to
    allow domain:action:sub pattern; Updated test for channel count (9 to 13),
    updated naming convention regex to allow camelCase actions, added test for
    new message delivery channels.; Updated channel count test and added tests
    for new client status channels; Updated channel count test from 17 to 21,
    added tests for new hotkey and input state channels; Added tests for new
    text input popup channels, TextInputSubmitPayload type guard tests,
    TextInputOpenPayload interface tests, updated channel count test from 21 to
    26, updated naming convention regex to allow camelCase domains
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
  src/preload.ts: "Updated with fully-typed electronAPI object containing logging,
    notification, configuration, and app lifecycle methods using
    ipcRenderer.send and ipcRenderer.invoke patterns; Added getWebSocketStatus()
    and onWebSocketStatusChange(callback) methods to the electronAPI; Added 4
    new methods to electronAPI: sendMessage, sendMessageMultiple,
    getMessageStatus, getRecentDeliveries with full TypeScript types.; Added
    getClientCount, getClientList, getClientDetails, and onClientStatusChange
    methods to the preload API; Added onHotkeyActivated, onHotkeyReleased,
    getInputState, and onInputStateChanged APIs to electronAPI"
  src/types/electron.d.ts: Created global Window interface augmentation declaring
    electronAPI property with ElectronAPI type; Added PopupAPI type import and
    Window.popupAPI declaration for type-safe popup renderer code
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
    dev dependencies; Added pino and pino-pretty dependencies; Added @types/ws
    as a dev dependency (ws was already installed); Added uiohook-napi
    dependency (via npm install)
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
    cleanup on will-quit event to destroy the queue; Integrated WebSocket server
    initialization in app.whenReady() and shutdown in will-quit event; Added
    WebSocket state tracking with wsState object, status change broadcasting on
    connection events, and registered WebSocket status IPC handler with
    ipcMain.handle(); Added client registry and registration handler
    initialization, wired up message event to registration handler.; Added
    getClientRegistry import. Modified WebSocket 'disconnection' event handler
    to: (1) calculate connection duration, (2) call registry.unregisterById() to
    clean up registered clients, (3) log disconnection with client details
    including duration, code, and reason. Different log levels for registered vs
    unregistered clients.; Integrated message delivery service: added import,
    added messageDelivery to wsState, initialized service after registration
    handler, wired up response handling in WebSocket message event handler;
    Registered message delivery IPC handlers using
    registerMessageDeliveryHandlers inside app.whenReady().; Registered client
    status IPC handlers and subscribed to registry events for real-time
    broadcasts; Refactored tray menu to support dynamic updates: added
    buildTrayMenu() function that builds menu with client status from registry,
    added updateTrayMenu() function to rebuild menu on status change, modified
    createTray() to use buildTrayMenu(), subscribed to registry 'registered' and
    'unregistered' events to trigger menu updates; Added imports for
    NotificationPayload, ClientNotificationPriority, NotificationPriority. Added
    mapClientPriorityToQueuePriority() helper to map client 'normal' priority to
    queue 'medium'. Added hasNotificationContent() helper to validate
    notifications. Added response:notification event listener that validates,
    maps, and enqueues client notifications.; Added imports for services and
    handlers, initialized hotkey manager and input state service, wired events
    to IPC broadcasts and state transitions, added cleanup in will-quit handler;
    Added popup service imports, popupState tracking, TextInputPopup
    initialization, IPC handler registration, hotkey wiring, and submitted event
    subscription"
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
    for notifications module; Added export for notification-queue module; Added
    export for client-registry service; Added export for registration-handler
    module.; Added export for hotkey-manager module; Added export for
    input-state service module
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
    notification-handler module to barrel export file.; Added export for
    client-status-handler module; Added exports for hotkey-handler and
    input-state-handler modules; Added export for text-input-handler module
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
  src/services/notifications.integration.test.ts: "Created new integration test
    file with 28 tests covering full notification system flow: IPC handler ->
    NotificationQueue -> NotificationService. Tests include full flow
    validation, high priority immediate display, rate limiting integration,
    invalid payload rejection, graceful degradation when notifications not
    supported, coalescing integration, content sanitization, and queue overflow
    handling."
  src/services/websocket-server.ts: Created new WebSocket server service with
    singleton pattern, localhost-only binding, connection validation, lifecycle
    management, and error handling; Added connection tracking with Map<ClientId,
    ConnectionInfo>, heartbeat monitoring with configurable interval/timeout,
    event emitters for connection/disconnection/error events, TrackedWebSocket
    interface for isAlive flag pattern, getActiveConnections() and
    getConnection() APIs, startHeartbeat/stopHeartbeat/performHeartbeat private
    methods; Added 'message' event to WebSocketServerEvents, updated
    'connection' event signature, added message handler in handleConnection
    method.
  src/services/websocket-server.test.ts: Added focused unit tests for
    initialization, lifecycle, and localhost validation; Added 9 new tests for
    connection tracking (track connections, remove on disconnect, emit events,
    get by ID) and heartbeat monitoring (lastActivity updates, event
    unsubscription)
  src/ipc/websocket-status-handler.ts: Created new IPC handler with
    buildWebSocketStatus helper function, createWebSocketStatusHandler factory
    function, and broadcastWebSocketStatusChange for pushing status updates to
    renderer windows
  src/ipc/websocket-status-handler.test.ts: Added 9 unit tests covering
    buildWebSocketStatus state mapping and createWebSocketStatusHandler behavior
  src/types/client-registry.ts: Created new type definitions file with
    RegistryClient, RegistryClientInfo, RegistrationSuccess,
    RegistrationFailure, RegistrationResponse, RegistrationErrorCode,
    ClientRegisteredEvent, ClientUnregisteredEvent, ClientRegistryEvents,
    WebSocketRegistrationResponse, and validation helpers
  src/services/client-registry.ts: Created ClientRegistry service with
    EventEmitter pattern, Map-based storage, register/unregister operations,
    lookup methods, and singleton management (initializeClientRegistry,
    getClientRegistry, resetClientRegistry)
  src/services/client-registry.test.ts: Added 14 unit tests covering
    initialization, registration, unregistration, lookup operations, and clear
    functionality
  src/services/registration-handler.ts: Created new registration handler service
    with message parsing, validation, and response sending. Includes singleton
    pattern with initialize/get/reset functions.
  src/services/registration-handler.test.ts: Added 13 unit tests covering
    initialization, message parsing, validation, and registration flow.
  src/services/message-delivery.ts: "Created new message delivery service with
    singleton pattern, DeliveryResult/DeliveryError/DeliveryStatus types,
    sendToClient/sendToClients methods, delivery history tracking with LRU
    eviction, and structured logging; Extended with response handling: added
    DeliveryResponse interface, ResponseContext, ResponseProcessResult types,
    MessageDeliveryEvents interface for typed events, handleResponse() and
    on/off() methods to MessageDeliveryService interface, processResponse() and
    findDeliveryStatusForUpdate() private methods, EventEmitter for events,
    parseMessage() helper function; Added responseTimeoutMs config option,
    pendingResponses Map for timer tracking,
    startResponseTimer/cancelResponseTimer/clearAllPendingTimers/handleTimeout
    methods, timer start on successful delivery, timer cancel on response
    received, timer cleanup on reset"
  src/services/message-delivery.test.ts: "Added comprehensive unit tests covering
    initialization, single/multi-client delivery, error handling for all failure
    modes, delivery history tracking, and history eviction behavior; Added
    handleResponse test suite with 10 tests covering: ack/reject/notification
    response processing, delivery status updates, event emission for all
    response types, handling unknown messageIds, invalid JSON, non-response
    messages, and invalid message formats; Added 7 new tests for response
    timeout: default 30s timeout, custom timeout, status update on timeout,
    timer cancellation on response, no timer for failed deliveries, multiple
    concurrent timeouts, timer cleanup on reset"
  src/ipc/message-delivery-handlers.ts: Created new file with handler factory
    functions (createMessageSendHandler, createMessageSendMultipleHandler,
    createMessageGetStatusHandler, createMessageGetRecentHandler) and
    registerMessageDeliveryHandlers convenience function. Includes type
    conversion helpers for branded types and Map serialization.
  src/ipc/message-delivery-handlers.test.ts: Created new test file with 11 unit
    tests covering all handlers, error handling when service not initialized,
    Map-to-array serialization, and proper type conversion.
  docs/message-delivery.md: Created new documentation file covering message
    delivery initialization, sending messages, delivery results, response
    handling with event subscriptions, delivery status tracking, IPC interface
    with all 4 channels, renderer usage examples, configuration options, wire
    format, and singleton pattern
  CLAUDE.md: Updated project structure to include message-delivery in services
    list, added link to new message-delivery.md documentation in Detailed
    Documentation section; Updated services list to include hotkey-manager and
    input-state; added link to global-hotkey-system.md in Detailed Documentation
    section
  src/ipc/client-status-handler.ts: Created new IPC handler file with
    createClientCountHandler, createClientListHandler,
    createClientDetailsHandler, broadcastClientStatusChange,
    createRegisteredEventHandler, and createUnregisteredEventHandler functions
  src/ipc/client-status-handler.test.ts: Added comprehensive tests for all handler
    functions and broadcast behavior (14 tests)
  src/services/hotkey-manager.ts: Created hotkey manager service with singleton
    pattern, EventEmitter for events, Electron globalShortcut integration,
    uiohook-napi for key up detection, and macOS accessibility permission
    handling; Refactored to use lazy loading for uiohook-napi - removed
    top-level import, added loadUiohook() for dynamic import,
    buildAcceleratorToKeycodeMap() for lazy keycode map creation,
    setupUiohookListeners() called lazily after first registerHotkeys() call
  src/services/hotkey-manager.test.ts: Added unit tests for initialization,
    registration, event emission, unregistration, and accessibility permissions
  src/types/input.ts: "Created input state types: InputState enum, InputStateInfo
    interface, InputStateChangedEvent, InputModeChangedEvent, and
    InputStateEvents interface"
  src/services/input-state.ts: Created InputStateService with singleton pattern,
    validated state machine, EventEmitter for events, mode tracking
  src/services/input-state.test.ts: Added unit tests for state machine
    transitions, event emission, mode changes, and getStateInfo
  src/ipc/hotkey-handler.ts: Created new IPC handler with
    broadcastHotkeyActivated, broadcastHotkeyReleased, and
    wireHotkeyManagerToIpc functions
  src/ipc/input-state-handler.ts: Created new IPC handler with
    broadcastInputStateChanged, createInputStateHandler, and wireInputStateToIpc
    functions
  src/types/hotkey.ts: Created new types file for hotkey event types (HotkeyType,
    HotkeyActivatedEvent, HotkeyReleasedEvent, HotkeyErrorCode,
    HotkeyErrorEvent) to avoid circular dependency between types and services
  docs/global-hotkey-system.md: Created comprehensive documentation for the global
    hotkey system covering architecture, services (HotkeyManager, InputState),
    IPC channels, renderer API, types, configuration, platform notes, and error
    handling
  src/windows/text-input-popup.ts: Created singleton service with
    TextInputPopupService interface, show/hide methods, screen positioning via
    calculateCenteredPosition(), focus management, EventEmitter for callbacks,
    path resolution for preload/popup URL, and app cleanup handlers; Updated
    getPopupUrl() to use POPUP_WINDOW_VITE_DEV_SERVER_URL env var and correct
    production path to popup.html
  src/windows/index.ts: Created module exports for TextInputPopupService,
    functions (initialize, get, reset, getImpl), calculateCenteredPosition, and
    event types
  src/windows/text-input-popup.test.ts: Added 20 unit tests covering singleton
    lifecycle, show (positioning, focus, placeholder, events), hide (window,
    input clearing, focus restoration), isVisible, event
    subscription/unsubscription, and getWindow accessor
  src/preload-popup.ts: Created preload script with PopupAPI exposing submit,
    dismiss, notifyFocused methods and onPlaceholderChange, onClear event
    listeners via contextBridge
  src/popup/index.html: Created minimal HTML entry point for popup window with
    module script reference; Deleted - replaced by popup.html at project root
  src/popup/popup.tsx: Created React component with auto-focus, keyboard handling
    (Enter submits, Escape dismisses), placeholder/clear subscriptions
  src/popup/popup.css: Created Spotlight-like styling with semi-transparent
    background, blur, dark mode and high contrast support
  src/ipc/text-input-handler.ts: Created IPC handlers for text input popup
    (createTextInputSubmitHandler, createTextInputDismissedHandler,
    createTextInputFocusedHandler, wireTextInputToHotkey,
    registerTextInputHandlers)
  src/ipc/text-input-handler.test.ts: Created 10 unit tests for submit handler
    validation, dismissed handler, focused handler, and hotkey wiring scenarios
  vite.popup-preload.config.ts: Created new Vite config for popup preload script with electron external
  vite.popup-renderer.config.ts: Created new Vite config for popup renderer with
    React plugin and rollupOptions.input pointing to popup.html
  forge.config.ts: Added popup preload entry (src/preload-popup.ts) and
    popup_window renderer entry to VitePlugin configuration
  index.html: Created at project root (moved from src/index.html) - fixes
    pre-existing production build issue
  popup.html: Created at project root as popup window entry point
  src/index.html: Deleted - moved to project root
log: []
schema: v1.0
childrenIds:
  - E-configuration-user-experience
  - E-foundation-core-infrastructure
  - E-input-capture-system
  - E-intelligent-routing-agent
  - E-plugin-client-system
  - E-speech-to-text-integration
created: 2026-01-29T01:22:45.643Z
updated: 2026-01-29T01:22:45.643Z
---

# SmartHole MVP - Desktop Command Hub

## Executive Summary

SmartHole is a cross-platform desktop system tray application that serves as a central command hub for personal assistant interactions. It captures user input via voice or text, uses an LLM (Claude Haiku) to intelligently route commands to connected client plugins via WebSocket, and manages the lifecycle of those plugin connections.

**Core Value Proposition:** A single, always-available input point that routes commands to the right intelligent application without the user needing to switch contexts or manually choose destinations.

## Target Platforms

- **Primary:** macOS (development target)
- **Secondary:** Windows

## Technical Stack

- **Framework:** Electron 40+ with Vite
- **UI:** React 19, TypeScript 5.9+
- **Testing:** Vitest
- **Build:** Electron Forge with Vite plugin
- **Code Quality:** ESLint 9 (flat config) + Prettier

## Functional Requirements

### 1. Input Capture

- **Global Hotkey Registration:** System-wide keyboard shortcut that activates voice recording or text input
- **Voice Input:**
  - Push-to-talk mode (hold hotkey while speaking, release to send)
  - Toggle mode (press to start, press again to stop)
- **Text Input Popup:** Minimal floating input window (Spotlight/Alfred-style)
  - Opens via hotkey or tray menu
  - Single text field, submit on Enter, dismiss on Escape
  - Auto-dismisses after sending
- **Tray Menu:** Right-click context menu with: open text input, settings, connection status, quit

### 2. Speech-to-Text (STT)

- **Backend Options:**
  - Local (self-hosted Whisper) - privacy-friendly, works offline
  - Cloud API (OpenAI Whisper, Groq, etc.) - simpler setup
- **Output:** Transcribed text, confidence score (if available), timing metadata

### 3. Intelligent Routing Agent

- **LLM:** Claude Haiku via Anthropic API
- **Architecture:** Tool-based routing (each registered client exposed as a callable tool)
- **Dynamic Tool Generation:** Rebuilds tool definitions when clients connect/disconnect
- **Tool Pattern:** `route_to_{client_name}` with message and optional reason parameters
- **Direct Routing Bypass:** Pattern matching for `{client_name}: {message}` or `{client_name}, {message}`
- **Rejection Handling:** Re-invoke agent with rejection context, exclude rejecting client from options

### 4. Plugin/Client System

- **Protocol:** WebSocket server on 127.0.0.1:9473 (localhost only)
- **Registration:** Clients send name, description (routing hint), optional version and capabilities
- **Message Delivery:** RoutedMessage with id, text, timestamp, metadata (confidence, routingReason, inputMethod, directRouted)
- **Client Responses:** ack, reject (with reason), notification (title, body, priority)
- **Multi-Client Routing:** Single message can route to multiple clients simultaneously

### 5. Error Handling

- Client disconnection detection and deregistration
- Undeliverable message user notification (no queuing in MVP)
- STT failure notification with text input fallback suggestion
- Routing agent failure fallback to direct routing pattern

### 6. Logging

- Levels: Error, Warn, Info, Debug, Trace
- Logs: connections/disconnections, messages (configurable), routing decisions, delivery status, errors
- Privacy: Configurable message content logging

### 7. Configuration

| Setting             | Default            |
| ------------------- | ------------------ |
| Global hotkey       | Platform-dependent |
| Voice input mode    | Push-to-talk       |
| STT backend         | Cloud              |
| STT API key         | (none)             |
| Local Whisper path  | (auto-detect)      |
| Log level           | Info               |
| Log message content | false              |
| WebSocket port      | 9473               |

**Configuration Storage Paths:**

- **macOS:** `~/Library/Application Support/SmartHole/`
- **Windows:** `%APPDATA%/SmartHole/`
- **Linux:** `~/.config/SmartHole/`

### 8. User Experience

- **First Run:** Permission requests (microphone, accessibility), STT config, API key, onboarding
- **Steady State:** Tray icon status indicator (running/recording/processing), minimal resource footprint
- **Feedback:** Clear feedback for recording state, processing, delivery, errors

## Non-Functional Requirements

### Security

- WebSocket binds exclusively to 127.0.0.1 (no external network access)
- No client authentication in MVP (local-only communication)
- Secure API key storage (OS keychain where available)
- Existing Electron security: ASAR integrity, disabled Node.js CLI options, cookie encryption

### Performance

- Fast response time from hotkey to ready-to-record
- Minimal CPU/memory footprint when idle
- Efficient WebSocket message handling

## Architecture Overview

```
src/
├── main.ts              # Electron main process, tray, system integration
├── preload.ts           # Secure IPC bridge
├── renderer.tsx         # React entry point
├── services/
│   ├── hotkey-manager   # Global hotkey handling
│   ├── audio-recorder   # Microphone capture
│   ├── stt-service      # Speech-to-text abstraction
│   ├── routing-agent    # Claude Haiku integration
│   ├── websocket-server # Client communication
│   └── config-manager   # Settings persistence
├── types/               # TypeScript interfaces
├── components/          # React UI components
└── utils/               # Logging, IPC handlers
```

## Key Dependencies to Add

- Global hotkey library (cross-platform)
- WebSocket server (`ws`)
- Anthropic SDK (`@anthropic-ai/sdk`)
- Audio recording library
- STT integration (Whisper API client, local Whisper binding)
- Secure storage (`keytar` for OS keychain)
- Configuration persistence (`electron-store`)
- Structured logging (`pino` or `winston`)

## Existing Foundation

The project already has:

- Electron + Vite + React 19 setup with TypeScript
- Basic tray icon implementation (macOS template images, dock hiding)
- Electron security hardening configured
- ESLint 9 + Prettier + Vitest tooling
- mise task runner integration

## NOT SmartHole's Responsibility

Clear boundaries for what SmartHole does NOT handle:

- **Plugin configuration** - Clients manage their own settings
- **Plugin behavior** - SmartHole routes messages, plugins decide what to do with them
- **Plugin lifecycle** - Clients are responsible for their own startup/shutdown
- **Message persistence** - No queuing or storage of messages for offline clients
- **Client-to-client communication** - Plugins cannot send messages to each other through SmartHole
- **Response handling** - SmartHole delivers messages; it does not process or display client responses (except notifications)

## Acceptance Criteria

1. [ ] Application runs in system tray on macOS and Windows
2. [ ] Global hotkey triggers voice recording
3. [ ] Push-to-talk and toggle recording modes work
4. [ ] Text input popup opens via hotkey/menu
5. [ ] Voice is transcribed via configurable STT backend
6. [ ] Routing agent (Haiku) receives messages and selects clients via tool calls
7. [ ] Direct routing works for `clientname: message` pattern
8. [ ] WebSocket server accepts client connections on 127.0.0.1:9473
9. [ ] Clients can register with name and description
10. [ ] Messages are delivered to selected client(s)
11. [ ] Client rejections trigger re-routing via agent
12. [ ] User is notified when messages cannot be handled
13. [ ] Disconnected clients are detected and deregistered
14. [ ] Configuration UI allows setting hotkey, STT, API keys
15. [ ] Logging captures routing decisions and errors

## Out of Scope (Future Considerations)

- Scheduler/proactive plugin invocation
- Text-to-Speech responses
- Client-to-client broker
- Long-term memory
- Multi-device support
- Built-in plugins (calendar, to-do)
- Client authentication
- Message queuing for offline clients

**Future Extensibility Tools** (potential additions to routing agent):

- `ask_user` - Request clarification from user before routing
- `defer_message` - Schedule message for later delivery
- `combine_with_memory` - Integrate with long-term context storage

## Open Questions (To Address During Implementation)

1. Whisper integration approach (subprocess vs library binding)
2. Hotkey library selection for cross-platform support
3. Client name validation rules and collision handling
4. Rate limiting strategy
5. Routing agent system prompt engineering
6. Tool name sanitization for client names
7. Rejection context representation for re-routing
