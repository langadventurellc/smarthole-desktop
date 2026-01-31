---
id: T-add-credential-ipc-handlers
title: Add credential IPC handlers and preload bridge
status: done
priority: medium
parent: F-secure-credential-storage
prerequisites:
  - T-install-keytar-and-implement
affectedFiles:
  src/types/ipc.ts: Added CREDENTIAL_STORE, CREDENTIAL_DELETE, CREDENTIAL_HAS
    channels. Added CredentialStorePayload and CredentialKeyPayload types. Added
    entries to IpcPayloadMap and IpcResponseMap. Re-exported CredentialKey type.
  src/ipc/credential-handler.ts: New file implementing
    createCredentialStoreHandler, createCredentialDeleteHandler, and
    createCredentialHasHandler factory functions following existing patterns.
  src/ipc/credential-handler.test.ts: New test file with 13 tests covering all
    three handlers, error propagation, and credential key type coverage.
  src/preload/main.ts: Extended electronAPI with storeCredential,
    deleteCredential, and hasCredential methods using ipcRenderer.invoke.
  src/main.ts: Added credential manager imports, state object, initialization
    after config manager, and registered IPC handlers with child logger.
  src/types/ipc.test.ts: Added test for credential channels and updated channel count from 32 to 35.
log:
  - >-
    Research completed:

    - Reviewed ipc.ts for IPC channel patterns (IPC_CHANNELS, IpcPayloadMap,
    IpcResponseMap)

    - Reviewed config-handler.ts for handler patterns (factory functions with
    getService and logger)

    - Reviewed main.ts for registration patterns (ipcMain.handle with child
    logger)

    - Reviewed preload/main.ts for bridge patterns (ipcRenderer.invoke with
    typed returns)

    - Reviewed credential-manager.ts for CredentialKey type and service
    interface

    - Reviewed config-handler.test.ts for test patterns (mocking service,
    logger, Electron.IpcMainInvokeEvent)


    Now implementing:

    1. IPC channels in types/ipc.ts

    2. credential-handler.ts

    3. preload bridge extensions

    4. main.ts handler registration

    5. Unit tests
  - Implemented credential IPC handlers and preload bridge for secure credential
    operations. Added three new IPC channels (CREDENTIAL_STORE,
    CREDENTIAL_DELETE, CREDENTIAL_HAS) following the existing patterns. The
    getCredential operation is intentionally NOT exposed to the renderer -
    credentials are only retrieved in the main process for security. The preload
    bridge exposes storeCredential, deleteCredential, and hasCredential methods.
    All handlers follow the existing factory function pattern with proper
    logging and error propagation. Unit tests cover all handlers with mocked
    credential manager service.
schema: v1.0
childrenIds: []
created: 2026-01-31T09:06:41.224Z
updated: 2026-01-31T09:06:41.224Z
---

# Add credential IPC handlers and preload bridge

## Overview

Expose secure credential operations to the renderer process via IPC. Only safe operations are exposed - `getCredential` stays in main process only.

## Deliverables

### 1. Add IPC Channels to `src/types/ipc.ts`

Add to `IPC_CHANNELS`:

```typescript
// Credential channels
CREDENTIAL_STORE: "credential:store",
CREDENTIAL_DELETE: "credential:delete",
CREDENTIAL_HAS: "credential:has",
```

Add payload types:

```typescript
export interface CredentialStorePayload {
  key: CredentialKey;
  value: string;
}

export interface CredentialKeyPayload {
  key: CredentialKey;
}
```

Add to `IpcPayloadMap` and `IpcResponseMap`.

Note: No `CREDENTIAL_GET` channel - credentials are never sent to renderer in plain text.

### 2. Create `src/ipc/credential-handler.ts`

Follow the existing handler pattern (see `config-handler.ts`):

```typescript
export function createCredentialStoreHandler(
  getCredentialManager: () => CredentialManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, payload: CredentialStorePayload) => Promise<void>;

export function createCredentialDeleteHandler(
  getCredentialManager: () => CredentialManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, payload: CredentialKeyPayload) => Promise<void>;

export function createCredentialHasHandler(
  getCredentialManager: () => CredentialManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, payload: CredentialKeyPayload) => Promise<boolean>;
```

### 3. Extend Preload Bridge in `src/preload/main.ts`

Add to `electronAPI`:

```typescript
// Credentials (safe operations only - get stays in main process)
storeCredential: (key: CredentialKey, value: string): Promise<void> => {
  return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIAL_STORE, { key, value });
},

deleteCredential: (key: CredentialKey): Promise<void> => {
  return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIAL_DELETE, { key });
},

hasCredential: (key: CredentialKey): Promise<boolean> => {
  return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIAL_HAS, { key });
},
```

### 4. Register Handlers in `main.ts`

Following existing patterns:

- Initialize credential manager after config manager
- Create child logger: `logger.child({ component: "CredentialIPC" })`
- Register handlers with `ipcMain.handle()`

### 5. Unit Tests

Create `src/ipc/credential-handler.test.ts`:

- Test each handler function
- Mock credential manager service
- Test error propagation

## Security Considerations

- `getCredential` is intentionally NOT exposed to renderer
- Settings UI uses `hasCredential()` to show configured state
- Credentials sent from settings are stored immediately via `storeCredential`

## Acceptance Criteria

- [ ] IPC channels defined for store/delete/has (not get)
- [ ] Handlers follow existing patterns
- [ ] Preload bridge exposes only safe operations
- [ ] Handlers registered in main.ts
- [ ] Unit tests pass
