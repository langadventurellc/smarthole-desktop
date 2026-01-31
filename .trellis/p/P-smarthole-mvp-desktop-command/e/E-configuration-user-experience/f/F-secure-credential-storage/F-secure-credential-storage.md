---
id: F-secure-credential-storage
title: Secure Credential Storage
status: done
priority: medium
parent: E-configuration-user-experience
prerequisites:
  - F-configuration-storage-ipc
affectedFiles:
  src/services/credential-manager.ts: New service implementing
    CredentialManagerService interface with keytar for OS keychain access.
    Follows singleton pattern with
    initializeCredentialManager/getCredentialManager/resetCredentialManager.
  src/services/credential-manager.test.ts: Unit tests covering singleton
    management, all CRUD operations, error handling for keytar failures, and
    type coverage for all CredentialKey variants.
  src/services/index.ts: Added export for credential-manager module.
  package.json: Added keytar dependency.
  package-lock.json: Updated lockfile with keytar and its dependencies.
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
  - "Started orchestration. Created feature branch
    feature/F-secure-credential-storage. Tasks to execute in order:
    T-install-keytar-and-implement → T-add-credential-ipc-handlers"
  - Completed T-install-keytar-and-implement. Committed as eddad86. Moving to
    T-add-credential-ipc-handlers.
  - "Auto-completed: All child tasks are complete"
  - Completed T-add-credential-ipc-handlers. Committed as 2928d32. Both tasks
    complete. Running docs-updater.
  - Feature complete. Documentation updated and committed as 592367d. All 2
    tasks implemented, reviewed, and committed.
schema: v1.0
childrenIds:
  - T-add-credential-ipc-handlers
  - T-install-keytar-and-implement
created: 2026-01-31T06:21:18.286Z
updated: 2026-01-31T06:21:18.286Z
---

# Secure Credential Storage

## Purpose

Implement OS keychain integration using `keytar` to securely store sensitive credentials (API keys). Credentials must never be stored in plain text configuration files or exposed to the renderer process.

## Deliverables

### 1. Install keytar

- Add `keytar` as a dependency via npm
- Note: keytar requires native compilation; ensure build scripts handle this

### 2. Credential Service (`src/services/credential-manager.ts`)

- Singleton pattern: `initializeCredentialManager()` / `getCredentialManager()`
- Service name constant: `"SmartHole"` for keychain entries
- Key methods:
  - `storeCredential(key: CredentialKey, value: string): Promise<void>`
  - `getCredential(key: CredentialKey): Promise<string | null>`
  - `deleteCredential(key: CredentialKey): Promise<void>`
  - `hasCredential(key: CredentialKey): Promise<boolean>`
- Credential keys enum matching config needs:
  ```typescript
  type CredentialKey = "anthropic-api-key" | "stt-api-key" | "openai-api-key" | "groq-api-key";
  ```
- Graceful fallback handling if keychain access fails
- Child logger for credential operations (logging key names, never values)

### 3. IPC Integration

- Add credential IPC channels to `src/types/ipc.ts`:
  - `CREDENTIAL_STORE` - store a credential
  - `CREDENTIAL_GET` - retrieve a credential
  - `CREDENTIAL_DELETE` - remove a credential
  - `CREDENTIAL_HAS` - check if credential exists
- Create `src/ipc/credential-handler.ts` following existing patterns
- Expose via preload bridge (store/has/delete only - get stays in main process)

### 4. Security Considerations

- Credentials retrieved only in main process, never sent to renderer in plain text
- For settings UI: use `hasCredential()` to show "configured" vs "not configured" state
- When saving credentials from settings: send to main process, store immediately
- Auto-redaction of any credential values that might hit the logger

### 5. Fallback Strategy

- If keytar fails (permissions, missing system libraries):
  - Log warning with specific error
  - Gracefully degrade (credentials unavailable)
  - Show user-facing warning via notification system
- Do NOT fall back to unencrypted file storage

### 6. Tests

- Unit tests for credential-manager (mock keytar)
- Unit tests for credential-handler

## Technical Notes

- keytar uses: macOS Keychain, Windows Credential Vault, Linux Secret Service
- Each credential stored as separate account under the service name
- Handle the async nature of all keytar operations

## Dependencies

- F-configuration-storage-ipc-implementation (for integration with config system)

## Acceptance Criteria

- [ ] keytar installed and native bindings compile
- [ ] Credential manager service follows singleton pattern
- [ ] Can store, retrieve, check, and delete credentials
- [ ] Credentials never logged or exposed to renderer
- [ ] Graceful handling of keychain access failures
- [ ] IPC bridge exposes safe credential operations
- [ ] Unit tests pass
