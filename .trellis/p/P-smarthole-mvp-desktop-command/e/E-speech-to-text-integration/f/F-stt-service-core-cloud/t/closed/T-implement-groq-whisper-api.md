---
id: T-implement-groq-whisper-api
title: Implement Groq Whisper API Backend
status: done
priority: high
parent: F-stt-service-core-cloud
prerequisites:
  - T-implement-stt-service-core
affectedFiles:
  src/services/stt-backends/groq-backend.ts: Created Groq Whisper API backend
    implementation with ISttBackend interface, error handling, timeout
    configuration, and privacy-aware logging
  src/services/stt-backends/groq-backend.test.ts: Created comprehensive unit tests
    for GroqSttBackend covering initialization, availability, transcription, and
    error scenarios with mock-based API testing
  package.json: Added groq-sdk dependency
  package-lock.json: Updated with groq-sdk and its dependencies
log:
  - >-
    Research phase completed:

    - Verified ISttBackend interface exists in src/types/stt.ts

    - Verified AudioBuffer type exists in src/types/audio.ts

    - Verified credential-manager uses `stt-api-key` credential key

    - Verified ErrorCode.STT_INITIALIZATION_FAILED and STT_TRANSCRIPTION_FAILED
    exist in src/types/errors.ts

    - Reviewed logging patterns: child logger with `component` binding

    - Reviewed testing patterns: vi.mock for external modules,
    beforeEach/afterEach setup


    Key findings:

    - The ISttBackend interface has: name (readonly SttBackendType),
    transcribe(audio: AudioBuffer) => Promise<SttResult>, isAvailable() =>
    Promise<boolean>

    - SttResult interface has: text, confidence?, durationMs, backendUsed

    - Credential manager uses hasCredential() and getCredential() methods

    - Need to create stt-backends directory under src/services/

    - Test file should follow patterns from credential-manager.test.ts


    Starting implementation of src/services/stt-backends/groq-backend.ts
  - >-
    Implemented Groq Whisper API backend for cloud-based speech-to-text
    transcription.


    Key implementations:

    1. Installed `groq-sdk` npm package

    2. Created `GroqSttBackend` class implementing `ISttBackend` interface

    3. API key retrieved from credential manager using `stt-api-key` credential

    4. Audio buffer correctly converted to File for Groq SDK (with proper MIME
    types for wav/pcm)

    5. Uses `whisper-large-v3` model for transcription

    6. 30-second timeout configured via Groq SDK constructor and custom timeout
    wrapper

    7. Error mapping: 401/unauthorized -> STT_INITIALIZATION_FAILED,
    429/network/timeout -> STT_TRANSCRIPTION_FAILED

    8. Logging uses child logger with `component: "SttBackend:Groq"` (no
    transcription text logged)

    9. Comprehensive unit tests covering initialization, availability check,
    transcription, and error scenarios
  - |-
    Addressed review findings - removed redundant documentation:

    1. Removed file-level docstring (lines 1-6)
    2. Removed class-level docstring for GroqSttBackend (lines 51-54)
    3. Removed transcribe() method docstring (lines 64-70)
    4. Removed isAvailable() method docstring (lines 122-127)
    5. Removed createAudioFile() private method docstring (lines 180-185)
    6. Removed callWithTimeout() private method docstring (lines 197-204)
    7. Removed mapError() private method docstring (lines 224-229)

    All quality checks pass. All 1037 tests pass.
schema: v1.0
childrenIds: []
created: 2026-01-31T19:19:43.500Z
updated: 2026-01-31T19:19:43.500Z
---

# Groq Whisper API Backend

## Purpose

Implement the Groq Whisper API backend for cloud-based speech-to-text transcription. This is the cloud STT provider for MVP.

## Files to Create

### Create: `src/services/stt-backends/groq-backend.ts`

Implement the `SttBackend` interface for Groq Whisper API:

```typescript
class GroqSttBackend implements SttBackend {
  name = "cloud" as const;

  async transcribe(audio: AudioBuffer): Promise<SttResult> {
    // 1. Get API key from credential manager (stt-api-key)
    // 2. Convert AudioBuffer to File/Blob for Groq SDK
    // 3. Call Groq Whisper API (whisper-large-v3 model)
    // 4. Return SttResult with transcription
  }

  async isAvailable(): Promise<boolean> {
    // Check if stt-api-key credential exists
  }
}
```

## Dependencies

- npm package: `groq-sdk` (install with `npm install groq-sdk`)
- Existing: `credential-manager`, `logger`

## Technical Notes

### Groq SDK Usage

```typescript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: "..." });
const transcription = await groq.audio.transcriptions.create({
  file: audioFile,
  model: "whisper-large-v3",
});
```

### API Key

- Use `stt-api-key` credential (generic cloud STT key from onboarding)
- This keeps the onboarding flow simple for MVP
- Future providers could use config-based selection

### Audio Conversion

The Groq SDK expects audio as a File-like object:

- Create a Blob from the ArrayBuffer in AudioBuffer
- Wrap as File with appropriate MIME type (audio/wav)

### Error Handling

Map API errors to appropriate error types:

- 401: Authentication error → STT_INITIALIZATION_FAILED
- 429: Rate limit → STT_TRANSCRIPTION_FAILED with retry info
- Network errors → STT_TRANSCRIPTION_FAILED

### Privacy-Aware Logging

- Log operation metadata (duration, backend) but NOT transcription text
- Never log API keys (already handled by logger redaction)

## Acceptance Criteria

1. [ ] `groq-sdk` npm package installed
2. [ ] `GroqSttBackend` class implements `SttBackend` interface
3. [ ] API key retrieved from credential manager (`stt-api-key`)
4. [ ] Audio buffer correctly converted to File for API
5. [ ] Uses `whisper-large-v3` model
6. [ ] Successful transcription returns `SttResult`
7. [ ] API errors mapped to appropriate error codes
8. [ ] Logging uses child logger with `component: "SttBackend:Groq"`
9. [ ] 30-second timeout configured for API calls
10. [ ] Unit tests for backend initialization and availability check
11. [ ] Mock-based tests for API success and error scenarios
