# SmartHole Living Specification

## Overview

SmartHole is a desktop system tray application that serves as a central command hub for personal assistant interactions. It captures user input via voice or text, uses an LLM to intelligently route commands to connected client plugins, and manages the lifecycle of those plugin connections.

**Core Value Proposition:** A single, always-available input point that routes commands to the right intelligent application without the user needing to switch contexts or manually choose destinations.

---

## System Architecture

### SmartHole Server Responsibilities

SmartHole is responsible for:

1. **Input Capture**
   - Global hotkey registration and handling
   - Voice recording (push-to-talk and toggle modes)
   - Text input via popup window

2. **Speech-to-Text**
   - Converting voice input to text
   - Configurable backend: local Whisper or cloud API

3. **Intelligent Routing**
   - Using an LLM (routing agent) to decide which client(s) should receive a message
   - Direct routing bypass when user explicitly names a client
   - Re-routing when clients reject messages

4. **Plugin Registry**
   - Accepting client registrations
   - Tracking connected clients and their routing descriptions
   - Detecting disconnections and cleaning up stale registrations

5. **Message Delivery**
   - Sending messages to one or more clients
   - Handling delivery failures gracefully

6. **User Notification**
   - Surfacing notifications requested by clients
   - Informing user when messages cannot be handled

7. **Logging**
   - Configurable verbosity levels
   - Recording routing decisions, client interactions, errors

### NOT SmartHole's Responsibility

- **Plugin configuration** - Each client manages its own settings
- **Plugin behavior** - What clients do with messages is their business
- **Plugin lifecycle** - Clients start/stop independently; SmartHole just reacts
- **Message persistence** - No queuing of undeliverable messages (MVP)
- **Client-to-client communication** - No broker functionality (MVP)

---

## Input Mechanisms

### Global Hotkey

A configurable system-wide keyboard shortcut that:

- Can trigger voice recording (push-to-talk or toggle mode)
- Can open the text input popup

### Voice Input

Two recording modes supported:

1. **Push-to-talk**: Hold hotkey while speaking, release to send
2. **Toggle**: Press hotkey to start recording, press again to stop

Audio is captured and sent to the configured STT backend.

### Text Input Popup

A minimal, floating input window (similar to Spotlight/Alfred):

- Appears via hotkey or tray menu action
- Single text field for typing commands
- Submits on Enter, dismisses on Escape
- Auto-dismisses after sending

### Tray Menu

Right-click context menu providing:

- Open text input
- Access settings/preferences
- View connection status
- Quit application

---

## Speech-to-Text

### Configuration

Users can choose between:

1. **Local (self-hosted Whisper)**
   - Runs on user's machine
   - Privacy-friendly, works offline
   - Requires adequate hardware

2. **Cloud API**
   - OpenAI Whisper API, Groq, or similar
   - Simpler setup, works on any hardware
   - Requires internet, has cost/privacy tradeoffs

### Output

STT produces:

- Transcribed text
- Confidence score (if available from backend)
- Timing metadata

---

## Routing Agent

### Purpose

The routing agent is a fast LLM (initially Claude Haiku) that examines incoming messages and decides which client(s) should receive them.

### Architecture: Tool-Based Routing

The routing agent uses **tool use** rather than structured output. Each registered client is exposed to the agent as a callable tool.

**Rationale:**

- Prevents hallucination of client names (can only call defined tools)
- Multi-client routing is natural (multiple tool calls)
- Extensible: non-routing tools can be added later (ask_user, defer, etc.)
- Aligns with MCP mental model for plugin descriptions

### Dynamic Tool Generation

When clients connect or disconnect, SmartHole rebuilds the tool definitions:

```typescript
// Example generated tool for a "notebook" client
{
  name: "route_to_notebook",
  description: "Handles note-taking, journaling, memory storage, and anything the user wants to remember or write down.",
  input_schema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The user's message to send to this client"
      },
      reason: {
        type: "string",
        description: "Brief explanation of why this client was chosen"
      }
    },
    required: ["message"]
  }
}
```

Tool names follow pattern: `route_to_{client_name}`

### Agent Inputs

The routing agent receives:

- Transcribed user message (as user message content)
- Dynamically generated tools (one per registered client)
- System prompt explaining its routing role
- (Optionally) recent interaction history for context

### Agent Outputs

The routing agent produces tool calls:

- One or more `route_to_{client}` tool calls
- Each tool call includes the message and optional routing reason

### Future Extensibility

The tool-based architecture allows adding non-routing capabilities later:

