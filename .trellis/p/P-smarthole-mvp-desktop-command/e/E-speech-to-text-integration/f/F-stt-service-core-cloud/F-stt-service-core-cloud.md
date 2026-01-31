---
id: F-stt-service-core-cloud
title: STT Service Core & Cloud Backends
status: open
priority: high
parent: E-speech-to-text-integration
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T19:14:34.757Z
updated: 2026-01-31T19:14:34.757Z
---

# STT Service Core & Cloud Backends

## Purpose

Implement the core speech-to-text service abstraction with pluggable backends, along with the two cloud-based STT providers (OpenAI Whisper API and Groq). This provides the foundational STT capability that most users will use out-of-the-box.

## Key Components

### 1. STT Service Interface (`src/services/stt-service.ts`)

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
  isAvailable(): Promise<boolean>; // Check if backend is configured/reachable
}

interface SttService {
  transcribe(audio: AudioBuffer): Promise<SttResult>;
  getActiveBackend(): SttBackendType;
  isReady(): Promise<boolean>;
}
```

### 2. OpenAI Whisper API Backend

- Use the `openai` npm package for API calls
- Retrieve API key from credential manager (`openai-api-key`)
- Support Whisper model selection (default: `whisper-1`)
- Convert WAV audio buffer to blob/file for upload
- Handle API errors: rate limits, auth failures, network errors
- Parse response and extract transcription text

### 3. Groq Whisper API Backend

- Use the `groq-sdk` npm package for API calls
- Retrieve API key from credential manager (`groq-api-key`)
- Similar interface to OpenAI but with Groq-specific model IDs
- Handle Groq-specific error responses

### 4. Backend Selection Logic

- Read `stt.backend` from config manager to determine which backend to use
- For cloud backend, check which API key is available:
  - If `openai-api-key` exists, use OpenAI
  - If `groq-api-key` exists, use Groq
  - If both exist, prefer OpenAI (or make configurable later)
- Throw appropriate errors if no API key is configured

### 5. Credential Key Migration Note

**IMPORTANT**: The existing onboarding UI (`SttStep.tsx`) stores a generic `stt-api-key` credential. This implementation should:

1. Check for `openai-api-key` and `groq-api-key` first (provider-specific)
2. Fall back to checking `stt-api-key` for backwards compatibility (treat as OpenAI key)
3. Update onboarding UI to use provider-specific keys when cloud STT is enhanced to support provider selection

For MVP, the cloud backend selection is automatic based on which API key exists. A future enhancement could add explicit cloud provider selection in settings.

## Technical Requirements

- Follow singleton pattern consistent with other services: `initializeSttService()`, `getSttService()`
- Must be initialized inside `app.whenReady()` after logger and config manager
- Use structured logging with `component: "SttService"` child logger
- Emit events for transcription completion and errors
- Handle network timeouts gracefully (recommend 30s timeout for API calls)
- Privacy-aware logging: never log raw audio data or full transcription text unless `logMessageContent` is enabled

## Dependencies

- Existing: `config-manager`, `credential-manager`, `logger`
- New npm packages: `openai`, `groq-sdk`

## Acceptance Criteria

1. [ ] `SttService` interface defined with `transcribe()`, `getActiveBackend()`, `isReady()` methods
2. [ ] `SttResult` type includes text, optional confidence, duration, and backend used
3. [ ] OpenAI Whisper backend transcribes WAV audio via API
4. [ ] Groq Whisper backend transcribes WAV audio via API
5. [ ] Backend selection based on config and available API keys
6. [ ] API keys retrieved from credential manager (never hardcoded)
7. [ ] Backwards-compatible with existing `stt-api-key` credential from onboarding
8. [ ] Errors mapped to appropriate `ErrorCode` values (STT_INITIALIZATION_FAILED, STT_TRANSCRIPTION_FAILED)
9. [ ] Unit tests for service initialization and backend selection
10. [ ] Integration tests for API calls (can be mocked)

## Testing Requirements

- Unit tests for:
  - Backend selection logic based on config
  - API key availability checks (including fallback to `stt-api-key`)
  - Error mapping and handling
- Mock-based tests for:
  - OpenAI API responses (success, auth error, rate limit, network error)
  - Groq API responses (success, auth error, network error)
- Test audio buffer validation

## Security Considerations

- API keys must only come from credential manager, never from config
- Logging must never include API keys (logger already redacts these)
- Audio data is sensitive - only log duration/metadata, not content

## Implementation Guidance

- Look at `credential-manager.ts` for how to retrieve credentials
- Look at `audio-capture.ts` for the `AudioBuffer` type being passed in
- Follow patterns from existing services for singleton initialization
- The OpenAI SDK expects audio as a File-like object; may need to create a Blob from ArrayBuffer
