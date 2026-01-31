---
id: T-implement-stt-service
title: Implement STT Service Singleton
status: open
priority: high
parent: F-stt-service-core-cloud
prerequisites:
  - T-implement-groq-whisper-api
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T19:19:58.960Z
updated: 2026-01-31T19:19:58.960Z
---

# STT Service Singleton

## Purpose

Implement the main STT service as a singleton that provides the unified transcription API. For MVP, this uses the Groq backend for cloud STT.

## Files to Create

### Create: `src/services/stt-service.ts`

```typescript
class SttServiceImpl implements SttService {
  private backend: SttBackend;
  private logger: Logger;

  async transcribe(audio: AudioBuffer): Promise<SttResult> {
    // 1. Validate audio buffer
    // 2. Call backend.transcribe(audio)
    // 3. Return result
  }

  getActiveBackend(): SttBackendType {
    return this.backend.name;
  }

  async isReady(): Promise<boolean> {
    return this.backend.isAvailable();
  }
}

// Singleton management
export function initializeSttService(): Promise<SttService>;
export function getSttService(): SttService;
export function resetSttService(): void;
```

### Create: `src/services/stt-backends/index.ts`

Barrel export for backends:

```typescript
export { GroqSttBackend } from "./groq-backend";
```

## Backend Selection

For MVP, the service uses the Groq backend when `stt.backend` config is "cloud". The interface is designed for extensibility:

- Future: add local Whisper backend when `stt.backend` is "local"
- Future: add config for cloud provider selection if multiple are supported

Current logic:

1. Read `stt.backend` from config
2. If "cloud" → use GroqSttBackend
3. If "local" → throw error (not implemented yet, separate feature)
4. Verify API key exists, throw STT_INITIALIZATION_FAILED if not

## Technical Notes

### Singleton Pattern

Follow the same pattern as `credential-manager.ts` and `config-manager.ts`:

- `initializeSttService()` creates instance, must be called in `app.whenReady()`
- `getSttService()` retrieves instance, throws if not initialized
- `resetSttService()` clears instance (for testing)

### Logging

- Use child logger with `component: "SttService"`
- Log backend selection on initialization
- Log transcription duration and backend used (not text content)

## Acceptance Criteria

1. [ ] `SttServiceImpl` class implements `SttService` interface
2. [ ] Singleton pattern with `initializeSttService()`, `getSttService()`, `resetSttService()`
3. [ ] Uses Groq backend when config is "cloud"
4. [ ] Throws `STT_INITIALIZATION_FAILED` if no API key available
5. [ ] Throws appropriate error if "local" backend requested (not yet implemented)
6. [ ] `transcribe()` delegates to active backend
7. [ ] `getActiveBackend()` returns current backend type
8. [ ] `isReady()` checks backend availability
9. [ ] Logging follows conventions (component logger, no sensitive data)
10. [ ] Unit tests for service initialization
11. [ ] Unit tests for singleton behavior
