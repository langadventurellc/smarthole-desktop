# Speech-to-Text Service

Speech-to-text transcription service with pluggable backend support.

## Overview

The STT service provides:

- **Backend abstraction layer** allowing multiple STT providers through a common interface
- **Groq Whisper API integration** as the cloud backend for MVP
- **Credential-based authentication** using the OS keychain via credential manager
- **Privacy-aware logging** that never logs transcription text or raw audio

## Architecture

```
┌─────────────────┐     ┌───────────────┐     ┌────────────────┐
│  AudioCapture   │────▶│   SttService  │────▶│   ISttBackend  │
│    Service      │     │  (singleton)  │     │ (Groq, future) │
└─────────────────┘     └───────────────┘     └───────┬────────┘
                               │                      │
                               ▼                      ▼
                        ┌───────────────┐     ┌────────────────┐
                        │ ConfigManager │     │ CredentialMgr  │
                        │ (stt.backend) │     │ (stt-api-key)  │
                        └───────────────┘     └────────────────┘
```

The service uses a backend pattern:

1. **SttService**: Manages backend selection and provides unified transcription API
2. **ISttBackend**: Interface implemented by all backend providers
3. **GroqSttBackend**: Cloud backend using Groq's Whisper API

## SttService

Location: `src/services/stt-service.ts`

Singleton service coordinating STT backend selection and transcription.

### Initialization

```typescript
import { initializeSttService, getSttService } from "./services/stt-service";

// Inside app.whenReady() after logger, config manager, and credential manager
const sttService = await initializeSttService();

// Later retrieval
const stt = getSttService();
const result = await stt.transcribe(audioBuffer);
```

### API

| Method                                  | Description                           |
| --------------------------------------- | ------------------------------------- |
| `transcribe(audio): Promise<SttResult>` | Transcribe audio using active backend |
| `getActiveBackend(): SttBackendType`    | Get currently active backend type     |
| `isReady(): Promise<boolean>`           | Check if backend is available         |

### SttResult

```typescript
interface SttResult {
  text: string; // Transcribed text
  confidence?: number; // Confidence score (0-1) if available
  durationMs: number; // Audio duration processed
  backendUsed: SttBackendType; // "cloud" or "local"
}
```

### Error Handling

Operations throw `SttServiceError` on failure:

```typescript
import { SttServiceError } from "./services/stt-service";
import { ErrorCode } from "./types/errors";

try {
  const result = await sttService.transcribe(audio);
} catch (error) {
  if (error instanceof SttServiceError) {
    switch (error.code) {
      case ErrorCode.STT_INITIALIZATION_FAILED:
        // Backend setup failed (missing API key, invalid config)
        break;
      case ErrorCode.STT_TRANSCRIPTION_FAILED:
        // Transcription failed (network, rate limit, timeout)
        break;
    }
  }
}
```

## Backend Configuration

Backend selection is controlled via the config manager:

```typescript
// In config (stt.backend)
type SttBackend = "cloud" | "local";
```

| Backend | Description                       | Status              |
| ------- | --------------------------------- | ------------------- |
| `cloud` | Uses Groq Whisper API             | Implemented         |
| `local` | Local Whisper model (whisper.cpp) | Not yet implemented |

Attempting to use `local` backend throws `SttServiceError` with `STT_INITIALIZATION_FAILED`.

## GroqSttBackend

Location: `src/services/stt-backends/groq-backend.ts`

Cloud backend implementation using Groq's Whisper API.

### Features

- Uses `whisper-large-v3` model for high accuracy
- 30-second API timeout with graceful error handling
- Lazy client initialization (connects on first transcription)
- Error mapping for authentication, rate limits, network issues

### Credential

Requires `stt-api-key` credential stored via credential manager:

```typescript
// Store API key (from settings UI)
await credentialManager.storeCredential("stt-api-key", "gsk_...");

// Check availability
const available = await groqBackend.isAvailable();
// Returns true if stt-api-key exists in keychain
```

### Error Types

`GroqSttError` is thrown with appropriate error codes:

| Condition               | ErrorCode                   |
| ----------------------- | --------------------------- |
| Missing/invalid API key | `STT_INITIALIZATION_FAILED` |
| Rate limit exceeded     | `STT_TRANSCRIPTION_FAILED`  |
| Network timeout         | `STT_TRANSCRIPTION_FAILED`  |
| Network error           | `STT_TRANSCRIPTION_FAILED`  |
| Other failures          | `STT_TRANSCRIPTION_FAILED`  |

## Types

### ISttBackend

```typescript
interface ISttBackend {
  readonly name: SttBackendType;
  transcribe(audio: AudioBuffer): Promise<SttResult>;
  isAvailable(): Promise<boolean>;
}
```

### SttService

```typescript
interface SttService {
  transcribe(audio: AudioBuffer): Promise<SttResult>;
  getActiveBackend(): SttBackendType;
  isReady(): Promise<boolean>;
}
```

### SttCloudProvider

```typescript
// For future multi-provider cloud support
type SttCloudProvider = "groq" | "openai";
```

## Integration with Audio Capture

The STT service is designed to receive audio from the audio capture service:

```typescript
import { getAudioCapture } from "./services/audio-capture";
import { getSttService } from "./services/stt-service";

const audioCapture = getAudioCapture();
const sttService = getSttService();

audioCapture.on("audioReady", async (event) => {
  try {
    const result = await sttService.transcribe(event.result.audio);
    console.log("Transcription:", result.text);
  } catch (error) {
    console.error("STT failed:", error);
  }
});
```

## Privacy Design

The STT service follows strict privacy guidelines:

1. **No transcription logging**: Transcribed text is never written to logs
2. **No audio logging**: Raw audio data is never logged
3. **Metadata only**: Logs include only duration, backend type, processing time
4. **Credential redaction**: Logger auto-redacts any API keys that might be logged

Example log output:

```json
{
  "level": "info",
  "component": "SttService",
  "msg": "Transcription completed",
  "processingDurationMs": 1234,
  "audioDurationMs": 5000,
  "backend": "cloud"
}
```

## Testing

Run tests:

```bash
mise run test src/services/stt-service.test.ts
mise run test src/services/stt-backends/groq-backend.test.ts
mise run test src/types/stt.test.ts
```

Tests cover:

- Singleton initialization and retrieval
- Backend selection based on config
- Transcription delegation to backend
- Error handling and error code mapping
- Type guards for runtime validation

## Dependencies

- **groq-sdk**: Official Groq API client
- **credential-manager**: OS keychain storage for API key
- **config-manager**: Backend selection configuration
- **logger**: Structured logging with privacy redaction

## Future Extensibility

The architecture supports future additions:

- **Local Whisper**: Add `LocalSttBackend` implementing `ISttBackend`
- **Multiple cloud providers**: Use `SttCloudProvider` type with config-based selection
- **Provider-specific credentials**: Add `groq-api-key`, `openai-api-key` with config mapping