- `ask_user`: Request clarification when message is ambiguous
- `defer_message`: Hold message for later (if queuing is added)
- `combine_with_memory`: Reference long-term context (if memory is added)

**MVP implements routing tools only.**

### Direct Routing Bypass

If a message explicitly begins with a client name followed by a delimiter (e.g., `notebook: remember this`), SmartHole routes directly to that client without invoking the routing agent.

Pattern: `{client_name}: {message}` or `{client_name}, {message}`

### Rejection Handling

When a client rejects a message:

1. SmartHole invokes the routing agent again with:
   - Original message
   - Rejection reason from client (included in conversation context)
   - Updated tool list (excluding the rejecting client, or marked as "already tried")
2. Routing agent decides via tool calls: route to another client, or (future) use `ask_user` tool
3. If no tool is called or no clients remain, SmartHole notifies user that message couldn't be handled

### LLM Configuration

- **MVP**: Anthropic API with Claude Haiku
- **Future**: Design abstractions to support other providers (OpenAI, local LLMs)

---

## Plugin/Client System

### Communication Protocol

**Local WebSocket server** bound to `127.0.0.1` only (no external network exposure).

Rationale:

- Simple, battle-tested protocol
- Works with any language/platform
- Suitable for Electron apps, Obsidian plugins, standalone applications
- Minimal security concern when localhost-only

### Client Registration

When a client connects, it sends a registration message containing:

```typescript
interface ClientRegistration {
  name: string; // Unique identifier (e.g., "notebook", "home-assistant")
  description: string; // Free-form routing hint for the LLM
  version?: string; // Client version for debugging
  capabilities?: string[]; // Optional structured hints
}
```

**Description Examples:**

- "I handle note-taking, journaling, memory storage, and anything the user wants to remember or write down."
- "I control smart home devices: lights, thermostats, locks, and home automation routines."

### Client Lifecycle

1. **Connection**: Client opens WebSocket to SmartHole
2. **Registration**: Client sends registration message
3. **Active**: Client receives routed messages, sends responses
4. **Disconnection**: Client closes connection (intentional or crash)
5. **Deregistration**: SmartHole removes client from registry

SmartHole does not attempt to keep clients alive or restart them.

### Message Delivery

Messages from SmartHole to clients:

```typescript
interface RoutedMessage {
  id: string; // Unique message ID for correlation
  text: string; // Raw transcribed text (unmodified)
  timestamp: string; // ISO 8601 timestamp
  metadata: {
    confidence?: number; // STT confidence if available
    routingReason?: string; // From agent's tool call reason parameter
    inputMethod: "voice" | "text";
    directRouted: boolean; // True if bypassed routing agent
  };
}
```

### Client Responses

Clients can send messages back to SmartHole. MVP response types:

```typescript
interface ClientResponse {
  messageId: string; // Correlates to RoutedMessage.id
  type: "ack" | "reject" | "notification";
  payload: {
    // For 'reject':
    reason?: string; // Why the client can't handle this

    // For 'notification':
    title?: string;
    body?: string;
    priority?: "low" | "normal" | "high";
  };
}
```

**Design for extensibility**: The protocol should accommodate additional response types in the future without breaking changes.

### Multi-Client Routing

A single message may be routed to multiple clients simultaneously. Each client processes independently and sends its own response.

---

## Error Handling

### Client Disconnection

When SmartHole detects a client has disconnected:

1. Remove from active registry
2. Log the disconnection
3. Continue operating with remaining clients

### Undeliverable Messages

When a message cannot be delivered (no clients available, all rejected):

1. Notify user immediately via system notification
2. Include reason: "No client available" or "All clients rejected"
3. No queuing or retry (MVP)

### STT Failures

If speech-to-text fails:

1. Notify user of the failure
2. Suggest trying text input instead
3. Log error details

### Routing Agent Failures

If the LLM call fails:

1. Attempt direct routing if message matches a client name pattern
2. Otherwise, notify user that routing failed
3. Log error details

---

## Logging

### Log Levels

- **Error**: Failures requiring attention
- **Warn**: Unexpected but handled situations
- **Info**: Significant events (connections, routing decisions)
- **Debug**: Detailed operational information
- **Trace**: Verbose protocol-level details

### What Gets Logged

- Client connections/disconnections
- Incoming messages (configurable: full text or summary)
- Routing decisions and rationale
- Message delivery success/failure
- Client responses
- Errors and exceptions

### Privacy Consideration

Users should be able to configure whether message content is logged, especially for voice input which may contain sensitive information.

---

## Configuration

### User-Configurable Settings

