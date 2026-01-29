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
