import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  writeString,
  encodeWav,
  resampleAudio,
  convertToMono,
  isRecording,
  getConfig,
  setConfig,
  reset,
  AudioCaptureError,
} from "./audio-capture";
import { DEFAULT_AUDIO_CAPTURE_CONFIG } from "../types";

describe("audio-capture renderer module", () => {
  beforeEach(() => {
    reset();
  });

  afterEach(() => {
    reset();
  });

  describe("writeString", () => {
    it("writes ASCII string to DataView", () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);

      writeString(view, 0, "RIFF");

      expect(view.getUint8(0)).toBe(82); // R
      expect(view.getUint8(1)).toBe(73); // I
      expect(view.getUint8(2)).toBe(70); // F
      expect(view.getUint8(3)).toBe(70); // F
    });

    it("writes at specified offset", () => {
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);

      writeString(view, 4, "WAVE");

      expect(view.getUint8(4)).toBe(87); // W
      expect(view.getUint8(5)).toBe(65); // A
      expect(view.getUint8(6)).toBe(86); // V
      expect(view.getUint8(7)).toBe(69); // E
    });
  });

  describe("encodeWav", () => {
    it("creates valid WAV header", () => {
      const samples = new Float32Array([0, 0.5, -0.5, 0]);
      const sampleRate = 16000;
      const numChannels = 1;

      const wavBuffer = encodeWav(samples, sampleRate, numChannels);
      const view = new DataView(wavBuffer);

      // Check RIFF header
      expect(String.fromCharCode(view.getUint8(0))).toBe("R");
      expect(String.fromCharCode(view.getUint8(1))).toBe("I");
      expect(String.fromCharCode(view.getUint8(2))).toBe("F");
      expect(String.fromCharCode(view.getUint8(3))).toBe("F");

      // Check WAVE format
      expect(String.fromCharCode(view.getUint8(8))).toBe("W");
      expect(String.fromCharCode(view.getUint8(9))).toBe("A");
      expect(String.fromCharCode(view.getUint8(10))).toBe("V");
      expect(String.fromCharCode(view.getUint8(11))).toBe("E");

      // Check fmt chunk
      expect(String.fromCharCode(view.getUint8(12))).toBe("f");
      expect(String.fromCharCode(view.getUint8(13))).toBe("m");
      expect(String.fromCharCode(view.getUint8(14))).toBe("t");

      // Check audio format (1 = PCM)
      expect(view.getUint16(20, true)).toBe(1);

      // Check channels
      expect(view.getUint16(22, true)).toBe(numChannels);

      // Check sample rate
      expect(view.getUint32(24, true)).toBe(sampleRate);

      // Check bits per sample
      expect(view.getUint16(34, true)).toBe(16);
    });

    it("encodes samples correctly", () => {
      const samples = new Float32Array([0, 1, -1, 0.5, -0.5]);
      const wavBuffer = encodeWav(samples, 16000, 1);
      const view = new DataView(wavBuffer);

      // Data starts at offset 44
      const dataOffset = 44;

      // Sample 0 (0) should be ~0
      expect(view.getInt16(dataOffset, true)).toBe(0);

      // Sample 1 (1.0) should be max positive (~32767)
      expect(view.getInt16(dataOffset + 2, true)).toBe(32767);

      // Sample 2 (-1.0) should be max negative (-32768)
      expect(view.getInt16(dataOffset + 4, true)).toBe(-32768);

      // Sample 3 (0.5) should be ~16383
      const sample3 = view.getInt16(dataOffset + 6, true);
      expect(sample3).toBeGreaterThan(16000);
      expect(sample3).toBeLessThan(17000);

      // Sample 4 (-0.5) should be ~-16384
      const sample4 = view.getInt16(dataOffset + 8, true);
      expect(sample4).toBeLessThan(-16000);
      expect(sample4).toBeGreaterThan(-17000);
    });

    it("clamps values outside [-1, 1] range", () => {
      const samples = new Float32Array([2, -2, 1.5, -1.5]);
      const wavBuffer = encodeWav(samples, 16000, 1);
      const view = new DataView(wavBuffer);

      const dataOffset = 44;

      // All out-of-range values should be clamped
      expect(view.getInt16(dataOffset, true)).toBe(32767); // 2 clamped to 1
      expect(view.getInt16(dataOffset + 2, true)).toBe(-32768); // -2 clamped to -1
      expect(view.getInt16(dataOffset + 4, true)).toBe(32767); // 1.5 clamped to 1
      expect(view.getInt16(dataOffset + 6, true)).toBe(-32768); // -1.5 clamped to -1
    });

    it("calculates correct file size", () => {
      const samples = new Float32Array(1000);
      const wavBuffer = encodeWav(samples, 16000, 1);
      const view = new DataView(wavBuffer);

      // Total size = 44 (header) + 1000 * 2 (16-bit samples) = 2044
      expect(wavBuffer.byteLength).toBe(2044);

      // File size in header = total - 8
      expect(view.getUint32(4, true)).toBe(2044 - 8);

      // Data chunk size = 1000 * 2
      expect(view.getUint32(40, true)).toBe(2000);
    });
  });

  describe("resampleAudio", () => {
    it("returns same array when rates match", () => {
      const samples = new Float32Array([1, 2, 3, 4, 5]);
      const result = resampleAudio(samples, 16000, 16000);

      expect(result).toBe(samples);
    });

    it("downsamples from 48kHz to 16kHz", () => {
      // Create a simple signal at 48kHz (3x the target)
      const source = new Float32Array(96); // 2ms at 48kHz
      for (let i = 0; i < source.length; i++) {
        source[i] = i / source.length; // Linear ramp
      }

      const result = resampleAudio(source, 48000, 16000);

      // Should be 1/3 the length
      expect(result.length).toBe(32);

      // Values should be interpolated
      expect(result[0]).toBeCloseTo(0, 5);
      expect(result[result.length - 1]).toBeCloseTo(source[source.length - 1], 1);
    });

    it("upsamples from 8kHz to 16kHz", () => {
      const source = new Float32Array([0, 0.5, 1, 0.5, 0]);
      const result = resampleAudio(source, 8000, 16000);

      // Should be 2x the length
      expect(result.length).toBe(10);

      // Original values should be preserved at even indices
      expect(result[0]).toBeCloseTo(0, 5);
      expect(result[2]).toBeCloseTo(0.5, 5);
      expect(result[4]).toBeCloseTo(1, 5);
    });

    it("handles empty array gracefully", () => {
      const source = new Float32Array(0);
      const result = resampleAudio(source, 48000, 16000);

      expect(result.length).toBe(0);
    });

    it("preserves single sample when same rate", () => {
      const source = new Float32Array([0.5]);
      const result = resampleAudio(source, 16000, 16000);

      // Same rate returns the same array
      expect(result).toBe(source);
      expect(result[0]).toBe(0.5);
    });
  });

  describe("convertToMono", () => {
    it("returns channel data for mono input", () => {
      const mockBuffer = {
        numberOfChannels: 1,
        length: 100,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(100).fill(0.5)),
      } as unknown as AudioBuffer;

      const result = convertToMono(mockBuffer);

      expect(mockBuffer.getChannelData).toHaveBeenCalledWith(0);
      expect(result[0]).toBe(0.5);
    });

    it("averages stereo channels", () => {
      const leftChannel = new Float32Array([1, 0, 0.5, -0.5]);
      const rightChannel = new Float32Array([0, 1, 0.5, -0.5]);

      const mockBuffer = {
        numberOfChannels: 2,
        length: 4,
        getChannelData: vi.fn((ch) => (ch === 0 ? leftChannel : rightChannel)),
      } as unknown as AudioBuffer;

      const result = convertToMono(mockBuffer);

      expect(result[0]).toBeCloseTo(0.5, 5); // (1 + 0) / 2
      expect(result[1]).toBeCloseTo(0.5, 5); // (0 + 1) / 2
      expect(result[2]).toBeCloseTo(0.5, 5); // (0.5 + 0.5) / 2
      expect(result[3]).toBeCloseTo(-0.5, 5); // (-0.5 + -0.5) / 2
    });
  });

  describe("configuration", () => {
    it("starts with default config", () => {
      const cfg = getConfig();

      expect(cfg.sampleRate).toBe(DEFAULT_AUDIO_CAPTURE_CONFIG.sampleRate);
      expect(cfg.channels).toBe(DEFAULT_AUDIO_CAPTURE_CONFIG.channels);
      expect(cfg.format).toBe(DEFAULT_AUDIO_CAPTURE_CONFIG.format);
    });

    it("allows updating config", () => {
      setConfig({ sampleRate: 44100 });

      const cfg = getConfig();
      expect(cfg.sampleRate).toBe(44100);
      expect(cfg.channels).toBe(1); // Unchanged
    });

    it("returns copy of config", () => {
      const cfg1 = getConfig();
      const cfg2 = getConfig();

      expect(cfg1).not.toBe(cfg2);
      expect(cfg1).toEqual(cfg2);
    });
  });

  describe("state management", () => {
    it("isRecording returns false initially", () => {
      expect(isRecording()).toBe(false);
    });

    it("reset restores default config", () => {
      setConfig({ sampleRate: 44100 });
      reset();

      const cfg = getConfig();
      expect(cfg.sampleRate).toBe(DEFAULT_AUDIO_CAPTURE_CONFIG.sampleRate);
    });
  });

  describe("AudioCaptureError", () => {
    it("creates error with message and code", () => {
      const error = new AudioCaptureError("Test error", "CAPTURE_FAILED");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("CAPTURE_FAILED");
      expect(error.name).toBe("AudioCaptureError");
    });

    it("is instanceof Error", () => {
      const error = new AudioCaptureError("Test", "UNKNOWN");

      expect(error).toBeInstanceOf(Error);
    });
  });
});
