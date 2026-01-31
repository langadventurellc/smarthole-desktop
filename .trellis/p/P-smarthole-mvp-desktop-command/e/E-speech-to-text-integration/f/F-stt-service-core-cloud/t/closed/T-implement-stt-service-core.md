---
id: T-implement-stt-service-core
title: Implement STT Service Core Types and Interface
status: done
priority: high
parent: F-stt-service-core-cloud
prerequisites: []
affectedFiles:
  src/types/stt.ts: Created new file with SttCloudProvider type, SttResult
    interface, ISttBackend interface, SttService interface, and type guards
    (isSttBackendType, isSttCloudProvider, isSttResult)
  src/types/index.ts: Added export for the new stt.ts module
log:
  - >-
    Research phase completed:

    - Verified AudioBuffer exists in src/types/audio.ts

    - Verified SttBackend type exists in src/types/config.ts as "local" |
    "cloud"

    - Verified STT error codes exist in src/types/errors.ts

    - Reviewed type patterns: const assertions, ReadonlySet for type guards,
    JSDoc comments


    Starting implementation of src/types/stt.ts
  - >-
    Implemented STT service core types and interfaces for the speech-to-text
    abstraction layer.


    Created types:

    - SttCloudProvider: Type for cloud backend selection ("groq" | "openai")

    - SttResult: Interface with text, optional confidence (0-1), durationMs, and
    backendUsed

    - ISttBackend: Interface for backend implementations with name,
    transcribe(), isAvailable()

    - SttService: Main service interface with transcribe(), getActiveBackend(),
    isReady()


    Type guards added:

    - isSttBackendType(): Validates backend type values

    - isSttCloudProvider(): Validates cloud provider values

    - isSttResult(): Validates SttResult objects


    Note: The backend interface was named ISttBackend to avoid conflict with the
    existing SttBackend type in config.ts (which defines the "local" | "cloud"
    union type). The SttBackend type from config.ts is imported as
    SttBackendType for use within the STT types.


    All quality checks pass and all 991 existing tests continue to pass.
  - >-
    Addressed review findings:


    1. Gap: Missing test file - Created src/types/stt.test.ts with 28 unit tests
    following patterns from config.test.ts
       - Tests for isSttCloudProvider type guard
       - Tests for isSttBackendType type guard (re-exported)
       - Tests for isSttResult type guard (comprehensive validation)
       - Tests for ISttBackend and SttService interface structure
       - Type-level constraint tests

    2. Recommendation: Removed duplicate isSttBackendType validation logic
       - Now re-exports isSttBackend from config.ts as isSttBackendType
       - Uses isSttBackend directly in isSttResult function
       - Maintains single source of truth for backend type validation

    All quality checks pass. All 1019 tests pass (including 28 new tests).
schema: v1.0
childrenIds: []
created: 2026-01-31T19:19:18.374Z
updated: 2026-01-31T19:19:18.374Z
---

# STT Service Core Types and Interface

## Purpose

Define the TypeScript interfaces and types for the STT service abstraction layer. This provides the foundational contract that all STT backends will implement.

## Files to Create/Modify

### Create: `src/types/stt.ts`

Define the core STT types:

```typescript
// STT result returned by all backends
interface SttResult {
  text: string; // Transcribed text
  confidence?: number; // Confidence score (0-1) if available
  durationMs: number; // Audio duration processed
  backendUsed: SttBackendType; // Which backend was used
}

// Backend type enum matching existing config types
type SttBackendType = "local" | "cloud";

// Cloud provider for automatic selection
type SttCloudProvider = "openai" | "groq";

// Backend interface all implementations must follow
interface SttBackend {
  name: SttBackendType;
  transcribe(audio: AudioBuffer): Promise<SttResult>;
  isAvailable(): Promise<boolean>;
}

// Main service interface
interface SttService {
  transcribe(audio: AudioBuffer): Promise<SttResult>;
  getActiveBackend(): SttBackendType;
  isReady(): Promise<boolean>;
}
```

### Modify: `src/types/index.ts`

Export the new STT types.

## Technical Notes

- `AudioBuffer` type already exists in `src/types/audio.ts`
- `SttBackend` type already exists in `src/types/config.ts` (matches `SttBackendType`)
- Error codes `STT_INITIALIZATION_FAILED` and `STT_TRANSCRIPTION_FAILED` already exist in `src/types/errors.ts`

## Acceptance Criteria

1. [ ] `SttResult` interface defined with text, optional confidence, durationMs, backendUsed
2. [ ] `SttBackend` interface defined with name, transcribe(), isAvailable()
3. [ ] `SttService` interface defined with transcribe(), getActiveBackend(), isReady()
4. [ ] `SttCloudProvider` type defined for cloud backend selection
5. [ ] Types exported from `src/types/index.ts`
6. [ ] Type guards added for runtime validation where needed
