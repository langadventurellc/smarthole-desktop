---
id: T-implement-config-manager
title: Implement config manager service with electron-store
status: open
priority: high
parent: F-configuration-storage-ipc
prerequisites:
  - T-install-electron-store-and
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T06:28:36.506Z
updated: 2026-01-31T06:28:36.506Z
---

# Implement Config Manager Service

## Context

Create the configuration manager service that wraps `electron-store` and provides a typed interface for configuration storage. This service follows the singleton pattern used by other services in the codebase (see `src/services/input-state.ts` for the pattern).

**Parent Feature:** F-configuration-storage-ipc (Configuration Storage & IPC Implementation)

**Reference Files:**

- `src/services/input-state.ts` - Singleton pattern reference
- `src/services/logger.ts` - Child logger pattern
- `src/types/config.ts` - `AppConfig`, `PartialAppConfig`, `DEFAULT_CONFIG`, type guards

## Implementation Requirements

### Create `src/services/config-manager.ts`

The service should provide:

1. **Singleton Management**
   - `initializeConfigManager()` - Creates the singleton instance
   - `getConfigManager()` - Returns the instance (throws if not initialized)
   - `resetConfigManager()` - Resets for testing

2. **ConfigManagerService Interface**

   ```typescript
   interface ConfigManagerService {
     /** Get the current full configuration */
     getConfig(): AppConfig;

     /** Update configuration with partial values, returns changed key paths */
     setConfig(updates: PartialAppConfig): string[];

     /** Subscribe to configuration changes */
     on(event: "configChanged", listener: (config: AppConfig, changedKeys: string[]) => void): void;

     /** Unsubscribe from configuration changes */
     off(
       event: "configChanged",
       listener: (config: AppConfig, changedKeys: string[]) => void
     ): void;

     /** Reset to defaults (primarily for testing) */
     reset(): void;
   }
   ```

3. **Implementation Details**
   - Use `electron-store` typed with `AppConfig`: `new Store<AppConfig>({ defaults: DEFAULT_CONFIG })`
   - Validate updates using existing type guards before persisting
   - Deep merge partial config updates (electron-store handles this)
   - Emit 'configChanged' event after successful updates
   - Use child logger: `getLogger().child({ component: 'ConfigManager' })`
   - Log config operations but ensure sensitive fields are redacted (logger already handles apiKey, password, token, secret)

4. **Changed Keys Tracking**
   - When `setConfig` is called, track which dot-notation paths changed
   - Example: `setConfig({ stt: { backend: 'local' } })` → changedKeys: `['stt.backend']`
   - This is used by IPC to tell the renderer which settings changed

### Unit Tests `src/services/config-manager.test.ts`

Test coverage should include:

- Singleton initialization pattern
- Getting default config
- Setting partial config updates
- Deep merge behavior for nested objects
- Changed keys tracking (returns correct dot-notation paths)
- Event emission on config changes
- Validation rejects invalid values (if type guards are used)
- Reset functionality

## Technical Notes

- electron-store automatically handles:
  - Platform-appropriate storage paths (`~/Library/Application Support/` on macOS, `%APPDATA%` on Windows)
  - Atomic writes (crash-safe)
  - Schema validation when configured
- The store persists automatically - no explicit save needed
- For changed keys, you can compare before/after config objects or track what was passed to setConfig

## Acceptance Criteria

- [ ] `src/services/config-manager.ts` created following singleton pattern
- [ ] Service exports `initializeConfigManager`, `getConfigManager`, `resetConfigManager`
- [ ] `getConfig()` returns full `AppConfig` from store
- [ ] `setConfig()` updates config and returns changed key paths
- [ ] Service emits 'configChanged' event with config and changedKeys
- [ ] Configuration persists across service restarts (test manually)
- [ ] Unit tests pass for all service functionality
- [ ] `mise run quality` passes

## Out of Scope

- IPC handler registration (separate task)
- Main process integration (separate task)
- Schema migration support (future enhancement)
