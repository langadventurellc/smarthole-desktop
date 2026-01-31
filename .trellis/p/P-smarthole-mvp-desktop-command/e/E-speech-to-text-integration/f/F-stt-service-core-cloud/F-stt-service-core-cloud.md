---
id: F-stt-service-core-cloud
title: STT Service Core & Groq Backend
status: in-progress
priority: high
parent: E-speech-to-text-integration
prerequisites: []
affectedFiles:
  src/types/stt.ts: Created new file with SttCloudProvider type, SttResult
    interface, ISttBackend interface, SttService interface, and type guards
    (isSttBackendType, isSttCloudProvider, isSttResult)
  src/types/index.ts: Added export for the new stt.ts module
log: []
schema: v1.0
childrenIds:
  - T-implement-groq-whisper-api
  - T-implement-stt-service-core
  - T-implement-stt-service
created: 2026-01-31T19:14:34.757Z
updated: 2026-01-31T19:14:34.757Z
---

# STT Service Core & Groq Backend

## Purpose

Implement the core speech-to-text service abstraction with Groq as the cloud STT provider for MVP. The interface is designed for extensibility to support additional providers (local Whisper, other cloud APIs) in the future.

## Key Components

### 1. STT Service Interface (`src/types/stt.ts`)

Create a common interface for all STT backends:

```typescript
interface SttResult {
  text: string; // Transcribed text
  confidence?: number; // Confidence score (0-1) if available
  durationMs: number; // Audio duration processed
  backendUsed: SttBackendType; // Which backend was used
}

interface SttBackend {
  name: SttBackendType;
  transcribe(audio: AudioBuffer): Promise<SttResult>;
  isAvailable(): Promise<boolean>;
}

interface SttService {
  transcribe(audio: AudioBuffer): Promise<SttResult>;
  getActiveBackend(): SttBackendType;
  isReady(): Promise<boolean>;
}
```

### 2. Groq Whisper API Backend

- Use the `groq-sdk` npm package for API calls
- Retrieve API key from credential manager (`stt-api-key`)
- Use `whisper-large-v3` model
- Convert WAV audio buffer to File for upload
- Handle API errors: rate limits, auth failures, network errors

### 3. Backend Selection Logic (MVP)

- Read `stt.backend` from config manager
- If "cloud" → use Groq backend
- If "local" → throw error (not implemented in this feature)
- Future: add config for cloud provider selection when multiple are supported

## Technical Requirements

- Follow singleton pattern: `initializeSttService()`, `getSttService()`
- Must be initialized inside `app.whenReady()` after logger and config manager
- Use structured logging with component child loggers
- Handle network timeouts gracefully (30s timeout for API calls)
- Privacy-aware logging: never log raw audio data or full transcription text

## Dependencies

- Existing: `config-manager`, `credential-manager`, `logger`
- New npm package: `groq-sdk`

## Acceptance Criteria

1. [ ] `SttService` interface defined with `transcribe()`, `getActiveBackend()`, `isReady()` methods
2. [ ] `SttResult` type includes text, optional confidence, duration, and backend used
3. [ ] Groq Whisper backend transcribes WAV audio via API
4. [ ] API key retrieved from credential manager (`stt-api-key`)
5. [ ] Errors mapped to appropriate `ErrorCode` values
6. [ ] Unit tests for service and backend

## Extensibility Notes

The architecture supports future additions:

- **Local Whisper**: Add a local backend implementation (separate feature)
- **Additional cloud providers**: Add config for provider selection, implement new backends
- **Provider-specific credentials**: Could add `groq-api-key`, `openai-api-key` etc. with config-based selection

For MVP, keeping it simple with one cloud provider and the generic `stt-api-key` credential.
