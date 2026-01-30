/**
 * Tests for the InputState service.
 * Tests state machine transitions, event emission, and mode changes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initializeInputState,
  getInputState,
  resetInputState,
  InputStateService,
} from "./input-state";
import { initializeLogger, resetLogger } from "./logger";
import { LogLevel, InputState } from "../types";

describe("InputStateService", () => {
  let inputState: InputStateService;

  beforeEach(() => {
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    inputState = initializeInputState();
  });

  afterEach(() => {
    resetInputState();
    resetLogger();
  });

  describe("initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeInputState();
      const instance2 = initializeInputState();
      expect(instance1).toBe(instance2);
    });

    it("throws if getInputState called before initialization", () => {
      resetInputState();
      expect(() => getInputState()).toThrow(/not initialized/);
    });

    it("starts in IDLE state with push-to-talk mode", () => {
      expect(inputState.getCurrentState()).toBe(InputState.IDLE);
      expect(inputState.getCurrentMode()).toBe("push-to-talk");
    });
  });

  describe("valid state transitions", () => {
    it("transitions from IDLE to RECORDING", () => {
      const result = inputState.transitionTo(InputState.RECORDING);

      expect(result).toBe(true);
      expect(inputState.getCurrentState()).toBe(InputState.RECORDING);
    });

    it("transitions from RECORDING to PROCESSING", () => {
      inputState.transitionTo(InputState.RECORDING);

      const result = inputState.transitionTo(InputState.PROCESSING);

      expect(result).toBe(true);
      expect(inputState.getCurrentState()).toBe(InputState.PROCESSING);
    });

    it("transitions from RECORDING to IDLE (cancelled)", () => {
      inputState.transitionTo(InputState.RECORDING);

      const result = inputState.transitionTo(InputState.IDLE);

      expect(result).toBe(true);
      expect(inputState.getCurrentState()).toBe(InputState.IDLE);
    });

    it("transitions from PROCESSING to IDLE", () => {
      inputState.transitionTo(InputState.RECORDING);
      inputState.transitionTo(InputState.PROCESSING);

      const result = inputState.transitionTo(InputState.IDLE);

      expect(result).toBe(true);
      expect(inputState.getCurrentState()).toBe(InputState.IDLE);
    });
  });

  describe("invalid state transitions", () => {
    it("rejects IDLE to PROCESSING (must go through RECORDING)", () => {
      const result = inputState.transitionTo(InputState.PROCESSING);

      expect(result).toBe(false);
      expect(inputState.getCurrentState()).toBe(InputState.IDLE);
    });

    it("rejects IDLE to IDLE (no-op transition)", () => {
      const result = inputState.transitionTo(InputState.IDLE);

      expect(result).toBe(false);
      expect(inputState.getCurrentState()).toBe(InputState.IDLE);
    });

    it("rejects PROCESSING to RECORDING (must go back to IDLE first)", () => {
      inputState.transitionTo(InputState.RECORDING);
      inputState.transitionTo(InputState.PROCESSING);

      const result = inputState.transitionTo(InputState.RECORDING);

      expect(result).toBe(false);
      expect(inputState.getCurrentState()).toBe(InputState.PROCESSING);
    });
  });

  describe("canTransitionTo", () => {
    it("returns true for valid transitions", () => {
      expect(inputState.canTransitionTo(InputState.RECORDING)).toBe(true);

      inputState.transitionTo(InputState.RECORDING);
      expect(inputState.canTransitionTo(InputState.PROCESSING)).toBe(true);
      expect(inputState.canTransitionTo(InputState.IDLE)).toBe(true);
    });

    it("returns false for invalid transitions", () => {
      expect(inputState.canTransitionTo(InputState.PROCESSING)).toBe(false);
      expect(inputState.canTransitionTo(InputState.IDLE)).toBe(false);
    });
  });

  describe("stateChanged event", () => {
    it("emits event on valid transition", () => {
      const handler = vi.fn();
      inputState.on("stateChanged", handler);

      inputState.transitionTo(InputState.RECORDING);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          previousState: InputState.IDLE,
          newState: InputState.RECORDING,
          timestamp: expect.any(Number),
        })
      );
    });

    it("does not emit event on invalid transition", () => {
      const handler = vi.fn();
      inputState.on("stateChanged", handler);

      inputState.transitionTo(InputState.PROCESSING); // Invalid from IDLE

      expect(handler).not.toHaveBeenCalled();
    });

    it("allows unsubscribing from events", () => {
      const handler = vi.fn();
      inputState.on("stateChanged", handler);
      inputState.off("stateChanged", handler);

      inputState.transitionTo(InputState.RECORDING);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("mode changes", () => {
    it("changes mode and emits modeChanged event", () => {
      const handler = vi.fn();
      inputState.on("modeChanged", handler);

      inputState.setMode("toggle");

      expect(inputState.getCurrentMode()).toBe("toggle");
      expect(handler).toHaveBeenCalledWith({
        previousMode: "push-to-talk",
        newMode: "toggle",
      });
    });

    it("does not emit event when setting same mode", () => {
      const handler = vi.fn();
      inputState.on("modeChanged", handler);

      inputState.setMode("push-to-talk"); // Same as default

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("getStateInfo", () => {
    it("returns complete state info", () => {
      const info = inputState.getStateInfo();

      expect(info).toEqual({
        state: InputState.IDLE,
        mode: "push-to-talk",
        stateEnteredAt: expect.any(Number),
        recordingStartedAt: undefined,
      });
    });

    it("tracks recordingStartedAt when recording", () => {
      inputState.transitionTo(InputState.RECORDING);
      const info = inputState.getStateInfo();

      expect(info.recordingStartedAt).toBeDefined();
      expect(info.recordingStartedAt).toBe(info.stateEnteredAt);
    });

    it("preserves recordingStartedAt during processing", () => {
      inputState.transitionTo(InputState.RECORDING);
      const recordingTime = inputState.getStateInfo().recordingStartedAt;

      inputState.transitionTo(InputState.PROCESSING);
      const info = inputState.getStateInfo();

      expect(info.recordingStartedAt).toBe(recordingTime);
    });

    it("clears recordingStartedAt when returning to idle", () => {
      inputState.transitionTo(InputState.RECORDING);
      inputState.transitionTo(InputState.IDLE);

      const info = inputState.getStateInfo();

      expect(info.recordingStartedAt).toBeUndefined();
    });
  });
});
