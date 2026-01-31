---
id: T-implement-stt-service
title: Implement STT Service Singleton
status: done
priority: high
parent: F-stt-service-core-cloud
prerequisites:
  - T-implement-groq-whisper-api
affectedFiles:
  src/services/stt-service.ts: Created main STT service singleton with
    SttServiceImpl class implementing SttService interface. Includes
    initializeSttService(), getSttService(), resetSttService() functions,
    SttServiceError class, and backend factory function that creates
    GroqSttBackend for cloud mode.
  src/services/stt-backends/index.ts: Created barrel export file for STT backends,
    exporting GroqSttBackend and GroqSttError from groq-backend.ts
  src/services/stt-service.test.ts: Created comprehensive unit tests covering
    singleton initialization, backend selection (cloud vs local), transcription
    delegation, getActiveBackend, isReady, and SttServiceError class
  src/services/index.ts: Updated to export the new stt-service module
log:
  - Implemented the STT service singleton that provides a unified transcription
    API. The service follows the existing singleton pattern (like
    credential-manager and config-manager), reads backend configuration from
    config-manager, and delegates transcription to the Groq backend when cloud
    mode is configured. The implementation includes proper error handling with
    SttServiceError class, logging with child loggers, and comprehensive unit
    tests covering initialization, singleton behavior, backend selection,
    transcription delegation, and error scenarios.
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