| Setting             | Description                      | Default            |
| ------------------- | -------------------------------- | ------------------ |
| Global hotkey       | Keyboard shortcut for activation | Platform-dependent |
| Voice input mode    | Push-to-talk or toggle           | Push-to-talk       |
| STT backend         | Local Whisper or cloud API       | Cloud              |
| STT API key         | API key for cloud STT            | (none)             |
| Local Whisper path  | Path to Whisper installation     | (auto-detect)      |
| Log level           | Minimum severity to log          | Info               |
| Log message content | Whether to log full message text | false              |
| WebSocket port      | Port for client connections      | 9473               |

### Configuration Storage

Settings stored in platform-appropriate location:

- macOS: `~/Library/Application Support/SmartHole/`
- Windows: `%APPDATA%/SmartHole/`
- Linux: `~/.config/SmartHole/`

---

## Security Considerations

### Local-Only Communication

WebSocket server binds exclusively to `127.0.0.1`, preventing external network access.

### No Authentication (MVP)

Since communication is local-only, MVP does not implement authentication between SmartHole and clients.

**Future consideration**: Optional shared secret or token for environments where local security is a concern.

### API Key Storage

STT and LLM API keys should be stored securely:

- Use OS keychain where available
- Encrypt at rest if keychain unavailable
- Never log API keys

### Electron Security

Leverage existing security hardening (already configured in project):

- ASAR integrity validation
- Disabled Node.js CLI options
- Cookie encryption

---

## User Experience

### First Run

1. Request necessary permissions (microphone, accessibility for global hotkey)
2. Prompt for STT configuration
3. Prompt for Anthropic API key (for routing agent)
4. Show brief onboarding explaining how to use hotkey

### Steady State

- Tray icon indicates SmartHole is running
- Tray icon changes appearance when recording/processing
- Minimal CPU/memory footprint when idle
- Fast response time from hotkey to ready-to-record

### Feedback

User should receive clear feedback for:

- Recording started/stopped
- Message being processed
- Message delivered to client(s)
- Errors or failures

---

## Platform Support

### MVP Platforms

- macOS (primary development target)
- Windows

### Platform-Specific Considerations

**macOS:**

- Tray icon uses template images (adapts to light/dark menu bar)
- Dock icon hidden (tray-only app)
- Microphone permission required
- Accessibility permission may be needed for global hotkey

**Windows:**

- System tray with context menu
- May need to run at startup for always-available experience

---

## Definition of Done

MVP is complete when:

1. [ ] Application runs in system tray on macOS and Windows
2. [ ] Global hotkey triggers voice recording
3. [ ] Push-to-talk and toggle recording modes work
4. [ ] Text input popup opens via hotkey/menu
5. [ ] Voice is transcribed via configurable STT backend
6. [ ] Routing agent (Haiku) receives messages and selects clients
7. [ ] Direct routing works for `clientname: message` pattern
8. [ ] WebSocket server accepts client connections
9. [ ] Clients can register with name and description
10. [ ] Messages are delivered to selected client(s)
11. [ ] Client rejections trigger re-routing via agent
12. [ ] User is notified when messages cannot be handled
13. [ ] Disconnected clients are detected and deregistered
14. [ ] Configuration UI allows setting hotkey, STT, API keys
15. [ ] Logging captures routing decisions and errors

---

## Future Considerations

These are explicitly **not** part of MVP but should be kept in mind during design:

- **Scheduler**: Timed/proactive plugin invocation (morning reports, reminders)
- **Text-to-Speech**: SmartHole speaking responses back to user
- **Client-to-Client Broker**: Allowing clients to send messages through SmartHole to other clients
- **Long-term Memory**: Building up learned context over time
- **Multi-device**: Network of SmartHoles across phone, computer, home server
- **Built-in Plugins**: Calendar, to-do, and other first-party integrations
- **Authentication**: Token-based auth for client connections
- **Message Queuing**: Holding messages for offline clients

---

## Open Questions

Items that need further exploration or decisions during implementation:

1. **Whisper integration**: Exact approach for local Whisper (subprocess? library binding?)
2. **Hotkey library**: Which Electron-compatible library for cross-platform global shortcuts
3. **Client name validation**: Rules for valid client names (must be valid for tool name generation), collision handling
4. **Rate limiting**: Should SmartHole limit how fast it processes messages?
5. **Routing agent prompt**: System prompt engineering for reliable routing behavior
6. **Tool name sanitization**: How to convert client names to valid tool names (`route_to_{name}`)
7. **Rejection context**: How to represent "already tried" clients to the agent on re-routing attempts
