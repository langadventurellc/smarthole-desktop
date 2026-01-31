# Credential System

Secure credential storage using OS keychain integration.

## Overview

The credential system provides secure storage of sensitive credentials (API keys) using the OS-native keychain via `keytar`. Credentials are never stored in plain text configuration files and are never exposed to the renderer process.

## Architecture

```
Renderer Process                    Main Process
      |                                  |
      |-- credential:store ------------>| CredentialManager
      |                                  |     |
      |-- credential:has -------------->|     v
      |<-- boolean --------------------|   keytar
      |                                  |     |
      |-- credential:delete ----------->|     v
      |                                  | OS Keychain
      |                                  | (macOS Keychain, Windows Credential Vault,
      |                                  |  Linux Secret Service)
```

**Security Note**: `credential:get` is intentionally not exposed to the renderer. Credentials are only retrieved in the main process when needed for API calls.

## Credential Keys

The `CredentialKey` type in `src/types/credentials.ts` defines all supported credentials:

| Key                 | Description              |
| ------------------- | ------------------------ |
| `anthropic-api-key` | Anthropic Claude API key |
| `stt-api-key`       | Speech-to-text API key   |
| `openai-api-key`    | OpenAI API key           |
| `groq-api-key`      | Groq API key             |

## CredentialManager Service

Singleton service managing credential persistence in the OS keychain.

### Initialization

```typescript
import { initializeCredentialManager, getCredentialManager } from "./services/credential-manager";

// Inside app.whenReady()
initializeCredentialManager();

// Later retrieval
const credentialManager = getCredentialManager();
const apiKey = await credentialManager.getCredential("anthropic-api-key");
```

### API

| Method                                        | Description                               |
| --------------------------------------------- | ----------------------------------------- |
| `storeCredential(key, value): Promise<void>`  | Store a credential in the keychain        |
| `getCredential(key): Promise<string \| null>` | Retrieve a credential (main process only) |
| `deleteCredential(key): Promise<void>`        | Remove a credential from the keychain     |
| `hasCredential(key): Promise<boolean>`        | Check if a credential exists              |

### Error Handling

Operations throw `CredentialManagerError` on failure:

```typescript
try {
  await credentialManager.storeCredential("anthropic-api-key", apiKey);
} catch (error) {
  if (error instanceof CredentialManagerError) {
    console.error(`${error.operation} failed for ${error.key}: ${error.cause?.message}`);
  }
}
```

## IPC Channels

| Channel             | Direction        | Payload          | Response  | Description                |
| ------------------- | ---------------- | ---------------- | --------- | -------------------------- |
| `credential:store`  | Renderer -> Main | `{ key, value }` | `void`    | Store a credential         |
| `credential:has`    | Renderer -> Main | `{ key }`        | `boolean` | Check if credential exists |
| `credential:delete` | Renderer -> Main | `{ key }`        | `void`    | Delete a credential        |

### Renderer Usage (via preload bridge)

```typescript
// Store a credential
await window.electronAPI.storeCredential({
  key: "anthropic-api-key",
  value: "sk-ant-...",
});

// Check if credential exists (for UI state)
const hasKey = await window.electronAPI.hasCredential({ key: "anthropic-api-key" });

// Delete a credential
await window.electronAPI.deleteCredential({ key: "anthropic-api-key" });
```

### Payload Types

```typescript
interface CredentialStorePayload {
  key: CredentialKey;
  value: string;
}

interface CredentialKeyPayload {
  key: CredentialKey;
}
```

## Storage Location

`keytar` uses OS-native credential storage:

| Platform | Storage                              |
| -------- | ------------------------------------ |
| macOS    | Keychain Access                      |
| Windows  | Windows Credential Manager           |
| Linux    | Secret Service (GNOME Keyring, etc.) |

All credentials are stored under the service name `"SmartHole"`.

## Security Design

1. **No plain text storage**: Credentials are never written to config files or disk
2. **Main process only**: Credential values never cross the IPC boundary to the renderer
3. **UI state via existence checks**: Renderer uses `hasCredential()` to show "configured" vs "not configured"
4. **Auto-redaction**: Logger automatically redacts any credential values that might be logged
5. **No fallback**: If keychain access fails, credentials are unavailable (no unencrypted fallback)

## Integration with Configuration

The configuration system stores non-sensitive settings in `electron-store`, while sensitive credentials use the credential system:

| Data Type            | Storage        |
| -------------------- | -------------- |
| Hotkeys, preferences | electron-store |
| API keys             | OS keychain    |

Settings UI should:

- Use `hasCredential()` to display credential status
- Send new credentials to main process via `storeCredential()`
- Never request actual credential values

See [Settings Window](settings-window.md) for the React-based settings UI implementation that uses these APIs.

## Testing

Unit tests cover:

- Singleton initialization behavior
- All CRUD operations (store, get, delete, has)
- Error propagation from keytar
- Type coverage for all credential keys

Run tests:

```bash
mise run test src/services/credential-manager.test.ts
mise run test src/ipc/credential-handler.test.ts
```
