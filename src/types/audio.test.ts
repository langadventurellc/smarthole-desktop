import { describe, it, expect } from "vitest";
import {
  AudioCaptureState,
  AudioCapturePermission,
  isAudioCaptureState,
  isAudioCapturePermission,
  isAudioFormat,
  isAudioBuffer,
  isAudioCaptureResult,
  isAudioPermissionStatus,
  isAudioErrorCode,
  isAudioStateChangedEvent,
  isAudioPermissionChangedEvent,
  type AudioBuffer,
  type AudioCaptureResult,
  type AudioPermissionStatus,
  type AudioStateChangedEvent,
  type AudioPermissionChangedEvent,
} from "./audio";

describe("AudioCaptureState", () => {
  it("should have all expected state values", () => {
    expect(AudioCaptureState.IDLE).toBe("idle");
    expect(AudioCaptureState.RECORDING).toBe("recording");
    expect(AudioCaptureState.STOPPED).toBe("stopped");
    expect(AudioCaptureState.ERROR).toBe("error");
  });

  it("should have exactly 4 states", () => {
    expect(Object.keys(AudioCaptureState)).toHaveLength(4);
  });
});

describe("AudioCapturePermission", () => {
  it("should have all expected permission values", () => {
    expect(AudioCapturePermission.GRANTED).toBe("granted");
    expect(AudioCapturePermission.DENIED).toBe("denied");
    expect(AudioCapturePermission.PROMPT).toBe("prompt");
    expect(AudioCapturePermission.UNKNOWN).toBe("unknown");
  });

  it("should have exactly 4 permission states", () => {
    expect(Object.keys(AudioCapturePermission)).toHaveLength(4);
  });
});

describe("isAudioCaptureState", () => {
  it("should return true for valid states", () => {
    expect(isAudioCaptureState("idle")).toBe(true);
    expect(isAudioCaptureState("recording")).toBe(true);
    expect(isAudioCaptureState("stopped")).toBe(true);
    expect(isAudioCaptureState("error")).toBe(true);
  });

  it("should return false for invalid states", () => {
    expect(isAudioCaptureState("paused")).toBe(false);
    expect(isAudioCaptureState("IDLE")).toBe(false);
    expect(isAudioCaptureState("")).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(isAudioCaptureState(123)).toBe(false);
    expect(isAudioCaptureState(null)).toBe(false);
    expect(isAudioCaptureState(undefined)).toBe(false);
    expect(isAudioCaptureState({})).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = "recording";
    if (isAudioCaptureState(value)) {
      const _state: AudioCaptureState = value;
      expect(_state).toBe("recording");
    }
  });
});

describe("isAudioCapturePermission", () => {
  it("should return true for valid permissions", () => {
    expect(isAudioCapturePermission("granted")).toBe(true);
    expect(isAudioCapturePermission("denied")).toBe(true);
    expect(isAudioCapturePermission("prompt")).toBe(true);
    expect(isAudioCapturePermission("unknown")).toBe(true);
  });

  it("should return false for invalid permissions", () => {
    expect(isAudioCapturePermission("allowed")).toBe(false);
    expect(isAudioCapturePermission("GRANTED")).toBe(false);
    expect(isAudioCapturePermission("")).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(isAudioCapturePermission(123)).toBe(false);
    expect(isAudioCapturePermission(null)).toBe(false);
    expect(isAudioCapturePermission(undefined)).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = "granted";
    if (isAudioCapturePermission(value)) {
      const _permission: AudioCapturePermission = value;
      expect(_permission).toBe("granted");
    }
  });
});

describe("isAudioFormat", () => {
  it("should return true for valid formats", () => {
    expect(isAudioFormat("wav")).toBe(true);
    expect(isAudioFormat("pcm")).toBe(true);
  });

  it("should return false for invalid formats", () => {
    expect(isAudioFormat("mp3")).toBe(false);
    expect(isAudioFormat("ogg")).toBe(false);
    expect(isAudioFormat("WAV")).toBe(false);
    expect(isAudioFormat("")).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(isAudioFormat(123)).toBe(false);
    expect(isAudioFormat(null)).toBe(false);
  });
});

