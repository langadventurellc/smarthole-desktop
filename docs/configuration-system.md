# Configuration System

Persistent configuration storage and IPC for SmartHole settings.

## Overview

The configuration system provides persistent storage of user settings using `electron-store`, with IPC handlers for renderer process access. Configuration changes are validated before persisting and broadcast to all windows.

## Architecture

```
Renderer Process                    Main Process
      |                                  |
      |-- config:get ------------------>| ConfigManager
      |<-- AppConfig -------------------|     |
      |                                  |     v
      |-- config:set { updates } ------>| electron-store
      |                                  |     |
      |<-- config:changed --------------|<----'
```

## Configuration Schema

The `AppConfig` interface in `src/types/config.ts` defines all settings:

| Field                  | Type                           | Default                          | Description                |
| ---------------------- | ------------------------------ | -------------------------------- | -------------------------- |
| `hotkey.voiceInput`    | string                         | `"CommandOrControl+Shift+Space"` | Voice input hotkey         |
| `hotkey.textInput`     | string?                        | -                                | Optional text input hotkey |
| `voiceInputMode`       | `"push-to-talk"` \| `"toggle"` | `"push-to-talk"`                 | Voice recording behavior   |
| `stt.backend`          | `"local"` \| `"cloud"`         | `"cloud"`                        | STT provider               |
| `stt.apiKey`           | string?                        | -                                | Cloud STT API key          |
| `stt.localWhisperPath` | string?                        | -                                | Local Whisper binary path  |
| `llm.provider`         | `"anthropic"`                  | `"anthropic"`                    | LLM provider               |
| `llm.apiKey`           | string?                        | -                                | LLM API key                |
| `llm.model`            | string                         | `"claude-3-haiku-20240307"`      | Model identifier           |
| `logLevel`             | LogLevel                       | `"info"`                         | Minimum log level          |
| `logMessageContent`    | boolean                        | `false`                          | Log full message text      |
| `websocketPort`        | number                         | `9473`                           | WebSocket server port      |
| `firstRunCompleted`    | boolean                        | `false`                          | First-run wizard completed |

## ConfigManager Service

Singleton service managing configuration persistence.

### Initialization

```typescript
import { initializeConfigManager, getConfigManager } from "./services/config-manager";

// Inside app.whenReady()
initializeConfigManager();

// Later retrieval
const config = getConfigManager().getConfig();
```

### API

| Method                                           | Description                                        |
| ------------------------------------------------ | -------------------------------------------------- |
| `getConfig(): AppConfig`                         | Returns the current configuration                  |
| `setConfig(updates: PartialAppConfig): string[]` | Applies partial updates, returns changed key paths |
| `on("configChanged", listener)`                  | Subscribe to config changes                        |
| `off("configChanged", listener)`                 | Unsubscribe from changes                           |
| `reset()`                                        | Reset to defaults and clear listeners              |

### Changed Key Paths

`setConfig()` returns an array of dot-notation paths that actually changed:

```typescript
const changedKeys = configManager.setConfig({
  logLevel: "debug",
  stt: { backend: "local" },
});
// changedKeys: ["logLevel", "stt.backend"]
```

### Validation

Updates are validated before persisting. Invalid values throw `ConfigValidationError`:

```typescript
try {
  configManager.setConfig({ logLevel: "invalid" });
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error(`Invalid ${error.field}: ${error.value}`);
  }
}
```

## IPC Channels

| Channel          | Direction        | Description                    |
| ---------------- | ---------------- | ------------------------------ |
| `config:get`     | Renderer -> Main | Get current configuration      |
| `config:set`     | Renderer -> Main | Update configuration (partial) |
| `config:changed` | Main -> Renderer | Broadcast when config changes  |

### Renderer Usage (via preload bridge)

```typescript
// Get current config
const { config } = await window.electronAPI.getConfig();

// Update config
await window.electronAPI.setConfig({ logLevel: "debug" });

// Listen for changes
window.electronAPI.onConfigChanged((payload) => {
  console.log("Config changed:", payload.changedKeys);
  console.log("New config:", payload.config);
});
```

### Payload Types

```typescript
// config:get response
interface ConfigGetResponse {
  config: AppConfig;
}

// config:set payload
interface ConfigSetPayload {
  updates: PartialAppConfig;
}

// config:changed broadcast
interface ConfigChangedPayload {
  config: AppConfig;
  changedKeys: string[]; // e.g., ["stt.backend", "logLevel"]
}
```

## Storage Location

`electron-store` handles platform-specific paths automatically:

| Platform | Location                                                                |
| -------- | ----------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/smarthole-desktop/smarthole-config.json` |
| Windows  | `%APPDATA%/smarthole-desktop/smarthole-config.json`                     |
| Linux    | `~/.config/smarthole-desktop/smarthole-config.json`                     |

## Security Notes

- API keys in config are placeholders for secure storage (future: keychain integration)
- Logger auto-redacts sensitive fields (apiKey, password, token, secret, auth, credential, bearer)
- Config file should not be committed to version control

## Testing

Unit tests cover:

- Singleton initialization behavior
- Get/set operations with deep merge
- Changed key path tracking
- Validation error handling
- Event emission
- Reset functionality

Run tests:

```bash
mise run test src/services/config-manager.test.ts
mise run test src/ipc/config-handler.test.ts
```
