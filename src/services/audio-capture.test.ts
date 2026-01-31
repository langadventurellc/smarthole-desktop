import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initializeAudioCapture,
  getAudioCapture,
  resetAudioCapture,
  AudioCaptureService,
} from "./audio-capture";
import { AudioCaptureState, AudioCapturePermission, AudioCaptureResult } from "../types";

// Mock electron systemPreferences
vi.mock("electron", () => ({
  systemPreferences: {
    getMediaAccessStatus: vi.fn().mockReturnValue("granted"),
  },
}));

// Mock the logger
vi.mock("./logger", () => ({
  getLogger: vi.fn(() => ({
    child: vi.fn().mockReturnThis(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock the input-state service
const mockInputState = {
  canTransitionTo: vi.fn().mockReturnValue(true),
  transitionTo: vi.fn().mockReturnValue(true),
  getCurrentState: vi.fn().mockReturnValue("idle"),
};

vi.mock("./input-state", () => ({
  getInputState: vi.fn(() => mockInputState),
}));

describe("audio-capture service", () => {
  let service: AudioCaptureService;

  beforeEach(async () => {
    // Reset mock to granted before each test
    const { systemPreferences } = await import("electron");
    vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValue("granted");

    // Reset input state mock
    mockInputState.canTransitionTo.mockReturnValue(true);
    mockInputState.transitionTo.mockReturnValue(true);
    mockInputState.canTransitionTo.mockClear();
    mockInputState.transitionTo.mockClear();

    resetAudioCapture();
    service = initializeAudioCapture();
  });

  afterEach(() => {
    resetAudioCapture();
  });

  describe("singleton management", () => {
    it("initializes singleton instance", () => {
      expect(service).toBeDefined();
      expect(service.getState()).toBe(AudioCaptureState.IDLE);
    });

    it("returns same instance on multiple initialize calls", () => {
      const service2 = initializeAudioCapture();
      expect(service2).toBe(service);
    });

    it("getAudioCapture returns initialized instance", () => {
      expect(getAudioCapture()).toBe(service);
    });

    it("getAudioCapture throws if not initialized", () => {
      resetAudioCapture();
      expect(() => getAudioCapture()).toThrow("AudioCapture not initialized");
    });

    it("resetAudioCapture clears instance", () => {
      resetAudioCapture();
      expect(() => getAudioCapture()).toThrow();
    });
  });

  describe("recording lifecycle", () => {
    it("starts in IDLE state", () => {
      expect(service.getState()).toBe(AudioCaptureState.IDLE);
      expect(service.isRecording()).toBe(false);
    });

    it("transitions to RECORDING on startRecording", async () => {
      const result = await service.startRecording();

      expect(result).toBe(true);
      expect(service.getState()).toBe(AudioCaptureState.RECORDING);
      expect(service.isRecording()).toBe(true);
    });

    it("emits stateChanged event on startRecording", async () => {
      const listener = vi.fn();
      service.on("stateChanged", listener);

      await service.startRecording();

      expect(listener).toHaveBeenCalledWith({
        previousState: AudioCaptureState.IDLE,
        newState: AudioCaptureState.RECORDING,
        timestamp: expect.any(Number),
      });
    });

    it("returns true but stays in RECORDING if already recording", async () => {
      await service.startRecording();
      const listener = vi.fn();
      service.on("stateChanged", listener);

      const result = await service.startRecording();

      expect(result).toBe(true);
      expect(service.isRecording()).toBe(true);
      expect(listener).not.toHaveBeenCalled();
    });

    it("transitions to STOPPED on stopRecording", async () => {
      await service.startRecording();

      await service.stopRecording();

      expect(service.getState()).toBe(AudioCaptureState.STOPPED);
      expect(service.isRecording()).toBe(false);
    });

    it("emits stateChanged event on stopRecording", async () => {
      await service.startRecording();
      const listener = vi.fn();
      service.on("stateChanged", listener);

      await service.stopRecording();

      expect(listener).toHaveBeenCalledWith({
        previousState: AudioCaptureState.RECORDING,
        newState: AudioCaptureState.STOPPED,
        timestamp: expect.any(Number),
      });
    });

    it("does nothing if stopRecording called when not recording", async () => {
      const listener = vi.fn();
      service.on("stateChanged", listener);

      await service.stopRecording();

      expect(service.getState()).toBe(AudioCaptureState.IDLE);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("handleAudioData", () => {
    it("transitions to IDLE and emits audioReady event", async () => {
      await service.startRecording();
      await service.stopRecording();

      const stateListener = vi.fn();
      const audioReadyListener = vi.fn();
      service.on("stateChanged", stateListener);
      service.on("audioReady", audioReadyListener);

      const mockResult: AudioCaptureResult = {
        audio: {
          data: new ArrayBuffer(100),
          format: "wav",
          sampleRate: 16000,
          channels: 1,
          durationMs: 1000,
        },
        startedAt: "2024-01-01T00:00:00Z",
        stoppedAt: "2024-01-01T00:00:01Z",
      };

      service.handleAudioData(mockResult);

      expect(service.getState()).toBe(AudioCaptureState.IDLE);
      expect(stateListener).toHaveBeenCalledWith({
        previousState: AudioCaptureState.STOPPED,
        newState: AudioCaptureState.IDLE,
        timestamp: expect.any(Number),
      });
      expect(audioReadyListener).toHaveBeenCalledWith({
        result: mockResult,
      });
    });
  });

  describe("voice input mode", () => {
    it("defaults to push-to-talk mode", () => {
      expect(service.getMode()).toBe("push-to-talk");
    });

    it("allows setting mode to toggle", () => {
      service.setMode("toggle");
      expect(service.getMode()).toBe("toggle");
    });

    it("allows setting mode back to push-to-talk", () => {
      service.setMode("toggle");
      service.setMode("push-to-talk");
      expect(service.getMode()).toBe("push-to-talk");
    });

    it("does nothing when setting same mode", () => {
      // No error should occur
      service.setMode("push-to-talk");
      expect(service.getMode()).toBe("push-to-talk");
    });
  });

  describe("permission status", () => {
    it("returns granted permission on non-darwin platforms", async () => {
      // Mock non-darwin platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      const status = await service.getPermissionStatus();

      expect(status.permission).toBe(AudioCapturePermission.GRANTED);
      expect(status.canRequest).toBe(false);

      // Restore platform
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("checks macOS microphone permission", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });

      const { systemPreferences } = await import("electron");
      vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValue("granted");

      const status = await service.getPermissionStatus();

      expect(systemPreferences.getMediaAccessStatus).toHaveBeenCalledWith("microphone");
      expect(status.permission).toBe(AudioCapturePermission.GRANTED);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("returns denied for denied permission", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });

      const { systemPreferences } = await import("electron");
      vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValue("denied");

      const status = await service.getPermissionStatus();

      expect(status.permission).toBe(AudioCapturePermission.DENIED);
      expect(status.canRequest).toBe(false);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("returns prompt for not-determined permission", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });

      const { systemPreferences } = await import("electron");
      vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValue("not-determined");

      const status = await service.getPermissionStatus();

      expect(status.permission).toBe(AudioCapturePermission.PROMPT);
      expect(status.canRequest).toBe(true);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });

  describe("permission denied recording", () => {
    it("returns false and emits error when permission denied", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });

      const { systemPreferences } = await import("electron");
      vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValue("denied");

      const errorListener = vi.fn();
      service.on("error", errorListener);

      const result = await service.startRecording();

      expect(result).toBe(false);
      expect(service.isRecording()).toBe(false);
      expect(errorListener).toHaveBeenCalledWith({
        message: "Microphone permission denied",
        code: "PERMISSION_DENIED",
      });

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });

  describe("event subscription", () => {
    it("allows subscribing and unsubscribing from events", async () => {
      const listener = vi.fn();

      service.on("stateChanged", listener);
      await service.startRecording();
      expect(listener).toHaveBeenCalledTimes(1);

      service.off("stateChanged", listener);
      await service.stopRecording();
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", async () => {
      await service.startRecording();
      service.setMode("toggle");

      service.reset();

      expect(service.getState()).toBe(AudioCaptureState.IDLE);
      expect(service.getMode()).toBe("push-to-talk");
      expect(service.isRecording()).toBe(false);
    });

    it("removes all event listeners", async () => {
      const listener = vi.fn();
      service.on("stateChanged", listener);

      service.reset();
      await service.startRecording();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("InputState integration", () => {
    it("transitions InputState to RECORDING on startRecording", async () => {
      await service.startRecording();

      expect(mockInputState.canTransitionTo).toHaveBeenCalledWith("recording");
      expect(mockInputState.transitionTo).toHaveBeenCalledWith("recording");
    });

    it("transitions InputState to PROCESSING on stopRecording", async () => {
      await service.startRecording();
      mockInputState.canTransitionTo.mockClear();
      mockInputState.transitionTo.mockClear();

      await service.stopRecording();

      expect(mockInputState.canTransitionTo).toHaveBeenCalledWith("processing");
      expect(mockInputState.transitionTo).toHaveBeenCalledWith("processing");
    });

    it("transitions InputState to IDLE on handleAudioData", async () => {
      await service.startRecording();
      await service.stopRecording();
      mockInputState.canTransitionTo.mockClear();
      mockInputState.transitionTo.mockClear();

      const mockResult: AudioCaptureResult = {
        audio: {
          data: new ArrayBuffer(100),
          format: "wav",
          sampleRate: 16000,
          channels: 1,
          durationMs: 1000,
        },
        startedAt: "2024-01-01T00:00:00Z",
        stoppedAt: "2024-01-01T00:00:01Z",
      };

      service.handleAudioData(mockResult);

      expect(mockInputState.canTransitionTo).toHaveBeenCalledWith("idle");
      expect(mockInputState.transitionTo).toHaveBeenCalledWith("idle");
    });

    it("does not transition InputState if canTransitionTo returns false", async () => {
      mockInputState.canTransitionTo.mockReturnValue(false);

      await service.startRecording();

      expect(mockInputState.canTransitionTo).toHaveBeenCalledWith("recording");
      expect(mockInputState.transitionTo).not.toHaveBeenCalled();
    });
  });

  describe("no-audio timeout", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("transitions to IDLE after timeout if no audio data received", async () => {
      await service.startRecording();
      await service.stopRecording();

      expect(service.getState()).toBe(AudioCaptureState.STOPPED);

      const stateListener = vi.fn();
      service.on("stateChanged", stateListener);

      // Fast-forward past the no-audio timeout (500ms)
      vi.advanceTimersByTime(500);

      expect(service.getState()).toBe(AudioCaptureState.IDLE);
      expect(stateListener).toHaveBeenCalledWith({
        previousState: AudioCaptureState.STOPPED,
        newState: AudioCaptureState.IDLE,
        timestamp: expect.any(Number),
      });
    });

    it("transitions InputState to IDLE after timeout", async () => {
      await service.startRecording();
      await service.stopRecording();
      mockInputState.canTransitionTo.mockClear();
      mockInputState.transitionTo.mockClear();

      vi.advanceTimersByTime(500);

      expect(mockInputState.canTransitionTo).toHaveBeenCalledWith("idle");
      expect(mockInputState.transitionTo).toHaveBeenCalledWith("idle");
    });

    it("does not trigger timeout if handleAudioData is called first", async () => {
      await service.startRecording();
      await service.stopRecording();

      const stateListener = vi.fn();
      service.on("stateChanged", stateListener);

      // Receive audio data before timeout
      const mockResult: AudioCaptureResult = {
        audio: {
          data: new ArrayBuffer(100),
          format: "wav",
          sampleRate: 16000,
          channels: 1,
          durationMs: 1000,
        },
        startedAt: "2024-01-01T00:00:00Z",
        stoppedAt: "2024-01-01T00:00:01Z",
      };

      service.handleAudioData(mockResult);
      expect(service.getState()).toBe(AudioCaptureState.IDLE);
      stateListener.mockClear();

      // Fast-forward past the timeout - should not trigger again
      vi.advanceTimersByTime(500);

      expect(stateListener).not.toHaveBeenCalled();
      expect(service.getState()).toBe(AudioCaptureState.IDLE);
    });

    it("clears timeout on reset", async () => {
      await service.startRecording();
      await service.stopRecording();

      service.reset();

      const stateListener = vi.fn();
      service.on("stateChanged", stateListener);

      // Fast-forward past timeout - should not trigger after reset
      vi.advanceTimersByTime(500);

      expect(stateListener).not.toHaveBeenCalled();
    });
  });
});