describe("isAudioBuffer", () => {
  const createValidBuffer = (): AudioBuffer => ({
    data: new ArrayBuffer(1024),
    format: "wav",
    sampleRate: 16000,
    channels: 1,
    durationMs: 1000,
  });

  it("should return true for valid audio buffers", () => {
    expect(isAudioBuffer(createValidBuffer())).toBe(true);
    expect(isAudioBuffer({ ...createValidBuffer(), format: "pcm" })).toBe(true);
    expect(isAudioBuffer({ ...createValidBuffer(), channels: 2 })).toBe(true);
  });

  it("should return false when data is not ArrayBuffer", () => {
    expect(isAudioBuffer({ ...createValidBuffer(), data: "not a buffer" })).toBe(false);
    expect(isAudioBuffer({ ...createValidBuffer(), data: [] })).toBe(false);
    expect(isAudioBuffer({ ...createValidBuffer(), data: null })).toBe(false);
  });

  it("should return false for invalid format", () => {
    expect(isAudioBuffer({ ...createValidBuffer(), format: "mp3" })).toBe(false);
  });

  it("should return false for invalid sampleRate", () => {
    expect(isAudioBuffer({ ...createValidBuffer(), sampleRate: 0 })).toBe(false);
    expect(isAudioBuffer({ ...createValidBuffer(), sampleRate: -16000 })).toBe(false);
    expect(isAudioBuffer({ ...createValidBuffer(), sampleRate: "16000" })).toBe(false);
  });

  it("should return false for invalid channels", () => {
    expect(isAudioBuffer({ ...createValidBuffer(), channels: 0 })).toBe(false);
    expect(isAudioBuffer({ ...createValidBuffer(), channels: -1 })).toBe(false);
    expect(isAudioBuffer({ ...createValidBuffer(), channels: 1.5 })).toBe(false);
  });

  it("should return false for invalid durationMs", () => {
    expect(isAudioBuffer({ ...createValidBuffer(), durationMs: -100 })).toBe(false);
    expect(isAudioBuffer({ ...createValidBuffer(), durationMs: "1000" })).toBe(false);
  });

  it("should return false for non-object values", () => {
    expect(isAudioBuffer(null)).toBe(false);
    expect(isAudioBuffer("string")).toBe(false);
    expect(isAudioBuffer(123)).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = createValidBuffer();
    if (isAudioBuffer(value)) {
      const _buffer: AudioBuffer = value;
      expect(_buffer.sampleRate).toBe(16000);
    }
  });
});

describe("isAudioCaptureResult", () => {
  const createValidResult = (): AudioCaptureResult => ({
    audio: {
      data: new ArrayBuffer(1024),
      format: "wav",
      sampleRate: 16000,
      channels: 1,
      durationMs: 1000,
    },
    startedAt: "2024-01-15T10:30:00.000Z",
    stoppedAt: "2024-01-15T10:30:01.000Z",
  });

  it("should return true for valid capture results", () => {
    expect(isAudioCaptureResult(createValidResult())).toBe(true);
  });

  it("should return false when audio is invalid", () => {
    expect(isAudioCaptureResult({ ...createValidResult(), audio: null })).toBe(false);
    expect(isAudioCaptureResult({ ...createValidResult(), audio: {} })).toBe(false);
  });

  it("should return false when timestamps are missing or invalid", () => {
    expect(isAudioCaptureResult({ ...createValidResult(), startedAt: 123 })).toBe(false);
    expect(isAudioCaptureResult({ ...createValidResult(), stoppedAt: null })).toBe(false);
    const { startedAt: _s, ...noStarted } = createValidResult();
    expect(isAudioCaptureResult(noStarted)).toBe(false);
  });

  it("should return false for non-object values", () => {
    expect(isAudioCaptureResult(null)).toBe(false);
    expect(isAudioCaptureResult("string")).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = createValidResult();
    if (isAudioCaptureResult(value)) {
      const _result: AudioCaptureResult = value;
      expect(_result.audio.sampleRate).toBe(16000);
    }
  });
});

