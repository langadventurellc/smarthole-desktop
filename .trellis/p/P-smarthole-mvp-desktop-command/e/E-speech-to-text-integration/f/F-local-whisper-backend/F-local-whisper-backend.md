---
id: F-local-whisper-backend
title: Local Whisper Backend
status: wont-do
priority: high
parent: E-speech-to-text-integration
prerequisites:
  - F-stt-service-core-cloud
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T19:15:08.635Z
updated: 2026-01-31T19:15:08.635Z
---

# Local Whisper Backend

## Purpose

Implement support for local/self-hosted Whisper transcription using whisper.cpp. This enables privacy-focused users to transcribe speech entirely on their machine without sending audio to cloud services. Works offline once configured.

## Key Components

### 1. Local Whisper Backend (`src/services/stt-backends/local-whisper.ts`)

Implements the `SttBackend` interface for local Whisper:

```typescript
interface LocalWhisperBackend extends SttBackend {
  name: "local";
  transcribe(audio: AudioBuffer): Promise<SttResult>;
  isAvailable(): Promise<boolean>;
}
```

### 2. Whisper.cpp Integration Strategy

Support two modes of local Whisper operation:

**Option A: HTTP Server Mode (Recommended for MVP)**

- Connect to a locally-running whisper.cpp server (e.g., `whisper-server`)
- Default endpoint: `http://127.0.0.1:8080/inference`
- User configures server URL in settings
- Simpler integration - just HTTP POST with audio file
- Server lifecycle managed by user (not SmartHole's responsibility)

**Option B: Subprocess Mode (Future Enhancement)**

- Spawn whisper.cpp CLI as a subprocess
- Pass audio file path as argument
- Parse stdout for transcription result
- Requires managing subprocess lifecycle

**For MVP, implement HTTP Server Mode only.** Document subprocess mode as future enhancement.

### 3. Configuration

Extend `SttConfig` type if needed:

```typescript
interface SttConfig {
  backend: SttBackend;
  localWhisperPath?: string; // Path to whisper installation (for future subprocess mode)
  localWhisperServerUrl?: string; // URL for HTTP server mode (default: http://127.0.0.1:8080)
}
```

### 4. Audio File Handling

- The whisper.cpp server expects audio files (WAV, MP3, etc.)
- Convert `AudioBuffer` (ArrayBuffer) to a temporary WAV file or send as multipart form data
- Clean up temporary files after transcription

### 5. Error Handling

- Server not running → clear error message suggesting user start the server
- Connection refused → check URL configuration
- Model not loaded → server-specific error handling
- Transcription timeout → configurable timeout (longer for local, e.g., 60s)

## Technical Requirements

- Implements `SttBackend` interface from F-stt-service-core-cloud
- Register with SttService as an available backend
- Check availability by pinging the server endpoint
- Use `node-fetch` or native fetch for HTTP requests
- Timeout should be configurable (local transcription can be slow on CPU)
- Log transcription duration for performance monitoring

## Dependencies

- **F-stt-service-core-cloud**: Provides `SttBackend` interface to implement
- Existing: `config-manager`, `logger`

## Acceptance Criteria

1. [ ] LocalWhisperBackend implements `SttBackend` interface
2. [ ] HTTP server mode connects to configured whisper.cpp server URL
3. [ ] Audio buffer sent as WAV file via multipart form POST
4. [ ] Server response parsed to extract transcription text
5. [ ] `isAvailable()` returns true only when server is reachable
6. [ ] Connection errors produce helpful user-facing messages
7. [ ] Timeout is configurable (default 60s for local transcription)
8. [ ] Backend registered with SttService and selectable via config

## Testing Requirements

- Unit tests for:
  - URL configuration handling
  - Audio buffer to form-data conversion
  - Response parsing
- Mock HTTP server tests for:
  - Successful transcription
  - Server unavailable
  - Timeout handling
  - Malformed responses

## Implementation Guidance

- Reference whisper.cpp server API: https://github.com/ggerganov/whisper.cpp/tree/master/examples/server
- The server typically expects POST to `/inference` with audio file
- Response is JSON with transcription text
- Consider using `FormData` and `Blob` for file upload in Electron main process
- May need to use `node:fs` to write temp file if FormData approach doesn't work

## User Experience

- When local backend is selected but server is unreachable:
  - Show notification: "Local Whisper server not available. Please start whisper-server or switch to cloud STT."
  - Do not silently fail or hang
- First-time setup should be guided in settings/onboarding (already partially exists in SttStep.tsx)
