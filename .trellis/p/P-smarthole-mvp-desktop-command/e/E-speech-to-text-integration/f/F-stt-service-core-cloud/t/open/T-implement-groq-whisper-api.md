---
id: T-implement-groq-whisper-api
title: Implement Groq Whisper API Backend
status: open
priority: high
parent: F-stt-service-core-cloud
prerequisites:
  - T-implement-stt-service-core
affectedFiles: {}
log: []
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
