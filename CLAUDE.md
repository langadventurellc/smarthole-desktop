# SmartHole Desktop

Cross-platform Electron tray application (Windows, macOS) with React/TypeScript. Runs as a system tray app with minimal window UI.

## Tech Stack

Electron 40+, React 19, TypeScript 5.9+, Vite 7, Vitest, ESLint 9 + Prettier

## Commands

Use `mise` for all development tasks:

```bash
mise run dev        # Start dev mode
mise run build      # Build for distribution
mise run test       # Run tests
mise run smoke-test # Run smoke tests
mise run quality    # All quality checks (lint + format + type-check)
mise run lint       # ESLint only
mise run format     # Prettier only
mise run type-check # TypeScript only
```

For pretty-printed logs in dev: `mise run dev 2>&1 | npx pino-pretty`

## Project Structure

```
src/
├── main.ts              # Electron main process, tray setup
├── tray-menu.ts         # Tray menu template building (testable, no Electron deps)
├── preload/             # Secure IPC bridges (contextBridge)
│   ├── preload.ts       # Main preload for settings, onboarding, main window
│   └── popup.ts         # Popup-specific preload (popupAPI)
├── renderer.tsx         # React entry point (main window)
├── App.tsx              # Main React component
├── popup/               # Text input popup UI (React)
├── settings/            # Settings window UI (React, components/)
├── onboarding/          # First-run onboarding wizard UI (React)
├── services/            # Core services (logger, notifications, websocket, registry, message-delivery, hotkey-manager, input-state, audio-capture, config-manager, credential-manager, stt-service, stt-pipeline)
├── renderer/            # Renderer-side modules (audio-capture)
├── windows/             # Window management (text-input-popup, settings-window, onboarding-window)
├── ipc/                 # IPC handlers for main/renderer communication
└── types/               # TypeScript type definitions
```

## Architecture Rules

- All service initialization happens inside `app.whenReady()` (required for pino worker threads)
- Services follow singleton pattern: `initializeX()` creates, `getX()` retrieves
- IPC between main/renderer uses contextBridge in preload.ts
- WebSocket server binds to localhost only (127.0.0.1:9473) for security

## Conventions

### Always

- Use `npm install <package>` for dependencies (not manual package.json edits)
- Run `mise run quality` before committing
- Follow existing patterns in adjacent code

### Ask First

- Adding new runtime dependencies
- Changing IPC channel contracts
- Modifying WebSocket message protocols
- Changes to the registration system

### Never

- Expose IPC handlers without contextBridge
- Bind WebSocket server to non-localhost addresses
- Log sensitive data (logger auto-redacts apiKey, password, token, secret, auth, credential, bearer)

## Detailed Documentation

- [Logging System](docs/logging.md) - pino-based logging, privacy redaction, file rotation
- [Notification System](docs/notifications.md) - queue, rate limiting, coalescing
- [WebSocket Server](docs/websocket-server.md) - plugin connections, heartbeat, events
- [Client Registration](docs/client-registration.md) - protocol, validation, registry API
- [Client Status IPC](docs/client-status.md) - renderer API, tray menu integration, status events
- [Message Delivery](docs/message-delivery.md) - routing messages to clients, response handling
- [Global Hotkey System](docs/global-hotkey-system.md) - hotkey registration, input state machine, IPC events
- [Text Input Popup](docs/text-input-popup.md) - Spotlight-style text input window, IPC integration
- [Voice Recording Service](docs/voice-recording-service.md) - microphone capture, WAV encoding, hotkey integration
- [Tray Input Integration](docs/tray-input-integration.md) - tray menu input controls, icon state indication
- [Configuration System](docs/configuration-system.md) - persistent config storage, IPC, electron-store
- [Credential System](docs/credential-system.md) - secure credential storage, OS keychain, keytar
- [Settings Window](docs/settings-window.md) - React settings UI, tab navigation, input components
- [Onboarding System](docs/onboarding-system.md) - first-run wizard, permission requests, setup flow
- [STT Service](docs/stt-service.md) - speech-to-text service, Groq Whisper backend, backend abstraction
- [Living Spec](docs/smarthole-living-spec.md) - product vision and requirements

## IMPORTANT RULES ABOUT SPAWN SUBAGENT TASKS

- **NEVER USE HAIKU**
- **ALWAYS USE OPUS 4.5** - All of our sub-agents are performing critical pieces of work to complete a project that needs to be of high quality. In order to achieve this, we must use OPUS 4.5 for all the agents that we spawn to do the development work or any of the work surrounding the development process.
