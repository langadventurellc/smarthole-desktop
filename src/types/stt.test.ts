import { describe, it, expect } from "vitest";
import {
  // SttCloudProvider
  isSttCloudProvider,
  type SttCloudProvider,
  // SttResult
  isSttResult,
  type SttResult,
  // SttBackendType (re-exported from config)
  isSttBackendType,
  // Interfaces (type-only, for compile-time checks)
  type ISttBackend,
  type SttService,
} from "./stt";
import { type AudioBuffer } from "./audio";

describe("SttCloudProvider", () => {
  describe("isSttCloudProvider type guard", () => {
    it("should return true for valid cloud providers", () => {
      expect(isSttCloudProvider("groq")).toBe(true);
      expect(isSttCloudProvider("openai")).toBe(true);
    });

    it("should return false for invalid providers", () => {
      expect(isSttCloudProvider("azure")).toBe(false);
      expect(isSttCloudProvider("google")).toBe(false);
      expect(isSttCloudProvider("whisper")).toBe(false);
      expect(isSttCloudProvider("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isSttCloudProvider(123)).toBe(false);
      expect(isSttCloudProvider(null)).toBe(false);
      expect(isSttCloudProvider(undefined)).toBe(false);
      expect(isSttCloudProvider({})).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "groq";
      if (isSttCloudProvider(value)) {
        const _provider: SttCloudProvider = value;
        expect(_provider).toBe("groq");
      }
    });
  });
});

describe("SttBackendType", () => {
  describe("isSttBackendType type guard (re-exported from config)", () => {
    it("should return true for valid backend types", () => {
      expect(isSttBackendType("local")).toBe(true);
      expect(isSttBackendType("cloud")).toBe(true);
    });

    it("should return false for invalid backend types", () => {
      expect(isSttBackendType("remote")).toBe(false);
      expect(isSttBackendType("hybrid")).toBe(false);
      expect(isSttBackendType("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isSttBackendType(123)).toBe(false);
      expect(isSttBackendType(null)).toBe(false);
    });
  });
});

describe("SttResult", () => {
  describe("isSttResult type guard", () => {
    it("should return true for valid SttResult with all fields", () => {
      const result: SttResult = {
        text: "Hello world",
        confidence: 0.95,
        durationMs: 1500,
        backendUsed: "cloud",
      };
      expect(isSttResult(result)).toBe(true);
    });

    it("should return true for valid SttResult without optional confidence", () => {
      const result = {
        text: "Hello world",
        durationMs: 1500,
        backendUsed: "local",
      };
      expect(isSttResult(result)).toBe(true);
    });

    it("should return true for empty text", () => {
      const result = {
        text: "",
        durationMs: 0,
        backendUsed: "cloud",
      };
      expect(isSttResult(result)).toBe(true);
    });

    it("should return true for confidence at boundary values", () => {
      expect(
        isSttResult({
          text: "test",
          confidence: 0,
          durationMs: 100,
          backendUsed: "cloud",
        })
      ).toBe(true);

      expect(
        isSttResult({
          text: "test",
          confidence: 1,
          durationMs: 100,
          backendUsed: "cloud",
        })
      ).toBe(true);
    });

    it("should return false for non-object values", () => {
      expect(isSttResult(null)).toBe(false);
      expect(isSttResult(undefined)).toBe(false);
      expect(isSttResult("string")).toBe(false);
      expect(isSttResult(123)).toBe(false);
      expect(isSttResult([])).toBe(false);
    });

    it("should return false when text is missing", () => {
      expect(
        isSttResult({
          durationMs: 1500,
          backendUsed: "cloud",
        })
      ).toBe(false);
    });

    it("should return false when text is not a string", () => {
      expect(
        isSttResult({
          text: 123,
          durationMs: 1500,
          backendUsed: "cloud",
        })
      ).toBe(false);
    });

    it("should return false when confidence is out of range", () => {
      expect(
        isSttResult({
          text: "test",
          confidence: -0.1,
          durationMs: 100,
          backendUsed: "cloud",
        })
      ).toBe(false);

      expect(
        isSttResult({
          text: "test",
          confidence: 1.1,
          durationMs: 100,
          backendUsed: "cloud",
        })
      ).toBe(false);
    });

    it("should return false when confidence is not a number", () => {
      expect(
        isSttResult({
          text: "test",
          confidence: "high",
          durationMs: 100,
          backendUsed: "cloud",
        })
      ).toBe(false);
    });

    it("should return false when durationMs is missing", () => {
      expect(
        isSttResult({
          text: "test",
          backendUsed: "cloud",
        })
      ).toBe(false);
    });

    it("should return false when durationMs is negative", () => {
      expect(
        isSttResult({
          text: "test",
          durationMs: -100,
          backendUsed: "cloud",
        })
      ).toBe(false);
    });

    it("should return false when durationMs is not a number", () => {
      expect(
        isSttResult({
          text: "test",
          durationMs: "1500",
          backendUsed: "cloud",
        })
      ).toBe(false);
    });

    it("should return false when backendUsed is missing", () => {
      expect(
        isSttResult({
          text: "test",
          durationMs: 1500,
        })
      ).toBe(false);
    });

    it("should return false when backendUsed is invalid", () => {
      expect(
        isSttResult({
          text: "test",
          durationMs: 1500,
          backendUsed: "remote",
        })
      ).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = {
        text: "Hello",
        durationMs: 1000,
        backendUsed: "cloud",
      };
      if (isSttResult(value)) {
        const _result: SttResult = value;
        expect(_result.text).toBe("Hello");
      }
    });
  });
});

describe("Type interfaces", () => {
  describe("ISttBackend interface", () => {
    it("should define the expected structure", () => {
      // This is a compile-time check - TypeScript will fail if the interface is wrong
      const mockBackend: ISttBackend = {
        name: "cloud",
        transcribe: async (_audio: AudioBuffer): Promise<SttResult> => ({
          text: "transcribed text",
          durationMs: 1000,
          backendUsed: "cloud",
        }),
        isAvailable: async () => true,
      };
      expect(mockBackend.name).toBe("cloud");
    });

    it("should require readonly name property", () => {
      const backend: ISttBackend = {
        name: "local",
        transcribe: async () => ({ text: "", durationMs: 0, backendUsed: "local" }),
        isAvailable: async () => false,
      };
      // TypeScript enforces readonly at compile time
      expect(backend.name).toBe("local");
    });
  });

  describe("SttService interface", () => {
    it("should define the expected structure", () => {
      // This is a compile-time check
      const mockService: SttService = {
        transcribe: async (_audio: AudioBuffer): Promise<SttResult> => ({
          text: "transcribed text",
          durationMs: 1000,
          backendUsed: "cloud",
        }),
        getActiveBackend: () => "cloud",
        isReady: async () => true,
      };
      expect(mockService.getActiveBackend()).toBe("cloud");
    });
  });
});

describe("Type-level constraints", () => {
  it("should not allow invalid cloud providers", () => {
    // @ts-expect-error - invalid cloud provider
    const _invalidProvider: SttCloudProvider = "azure";
    expect(_invalidProvider).toBe("azure");
  });

  it("should require all mandatory fields in SttResult", () => {
    // @ts-expect-error - missing required fields
    const _invalidResult: SttResult = {
      text: "test",
    };
    expect(_invalidResult).toBeDefined();
  });

  it("should not allow extra fields in SttResult at type level", () => {
    // Note: TypeScript allows extra properties in object literals when assigned
    // to a variable first, but not in direct assignments to typed variables
    const result: SttResult = {
      text: "test",
      durationMs: 100,
      backendUsed: "cloud",
      // @ts-expect-error - extra field not in interface
      extraField: "not allowed",
    };
    expect(result.text).toBe("test");
  });
});
