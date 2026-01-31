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

## STT Pipeline

Location: `src/services/stt-pipeline.ts`

The STT Pipeline service orchestrates the complete audio-to-transcription flow, connecting the audio capture system to the STT service with state management, error handling, and event emission.

### Architecture

```
┌─────────────────┐     ┌───────────────┐     ┌───────────────┐
│  AudioCapture   │────▶│  SttPipeline  │────▶│   SttService  │
│    Service      │     │  (orchestrator)│     │   (backend)   │
└─────────────────┘     └───────┬───────┘     └───────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
             ┌───────────┐ ┌─────────┐ ┌────────────┐
             │InputState │ │  IPC    │ │Notification│
             │  Service  │ │Broadcast│ │  Service   │
             └───────────┘ └─────────┘ └────────────┘
```

### Initialization

```typescript
import { initializeSttPipeline, getSttPipeline } from "./services/stt-pipeline";

// Inside app.whenReady() after stt-service, input-state, notifications
const sttPipeline = initializeSttPipeline();

// Wire to audio capture
audioCapture.on("audioReady", (event) => {
  sttPipeline.processAudio(event.result);
});

// Listen for transcription results
sttPipeline.on("transcriptionReady", (event) => {
  // Route transcription to downstream consumers
  console.log("Transcription ready:", event.text.length, "chars");
});
```

### API

| Method                        | Description                                             |
| ----------------------------- | ------------------------------------------------------- |
| `processAudio(result)`        | Process captured audio through the pipeline             |
| `isReady(): Promise<boolean>` | Check if pipeline (and underlying STT service) is ready |
| `on(event, listener)`         | Subscribe to pipeline events                            |
| `off(event, listener)`        | Unsubscribe from pipeline events                        |

### Events

| Event                | Payload                   | Description                          |
| -------------------- | ------------------------- | ------------------------------------ |
| `transcriptionReady` | `TranscriptionReadyEvent` | Transcription completed successfully |
| `transcriptionError` | `TranscriptionErrorEvent` | Transcription failed                 |

### TranscriptionReadyEvent

```typescript
interface TranscriptionReadyEvent {
  text: string; // Transcribed text
  confidence?: number; // Confidence score (0-1) if available
  inputMethod: "voice"; // Always "voice" for STT results
  audioMetadata: {
    durationMs: number; // Original audio duration
    startedAt: string; // When recording started
    stoppedAt: string; // When recording stopped
  };
  sttMetadata: {
    backendUsed: SttBackendType; // Which backend transcribed
    processingTimeMs: number; // How long transcription took
  };
}
```

### Error Handling

The pipeline maps STT errors to user-friendly error codes and shows notifications:

| Error Code             | Notification           | Description                       |
| ---------------------- | ---------------------- | --------------------------------- |
| `NO_API_KEY`           | "STT Not Configured"   | API key missing or invalid        |
| `NETWORK_ERROR`        | "Transcription Failed" | Network connectivity issues       |
| `RATE_LIMIT`           | "Too Many Requests"    | API rate limit exceeded           |
| `EMPTY_RESULT`         | "No Speech Detected"   | Transcription returned empty text |
| `INVALID_AUDIO`        | "Audio Error"          | Audio format issues               |
| `TRANSCRIPTION_FAILED` | "Transcription Failed" | Generic transcription failure     |

### IPC Events

The pipeline broadcasts events to all renderer windows for UI feedback:

| Channel            | Direction        | Payload                   | Description             |
| ------------------ | ---------------- | ------------------------- | ----------------------- |
| `stt:transcribing` | Main -> Renderer | `{ audioId: string }`     | STT processing started  |
| `stt:result`       | Main -> Renderer | `TranscriptionReadyEvent` | Transcription completed |
| `stt:error`        | Main -> Renderer | `TranscriptionErrorEvent` | Transcription failed    |

### Renderer API

The preload script exposes these methods via `window.electronAPI`:

```typescript
// Listen for STT transcribing start
const unsub = electronAPI.onSttTranscribing((payload) => {
  console.log("STT processing audio:", payload.audioId);
});

// Listen for STT results
const unsub = electronAPI.onSttResult((result) => {
  console.log("Transcription:", result.text);
  console.log("Backend:", result.sttMetadata.backendUsed);
  console.log("Processing time:", result.sttMetadata.processingTimeMs, "ms");
});

// Listen for STT errors
const unsub = electronAPI.onSttError((error) => {
  console.log("STT error:", error.code, error.message);
});
```

### Input State Integration

The pipeline manages input state transitions during transcription:

```
IDLE → PROCESSING (on processAudio) → IDLE (on completion or error)
```

This allows the UI to show a "processing" indicator while transcription is in progress.

## Integration with Audio Capture

The STT pipeline automatically connects to the audio capture service in `main.ts`:

```typescript
import { getAudioCapture } from "./services/audio-capture";
import { getSttPipeline } from "./services/stt-pipeline";

const audioCapture = getAudioCapture();
const sttPipeline = getSttPipeline();

// Wire audio capture to STT pipeline
audioCapture.on("audioReady", (event) => {
  sttPipeline.processAudio(event.result);
});

// Listen for transcription results
sttPipeline.on("transcriptionReady", (event) => {
  // Route to downstream consumers (e.g., routing agent)
  logger.info("Transcription complete", {
    processingTimeMs: event.sttMetadata.processingTimeMs,
    audioDurationMs: event.audioMetadata.durationMs,
  });
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
mise run test src/services/stt-pipeline.test.ts
mise run test src/ipc/stt-handler.test.ts
mise run test src/types/stt.test.ts
```

Tests cover:

- Singleton initialization and retrieval
- Backend selection based on config
- Transcription delegation to backend
- Error handling and error code mapping
- Type guards for runtime validation
- STT pipeline audio processing flow
- IPC event broadcasting to renderer windows
- Input state transitions during transcription

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
