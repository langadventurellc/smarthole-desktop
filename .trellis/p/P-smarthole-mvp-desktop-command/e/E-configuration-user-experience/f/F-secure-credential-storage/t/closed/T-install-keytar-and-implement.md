---
id: T-install-keytar-and-implement
title: Install keytar and implement credential manager service
status: done
priority: medium
parent: F-secure-credential-storage
prerequisites: []
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
log:
  - >-
    Research completed. Identified patterns from:

    - config-manager.ts: Singleton pattern with initializeX(), getX(), resetX()
    functions

    - Logger integration: getLogger().child({ component: "ComponentName" })

    - Testing patterns: vi.mock for mocking dependencies, beforeEach/afterEach
    for setup/teardown

    - Service initialization order in main.ts for reference


    Starting implementation phase.
  - Implemented credential manager service with keytar for secure OS keychain
    storage. Created singleton service following existing patterns with
    store/get/delete/has operations. All credential values are never logged
    (only key names). Error handling wraps keytar failures in
    CredentialManagerError with operation context. Created comprehensive unit
    tests with mocked keytar module.
schema: v1.0
childrenIds: []
created: 2026-01-31T09:06:23.362Z
updated: 2026-01-31T09:06:23.362Z
---

# Install keytar and implement credential manager service

## Overview

Install the `keytar` native module and create a credential manager service that provides secure credential storage using the OS keychain.

## Deliverables

### 1. Install keytar

- Run `npm install keytar` to add keytar as a dependency
- Note: keytar requires native compilation; the build should handle this automatically

### 2. Create `src/services/credential-manager.ts`

Follow the singleton pattern established in the codebase:

```typescript
export function initializeCredentialManager(): CredentialManagerService;
export function getCredentialManager(): CredentialManagerService;
export function resetCredentialManager(): void;
```

**Service Interface:**

```typescript
type CredentialKey = "anthropic-api-key" | "stt-api-key" | "openai-api-key" | "groq-api-key";

interface CredentialManagerService {
  storeCredential(key: CredentialKey, value: string): Promise<void>;
  getCredential(key: CredentialKey): Promise<string | null>;
  deleteCredential(key: CredentialKey): Promise<void>;
  hasCredential(key: CredentialKey): Promise<boolean>;
}
```

**Implementation Details:**

- Use service name constant: `"SmartHole"` for keychain entries
- Each credential stored as separate account under the service name
- Create child logger: `getLogger().child({ component: "CredentialManager" })`
- Log key names, NEVER log credential values
- Handle keytar failures gracefully (see Fallback Strategy below)

### 3. Fallback Strategy

If keytar operations fail (permissions, missing system libraries):

- Log warning with specific error details
- Do NOT fall back to unencrypted file storage
- Methods should reject with descriptive errors
- Consider showing user notification for keychain access failures

### 4. Unit Tests

Create `src/services/credential-manager.test.ts`:

- Test store/get/delete/has operations
- Mock keytar module
- Test error handling for keychain failures

## Technical Notes

- keytar uses: macOS Keychain, Windows Credential Vault, Linux Secret Service
- All keytar operations are async
- Service should be initialized in `app.whenReady()` after logger is ready

## Acceptance Criteria

- [ ] keytar installed and native bindings compile
- [ ] Credential manager follows singleton pattern
- [ ] Can store, retrieve, check, and delete credentials
- [ ] Credentials never logged
- [ ] Graceful handling of keychain access failures
- [ ] Unit tests pass
