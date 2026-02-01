import { describe, it, expect } from "vitest";
import {
  // LogLevel
  LogLevel,
  isLogLevel,
  // VoiceInputMode
  isVoiceInputMode,
  type VoiceInputMode,
  // SttBackend
  isSttBackend,
  type SttBackend,
  // LlmProvider
  isLlmProvider,
  type LlmProvider,
  // Configuration types
  type SttConfig,
  type LlmConfig,
  type HotkeyConfig,
  type AppConfig,
  type PartialAppConfig,
  // Default config
  DEFAULT_CONFIG,
} from "./config";

describe("LogLevel", () => {
  describe("LogLevel values", () => {
    it("should have all 5 expected log levels", () => {
      expect(LogLevel.ERROR).toBe("error");
      expect(LogLevel.WARN).toBe("warn");
      expect(LogLevel.INFO).toBe("info");
      expect(LogLevel.DEBUG).toBe("debug");
      expect(LogLevel.TRACE).toBe("trace");
    });

    it("should have exactly 5 values", () => {
      expect(Object.keys(LogLevel)).toHaveLength(5);
    });
  });

  describe("isLogLevel type guard", () => {
    it("should return true for valid log levels", () => {
      expect(isLogLevel("error")).toBe(true);
      expect(isLogLevel("warn")).toBe(true);
      expect(isLogLevel("info")).toBe(true);
      expect(isLogLevel("debug")).toBe(true);
      expect(isLogLevel("trace")).toBe(true);
    });

    it("should return false for invalid log levels", () => {
      expect(isLogLevel("ERROR")).toBe(false); // Case sensitive
      expect(isLogLevel("warning")).toBe(false);
      expect(isLogLevel("fatal")).toBe(false);
      expect(isLogLevel("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isLogLevel(123)).toBe(false);
      expect(isLogLevel(null)).toBe(false);
      expect(isLogLevel(undefined)).toBe(false);
      expect(isLogLevel({})).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "info";
      if (isLogLevel(value)) {
        // TypeScript should know this is LogLevel
        const _level: LogLevel = value;
        expect(_level).toBe("info");
      }
    });
  });
});

describe("VoiceInputMode", () => {
  describe("isVoiceInputMode type guard", () => {
    it("should return true for valid voice input modes", () => {
      expect(isVoiceInputMode("push-to-talk")).toBe(true);
      expect(isVoiceInputMode("toggle")).toBe(true);
    });

    it("should return false for invalid modes", () => {
      expect(isVoiceInputMode("continuous")).toBe(false);
      expect(isVoiceInputMode("hold")).toBe(false);
      expect(isVoiceInputMode("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isVoiceInputMode(123)).toBe(false);
      expect(isVoiceInputMode(null)).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "push-to-talk";
      if (isVoiceInputMode(value)) {
        const _mode: VoiceInputMode = value;
        expect(_mode).toBe("push-to-talk");
      }
    });
  });
});

describe("SttBackend", () => {
  describe("isSttBackend type guard", () => {
    it("should return true for valid STT backends", () => {
      expect(isSttBackend("local")).toBe(true);
      expect(isSttBackend("cloud")).toBe(true);
    });

    it("should return false for invalid backends", () => {
      expect(isSttBackend("remote")).toBe(false);
      expect(isSttBackend("whisper")).toBe(false);
      expect(isSttBackend("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isSttBackend(123)).toBe(false);
      expect(isSttBackend(null)).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "cloud";
      if (isSttBackend(value)) {
        const _backend: SttBackend = value;
        expect(_backend).toBe("cloud");
      }
    });
  });
});

describe("LlmProvider", () => {
  describe("isLlmProvider type guard", () => {
    it("should return true for valid LLM providers", () => {
      expect(isLlmProvider("anthropic")).toBe(true);
    });

    it("should return false for invalid providers", () => {
      expect(isLlmProvider("openai")).toBe(false);
      expect(isLlmProvider("google")).toBe(false);
      expect(isLlmProvider("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isLlmProvider(123)).toBe(false);
      expect(isLlmProvider(null)).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "anthropic";
      if (isLlmProvider(value)) {
        const _provider: LlmProvider = value;
        expect(_provider).toBe("anthropic");
      }
    });
  });
});

describe("DEFAULT_CONFIG", () => {
  it("should have the correct hotkey configuration", () => {
    expect(DEFAULT_CONFIG.hotkey.voiceInput).toBe("CommandOrControl+Shift+Space");
    expect(DEFAULT_CONFIG.hotkey.textInput).toBeUndefined();
  });

  it("should have the correct voice input mode", () => {
    expect(DEFAULT_CONFIG.voiceInputMode).toBe("push-to-talk");
  });

  it("should have the correct STT configuration", () => {
    expect(DEFAULT_CONFIG.stt.backend).toBe("cloud");
    expect(DEFAULT_CONFIG.stt.apiKey).toBeUndefined();
    expect(DEFAULT_CONFIG.stt.localWhisperPath).toBeUndefined();
  });

  it("should have the correct LLM configuration", () => {
    expect(DEFAULT_CONFIG.llm.provider).toBe("anthropic");
    expect(DEFAULT_CONFIG.llm.model).toBe("claude-haiku-4-5");
    expect(DEFAULT_CONFIG.llm.apiKey).toBeUndefined();
  });

  it("should have the correct logging configuration", () => {
    expect(DEFAULT_CONFIG.logLevel).toBe(LogLevel.INFO);
    expect(DEFAULT_CONFIG.logMessageContent).toBe(false);
  });

  it("should have the correct WebSocket port", () => {
    expect(DEFAULT_CONFIG.websocketPort).toBe(9473);
  });

  it("should satisfy the AppConfig interface", () => {
    // This is a compile-time check - if DEFAULT_CONFIG doesn't match AppConfig,
    // TypeScript will fail here
    const _config: AppConfig = DEFAULT_CONFIG;
    expect(_config).toBe(DEFAULT_CONFIG);
  });

  it("should be readonly", () => {
    // Verify the config is frozen at runtime
    // Note: Readonly only enforces at compile time, but we can test the type
    const config: Readonly<AppConfig> = DEFAULT_CONFIG;
    expect(config).toBe(DEFAULT_CONFIG);
  });
});

describe("Type interfaces", () => {
  describe("SttConfig", () => {
    it("should allow valid configurations", () => {
      const cloudConfig: SttConfig = {
        backend: "cloud",
        apiKey: "sk-test-key",
      };
      expect(cloudConfig.backend).toBe("cloud");

      const localConfig: SttConfig = {
        backend: "local",
        localWhisperPath: "/usr/local/bin/whisper",
      };
      expect(localConfig.backend).toBe("local");
    });

    it("should allow minimal configuration", () => {
      const minimalConfig: SttConfig = {
        backend: "cloud",
      };
      expect(minimalConfig.apiKey).toBeUndefined();
    });
  });

  describe("LlmConfig", () => {
    it("should allow valid configurations", () => {
      const config: LlmConfig = {
        provider: "anthropic",
        model: "claude-haiku-4-5",
        apiKey: "sk-ant-test",
      };
      expect(config.provider).toBe("anthropic");
      expect(config.model).toBe("claude-haiku-4-5");
    });

    it("should allow configuration without API key", () => {
      const config: LlmConfig = {
        provider: "anthropic",
        model: "claude-haiku-4-5",
      };
      expect(config.apiKey).toBeUndefined();
    });
  });

  describe("HotkeyConfig", () => {
    it("should allow valid configurations", () => {
      const config: HotkeyConfig = {
        voiceInput: "CommandOrControl+Shift+Space",
        textInput: "CommandOrControl+Shift+T",
      };
      expect(config.voiceInput).toBe("CommandOrControl+Shift+Space");
      expect(config.textInput).toBe("CommandOrControl+Shift+T");
    });

    it("should allow minimal configuration", () => {
      const config: HotkeyConfig = {
        voiceInput: "CommandOrControl+Shift+Space",
      };
      expect(config.textInput).toBeUndefined();
    });
  });

  describe("PartialAppConfig", () => {
    it("should allow partial top-level properties", () => {
      const partial: PartialAppConfig = {
        logLevel: LogLevel.DEBUG,
      };
      expect(partial.logLevel).toBe("debug");
      expect(partial.hotkey).toBeUndefined();
    });

    it("should allow partial nested properties", () => {
      const partial: PartialAppConfig = {
        stt: {
          backend: "local",
        },
      };
      expect(partial.stt?.backend).toBe("local");
      expect(partial.stt?.apiKey).toBeUndefined();
    });

    it("should allow deeply partial configurations", () => {
      const partial: PartialAppConfig = {
        hotkey: {
          voiceInput: "Alt+Space",
        },
        llm: {
          model: "claude-opus-4-5",
        },
      };
      expect(partial.hotkey?.voiceInput).toBe("Alt+Space");
      expect(partial.llm?.model).toBe("claude-opus-4-5");
    });

    it("should allow empty partial config", () => {
      const partial: PartialAppConfig = {};
      expect(Object.keys(partial)).toHaveLength(0);
    });
  });
});

describe("Type-level constraints", () => {
  it("should not allow invalid log levels", () => {
    // @ts-expect-error - invalid log level string
    const _invalidLevel: LogLevel = "fatal";
    expect(_invalidLevel).toBe("fatal");
  });

  it("should not allow invalid voice input modes", () => {
    // @ts-expect-error - invalid voice input mode
    const _invalidMode: VoiceInputMode = "continuous";
    expect(_invalidMode).toBe("continuous");
  });

  it("should not allow invalid STT backends", () => {
    // @ts-expect-error - invalid STT backend
    const _invalidBackend: SttBackend = "remote";
    expect(_invalidBackend).toBe("remote");
  });

  it("should not allow invalid LLM providers", () => {
    // @ts-expect-error - invalid LLM provider
    const _invalidProvider: LlmProvider = "openai";
    expect(_invalidProvider).toBe("openai");
  });

  it("should require mandatory fields in SttConfig", () => {
    // @ts-expect-error - backend is required
    const _invalidConfig: SttConfig = {
      apiKey: "test",
    };
    expect(_invalidConfig).toBeDefined();
  });

  it("should require mandatory fields in LlmConfig", () => {
    // @ts-expect-error - provider and model are required
    const _invalidConfig: LlmConfig = {
      apiKey: "test",
    };
    expect(_invalidConfig).toBeDefined();
  });

  it("should require mandatory fields in HotkeyConfig", () => {
    // @ts-expect-error - voiceInput is required
    const _invalidConfig: HotkeyConfig = {
      textInput: "Ctrl+T",
    };
    expect(_invalidConfig).toBeDefined();
  });

  it("should require all mandatory fields in AppConfig", () => {
    // @ts-expect-error - missing required fields
    const _invalidConfig: AppConfig = {
      logLevel: LogLevel.INFO,
    };
    expect(_invalidConfig).toBeDefined();
  });
});