describe("isAudioPermissionStatus", () => {
  it("should return true for valid permission status", () => {
    const status: AudioPermissionStatus = { permission: "granted", canRequest: false };
    expect(isAudioPermissionStatus(status)).toBe(true);
    expect(isAudioPermissionStatus({ permission: "denied", canRequest: false })).toBe(true);
    expect(isAudioPermissionStatus({ permission: "prompt", canRequest: true })).toBe(true);
  });

  it("should return false for invalid permission", () => {
    expect(isAudioPermissionStatus({ permission: "invalid", canRequest: true })).toBe(false);
  });

  it("should return false for invalid canRequest", () => {
    expect(isAudioPermissionStatus({ permission: "granted", canRequest: "yes" })).toBe(false);
    expect(isAudioPermissionStatus({ permission: "granted" })).toBe(false);
  });

  it("should return false for non-object values", () => {
    expect(isAudioPermissionStatus(null)).toBe(false);
    expect(isAudioPermissionStatus("string")).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = { permission: "granted", canRequest: false };
    if (isAudioPermissionStatus(value)) {
      const _status: AudioPermissionStatus = value;
      expect(_status.permission).toBe("granted");
    }
  });
});

describe("isAudioErrorCode", () => {
  it("should return true for valid error codes", () => {
    expect(isAudioErrorCode("PERMISSION_DENIED")).toBe(true);
    expect(isAudioErrorCode("DEVICE_NOT_FOUND")).toBe(true);
    expect(isAudioErrorCode("CAPTURE_FAILED")).toBe(true);
    expect(isAudioErrorCode("ENCODING_FAILED")).toBe(true);
    expect(isAudioErrorCode("UNKNOWN")).toBe(true);
  });

  it("should return false for invalid error codes", () => {
    expect(isAudioErrorCode("INVALID_CODE")).toBe(false);
    expect(isAudioErrorCode("permission_denied")).toBe(false);
    expect(isAudioErrorCode("")).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(isAudioErrorCode(123)).toBe(false);
    expect(isAudioErrorCode(null)).toBe(false);
  });
});

describe("isAudioStateChangedEvent", () => {
  it("should return true for valid state change events", () => {
    const event: AudioStateChangedEvent = {
      previousState: "idle",
      newState: "recording",
      timestamp: Date.now(),
    };
    expect(isAudioStateChangedEvent(event)).toBe(true);
  });

  it("should return true for events with error", () => {
    const event: AudioStateChangedEvent = {
      previousState: "recording",
      newState: "error",
      timestamp: Date.now(),
      error: "Microphone disconnected",
    };
    expect(isAudioStateChangedEvent(event)).toBe(true);
  });

  it("should return false for invalid states", () => {
    expect(
      isAudioStateChangedEvent({ previousState: "invalid", newState: "idle", timestamp: 123 })
    ).toBe(false);
    expect(
      isAudioStateChangedEvent({ previousState: "idle", newState: "invalid", timestamp: 123 })
    ).toBe(false);
  });

  it("should return false for invalid timestamp", () => {
    expect(
      isAudioStateChangedEvent({ previousState: "idle", newState: "recording", timestamp: "123" })
    ).toBe(false);
  });

  it("should return false for invalid error type", () => {
    expect(
      isAudioStateChangedEvent({
        previousState: "idle",
        newState: "error",
        timestamp: 123,
        error: 456,
      })
    ).toBe(false);
  });

  it("should return false for non-object values", () => {
    expect(isAudioStateChangedEvent(null)).toBe(false);
    expect(isAudioStateChangedEvent("string")).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = {
      previousState: "idle",
      newState: "recording",
      timestamp: 1234567890,
    };
    if (isAudioStateChangedEvent(value)) {
      const _event: AudioStateChangedEvent = value;
      expect(_event.newState).toBe("recording");
    }
  });
});

describe("isAudioPermissionChangedEvent", () => {
  it("should return true for valid permission change events", () => {
    const event: AudioPermissionChangedEvent = {
      previousPermission: "prompt",
      newPermission: "granted",
    };
    expect(isAudioPermissionChangedEvent(event)).toBe(true);
  });

  it("should return false for invalid permissions", () => {
    expect(
      isAudioPermissionChangedEvent({ previousPermission: "invalid", newPermission: "granted" })
    ).toBe(false);
    expect(
      isAudioPermissionChangedEvent({ previousPermission: "prompt", newPermission: "invalid" })
    ).toBe(false);
  });

  it("should return false for non-object values", () => {
    expect(isAudioPermissionChangedEvent(null)).toBe(false);
    expect(isAudioPermissionChangedEvent("string")).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = {
      previousPermission: "prompt",
      newPermission: "granted",
    };
    if (isAudioPermissionChangedEvent(value)) {
      const _event: AudioPermissionChangedEvent = value;
      expect(_event.newPermission).toBe("granted");
    }
  });
});
