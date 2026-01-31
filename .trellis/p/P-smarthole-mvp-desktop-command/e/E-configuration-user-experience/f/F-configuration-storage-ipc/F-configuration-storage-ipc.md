---
id: F-configuration-storage-ipc
title: Configuration Storage & IPC Implementation
status: in-progress
priority: medium
parent: E-configuration-user-experience
prerequisites: []
affectedFiles:
  src/types/config.ts: "Added firstRunCompleted: boolean field to AppConfig
    interface and firstRunCompleted: false to DEFAULT_CONFIG"
  package.json: Added electron-store ^11.0.2 as dependency (via npm install)
  package-lock.json: Updated with electron-store and its dependencies
log:
  - "Started orchestration. Created feature branch
    feature/F-configuration-storage-ipc. Tasks to execute in order:
    T-install-electron-store-and → T-implement-config-manager →
    T-implement-config-ipc-handlers"
schema: v1.0
childrenIds:
  - T-implement-config-ipc-handlers
  - T-implement-config-manager
  - T-install-electron-store-and
created: 2026-01-31T06:21:18.184Z
updated: 2026-01-31T06:21:18.184Z
---

# Configuration Storage & IPC Implementation

## Purpose

Implement the persistent configuration storage layer using `electron-store` and create the IPC handlers that connect the renderer to the configuration system. This is the foundational feature that enables all other configuration functionality.

## Context

The configuration type system is already defined in `src/types/config.ts` (AppConfig, DEFAULT_CONFIG, type guards) and the IPC channel contracts exist in `src/types/ipc.ts` (CONFIG_GET, CONFIG_SET, CONFIG_CHANGED). The preload bridge already exposes `getConfig()`, `setConfig()`, and `onConfigChanged()` stubs. This feature implements the main process side.

## Deliverables

### 1. Install electron-store

- Add `electron-store` as a dependency via npm
- Typed store matching the existing `AppConfig` interface

### 2. Update Config Schema

- Add `firstRunCompleted: boolean` to `AppConfig` in `src/types/config.ts`
- Add to `DEFAULT_CONFIG` with default value `false`
- This field is used by F-first-run-experience to detect first launch

### 3. Configuration Service (`src/services/config-manager.ts`)

- Singleton pattern following existing service conventions
- `initializeConfigManager()` / `getConfigManager()` pattern
- Platform-appropriate storage paths (handled by electron-store)
- Use existing `DEFAULT_CONFIG` from `src/types/config.ts`
- Configuration validation using existing type guards
- Schema migration support for future changes
- Child logger for config operations

### 4. IPC Handler (`src/ipc/config-handler.ts`)

- `createConfigGetHandler()` - returns current AppConfig
- `createConfigSetHandler()` - updates partial config and validates
- Emit `CONFIG_CHANGED` to renderer on updates
- Follow existing handler patterns from `client-status-handler.ts`

### 5. Main Process Integration

- Initialize config manager in `app.whenReady()` in `main.ts`
- Register IPC handlers

### 6. Tests

- Unit tests for config-manager service
- Unit tests for config-handler

## Technical Notes

- electron-store handles platform-specific paths automatically
- Store should be typed: `new Store<AppConfig>({ defaults: DEFAULT_CONFIG })`
- Config changes should be validated before persisting
- Log config operations (but redact sensitive fields - they'll be credential references)

## Dependencies

- E-foundation-core-infrastructure (logging, types, IPC patterns) - already complete

## Acceptance Criteria

- [ ] electron-store installed and configured
- [ ] `firstRunCompleted` field added to AppConfig schema
- [ ] Config manager service follows singleton pattern
- [ ] IPC handlers registered and functional
- [ ] Renderer can get/set config via preload bridge
- [ ] Config persists across app restarts
- [ ] CONFIG_CHANGED events broadcast to renderer
- [ ] Unit tests pass
