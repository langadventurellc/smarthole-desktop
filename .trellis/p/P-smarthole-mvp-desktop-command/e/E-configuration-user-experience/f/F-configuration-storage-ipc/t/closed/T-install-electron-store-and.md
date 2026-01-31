---
id: T-install-electron-store-and
title: Install electron-store and update config schema
status: done
priority: high
parent: F-configuration-storage-ipc
prerequisites: []
affectedFiles:
  src/types/config.ts: "Added firstRunCompleted: boolean field to AppConfig
    interface and firstRunCompleted: false to DEFAULT_CONFIG"
  package.json: Added electron-store ^11.0.2 as dependency (via npm install)
  package-lock.json: Updated with electron-store and its dependencies
log:
  - >-
    Research completed:

    - Verified src/types/config.ts exists with AppConfig interface at lines
    116-151

    - Verified DEFAULT_CONFIG at lines 163-178

    - Confirmed electron-store is NOT yet in package.json dependencies

    - Ready to proceed with installation and schema updates
  - Installed electron-store package (v11.0.2) and added firstRunCompleted field
    to AppConfig interface and DEFAULT_CONFIG. All quality checks pass and all
    803 tests continue to pass.
schema: v1.0
childrenIds: []
created: 2026-01-31T06:28:16.721Z
updated: 2026-01-31T06:28:16.721Z
---

# Install electron-store and Update Config Schema

## Context

This task sets up the foundation for the configuration storage system. The `electron-store` package provides typed, persistent storage with automatic schema validation and migration support. The config type system already exists in `src/types/config.ts` but needs a new field for first-run detection.

**Parent Feature:** F-configuration-storage-ipc (Configuration Storage & IPC Implementation)

**Relevant Files:**

- `src/types/config.ts` - Contains `AppConfig` interface and `DEFAULT_CONFIG`
- `package.json` - Dependencies

## Implementation Requirements

### 1. Install electron-store

```bash
npm install electron-store
```

### 2. Add firstRunCompleted field to AppConfig

In `src/types/config.ts`:

**Update AppConfig interface** (around line 116) to add:

```typescript
/** Whether the first-run experience has been completed */
firstRunCompleted: boolean;
```

**Update DEFAULT_CONFIG** (around line 163) to add:

```typescript
firstRunCompleted: false,
```

## Technical Notes

- `electron-store` handles platform-specific storage paths automatically
- The package supports TypeScript generics for type-safe stores
- Adding fields to existing config is safe - electron-store merges with defaults

## Acceptance Criteria

- [ ] `electron-store` is installed as a dependency (verify in `package.json`)
- [ ] `firstRunCompleted: boolean` field added to `AppConfig` interface
- [ ] `firstRunCompleted: false` added to `DEFAULT_CONFIG`
- [ ] `mise run quality` passes (no type errors)

## Out of Scope

- Creating the config manager service (separate task)
- IPC handlers (separate task)
- Unit tests for the schema changes (schema is declarative, tests not needed)
