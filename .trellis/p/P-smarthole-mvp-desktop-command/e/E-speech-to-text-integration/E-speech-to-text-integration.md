---
id: E-speech-to-text-integration
title: Speech-to-Text Integration
status: in-progress
priority: high
parent: P-smarthole-mvp-desktop-command
prerequisites:
  - E-foundation-core-infrastructure
  - E-input-capture-system
affectedFiles:
  src/types/stt.ts: Created new file with SttCloudProvider type, SttResult
    interface, ISttBackend interface, SttService interface, and type guards
    (isSttBackendType, isSttCloudProvider, isSttResult)
  src/types/index.ts: Added export for the new stt.ts module
log: []
schema: v1.0
childrenIds:
  - F-local-whisper-backend
  - F-stt-pipeline-integration
  - F-stt-service-core-cloud
created: 2026-01-29T01:44:42.105Z
updated: 2026-01-29T01:44:42.105Z
---

# Speech-to-Text Integration

## Purpose and Goals

Implement speech-to-text transcription with support for multiple backends. Users can choose between local (self-hosted Whisper) for privacy and offline use, or cloud APIs (OpenAI Whisper, Groq) for simpler setup. This epic handles converting recorded audio into text that can be routed to plugins.

## Major Components and Deliverables

### 1. STT Service Abstraction

- Common interface for all STT backends
- Backend selection based on configuration
- Unified response format: transcribed text, confidence score, timing metadata
- Error handling with fallback suggestions

### 2. Cloud STT Backend (OpenAI Whisper API)

- OpenAI Whisper API integration
- Audio file upload and transcription request
- API key management (from secure storage)
- Rate limiting and retry logic
- Error handling (API errors, network failures)

### 3. Cloud STT Backend (Groq)

- Groq Whisper API integration
- Similar interface to OpenAI backend
- API key management

### 4. Local STT Backend (Whisper)

- Integration with locally-running Whisper
- Support for whisper.cpp subprocess or HTTP server
- Model path configuration (auto-detect or manual)
- Subprocess lifecycle management
- Offline operation support

### 5. Audio Processing Pipeline

- Receive audio buffer from Input Capture System
- Audio format conversion if needed (ensure Whisper-compatible format)
- Chunking for long recordings (if needed)
- Progress indication for longer transcriptions

### 6. Transcription Result Handling

- Parse and normalize backend responses
- Extract confidence scores where available
- Emit transcription events for downstream processing
- Handle partial/streaming transcriptions (future enhancement)

## Technical Considerations

- OpenAI SDK (`openai` npm package) for Whisper API
- Groq SDK or direct HTTP for Groq API
- For local Whisper: spawn subprocess or connect to HTTP endpoint
- Audio format: Whisper accepts various formats, prefer WAV or MP3
- Consider streaming transcription for faster perceived response

## Dependencies

- **E-foundation-core-infrastructure**: Logging, error handling, types
- **E-input-capture-system**: Provides recorded audio buffers

## Estimated Scale

3-4 features covering STT abstraction, cloud backends, local backend, and audio processing

## User Stories

- As a user, I can speak and have my voice transcribed to text
- As a privacy-conscious user, I can use local Whisper for offline transcription
- As a user who prefers simplicity, I can use cloud STT with just an API key
- As a user, I receive feedback if transcription fails and can fall back to text input

## Non-Functional Requirements

- Cloud STT response time < 3 seconds for typical utterances (< 30 seconds audio)
- Local STT response time depends on hardware but should provide progress feedback
- STT must handle common speech patterns, accents, and technical terminology
- Graceful degradation when STT unavailable (suggest text input)

## Acceptance Criteria

1. [ ] STT service abstraction with pluggable backends
2. [ ] OpenAI Whisper API backend implemented
3. [ ] Groq Whisper API backend implemented
4. [ ] Local Whisper backend implemented (subprocess or HTTP)
5. [ ] Backend selection based on user configuration
6. [ ] API keys retrieved from secure storage
7. [ ] Transcription returns text, confidence (if available), and metadata
8. [ ] STT failures notify user and suggest text input fallback
9. [ ] Audio format handled correctly for each backend
10. [ ] Logging captures STT requests, responses, and errors (privacy-aware)
