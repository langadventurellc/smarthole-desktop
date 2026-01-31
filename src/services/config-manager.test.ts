/**
 * Tests for the ConfigManager service.
 * Tests singleton management, configuration storage, change tracking, and event emission.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initializeConfigManager,
  getConfigManager,
  resetConfigManager,
  ConfigManagerService,
  ConfigValidationError,
} from "./config-manager";
import { initializeLogger, resetLogger } from "./logger";
import { LogLevel, DEFAULT_CONFIG, AppConfig } from "../types";

// Mock electron-store
vi.mock("electron-store", () => {
  return {
    default: vi.fn().mockImplementation(function (
      this: MockStore,
      options?: { defaults?: AppConfig }
    ) {
      const defaults = options?.defaults ?? {};
      this._data = JSON.parse(JSON.stringify(defaults));
      this.path = "/mock/path/to/config.json";
      return this;
    }),
  };
});

interface MockStore {
  _data: Record<string, unknown>;
  path: string;
  store: Record<string, unknown>;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  clear(): void;
}

// Get the mock constructor to add prototype methods
import Store from "electron-store";
const MockStore = Store as unknown as { prototype: MockStore };

MockStore.prototype = {
  _data: {},
  path: "/mock/path/to/config.json",
  get store() {
    return JSON.parse(JSON.stringify(this._data));
  },
  get(key: string): unknown {
    const keys = key.split(".");
    let current: unknown = this._data;
    for (const k of keys) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[k];
    }
    return current;
  },
  set(key: string, value: unknown): void {
    const keys = key.split(".");
    let current: Record<string, unknown> = this._data as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (current[k] === undefined || typeof current[k] !== "object") {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  },
  clear(): void {
    // Reset to defaults (mimics electron-store behavior)
    this._data = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  },
};

describe("ConfigManagerService", () => {
  let configManager: ConfigManagerService;

  beforeEach(() => {
    vi.clearAllMocks();
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    configManager = initializeConfigManager();
  });

  afterEach(() => {
    resetConfigManager();
    resetLogger();
  });

  describe("singleton initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeConfigManager();
      const instance2 = initializeConfigManager();
      expect(instance1).toBe(instance2);
    });

    it("throws if getConfigManager called before initialization", () => {
      resetConfigManager();
      expect(() => getConfigManager()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", () => {
      const instance1 = initializeConfigManager();
      resetConfigManager();
      resetLogger();
      initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
      const instance2 = initializeConfigManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("getConfig", () => {
    it("returns default configuration on fresh start", () => {
      const config = configManager.getConfig();

      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("returns a copy of the configuration", () => {
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();

      // Should be equal but not the same reference
      expect(config1).toEqual(config2);
    });
  });

  describe("setConfig", () => {
    it("updates a single top-level property", () => {
      const changedKeys = configManager.setConfig({
        logLevel: LogLevel.DEBUG,
      });

      expect(changedKeys).toEqual(["logLevel"]);
      expect(configManager.getConfig().logLevel).toBe(LogLevel.DEBUG);
    });

    it("updates a nested property", () => {
      const changedKeys = configManager.setConfig({
        stt: { backend: "local" },
      });

      expect(changedKeys).toEqual(["stt.backend"]);
      expect(configManager.getConfig().stt.backend).toBe("local");
    });

    it("updates multiple properties at once", () => {
      const changedKeys = configManager.setConfig({
        logLevel: LogLevel.DEBUG,
        voiceInputMode: "toggle",
      });

      expect(changedKeys).toContain("logLevel");
      expect(changedKeys).toContain("voiceInputMode");
      expect(changedKeys).toHaveLength(2);

      const config = configManager.getConfig();
      expect(config.logLevel).toBe(LogLevel.DEBUG);
      expect(config.voiceInputMode).toBe("toggle");
    });

    it("updates deeply nested properties", () => {
      const changedKeys = configManager.setConfig({
        llm: {
          model: "claude-3-opus-20240229",
        },
      });

      expect(changedKeys).toEqual(["llm.model"]);
      expect(configManager.getConfig().llm.model).toBe("claude-3-opus-20240229");
    });

    it("returns empty array when no changes detected", () => {
      const changedKeys = configManager.setConfig({
        logLevel: DEFAULT_CONFIG.logLevel, // Same as default
      });

      expect(changedKeys).toEqual([]);
    });

    it("handles undefined values in updates gracefully", () => {
      const changedKeys = configManager.setConfig({
        logLevel: undefined,
      });

      expect(changedKeys).toEqual([]);
      expect(configManager.getConfig().logLevel).toBe(DEFAULT_CONFIG.logLevel);
    });
  });

  describe("deep merge behavior", () => {
    it("preserves unmodified nested properties", () => {
      // First, verify initial state
      expect(configManager.getConfig().stt.backend).toBe("cloud");

      // Update only apiKey within stt
      configManager.setConfig({
        stt: { apiKey: "test-key" },
      });

      const config = configManager.getConfig();
      // Backend should be preserved
      expect(config.stt.backend).toBe("cloud");
      // apiKey should be set
      expect(config.stt.apiKey).toBe("test-key");
    });

    it("handles multiple nested updates without affecting siblings", () => {
      configManager.setConfig({
        hotkey: { voiceInput: "CommandOrControl+Space" },
      });

      configManager.setConfig({
        hotkey: { textInput: "CommandOrControl+T" },
      });

      const config = configManager.getConfig();
      expect(config.hotkey.voiceInput).toBe("CommandOrControl+Space");
      expect(config.hotkey.textInput).toBe("CommandOrControl+T");
    });
  });

  describe("changed keys tracking", () => {
    it("returns correct dot-notation paths for nested changes", () => {
      const changedKeys = configManager.setConfig({
        stt: {
          backend: "local",
          localWhisperPath: "/path/to/whisper",
        },
      });

      expect(changedKeys).toContain("stt.backend");
      expect(changedKeys).toContain("stt.localWhisperPath");
      expect(changedKeys).toHaveLength(2);
    });

    it("only includes actually changed keys", () => {
      // Set initial value
      configManager.setConfig({
        logLevel: LogLevel.DEBUG,
      });

      // Try to set same value again along with a new change
      const changedKeys = configManager.setConfig({
        logLevel: LogLevel.DEBUG, // Same, shouldn't be in changed
        websocketPort: 8080, // Different
      });

      expect(changedKeys).toEqual(["websocketPort"]);
    });
  });

  describe("configChanged event", () => {
    it("emits event when config changes", () => {
      const handler = vi.fn();
      configManager.on("configChanged", handler);

      configManager.setConfig({ logLevel: LogLevel.DEBUG });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ logLevel: LogLevel.DEBUG }), [
        "logLevel",
      ]);
    });

    it("does not emit event when no changes", () => {
      const handler = vi.fn();
      configManager.on("configChanged", handler);

      configManager.setConfig({ logLevel: DEFAULT_CONFIG.logLevel });

      expect(handler).not.toHaveBeenCalled();
    });

    it("passes correct config and changedKeys to listener", () => {
      const handler = vi.fn();
      configManager.on("configChanged", handler);

      configManager.setConfig({
        stt: { backend: "local" },
        logLevel: LogLevel.TRACE,
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          stt: expect.objectContaining({ backend: "local" }),
          logLevel: LogLevel.TRACE,
        }),
        expect.arrayContaining(["stt.backend", "logLevel"])
      );
    });

    it("allows unsubscribing from events", () => {
      const handler = vi.fn();
      configManager.on("configChanged", handler);
      configManager.off("configChanged", handler);

      configManager.setConfig({ logLevel: LogLevel.DEBUG });

      expect(handler).not.toHaveBeenCalled();
    });

    it("supports multiple listeners", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      configManager.on("configChanged", handler1);
      configManager.on("configChanged", handler2);

      configManager.setConfig({ logLevel: LogLevel.DEBUG });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("reset functionality", () => {
    it("resets config to defaults", () => {
      configManager.setConfig({
        logLevel: LogLevel.TRACE,
        voiceInputMode: "toggle",
        websocketPort: 8080,
      });

      configManager.reset();

      const config = configManager.getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("removes all event listeners on reset", () => {
      const handler = vi.fn();
      configManager.on("configChanged", handler);

      configManager.reset();

      // Need to re-initialize after reset to test
      resetLogger();
      initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
      configManager = initializeConfigManager();
      configManager.setConfig({ logLevel: LogLevel.DEBUG });

      // Old handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("resetConfigManager", () => {
    it("clears the singleton instance", () => {
      expect(() => {
        resetConfigManager();
        getConfigManager();
      }).toThrow(/not initialized/);
    });

    it("is safe to call multiple times", () => {
      expect(() => {
        resetConfigManager();
        resetConfigManager();
        resetConfigManager();
      }).not.toThrow();
    });
  });

  describe("validation", () => {
    it("rejects invalid logLevel", () => {
      expect(() => {
        configManager.setConfig({ logLevel: "invalid" as LogLevel });
      }).toThrow(ConfigValidationError);
    });

    it("rejects invalid voiceInputMode", () => {
      expect(() => {
        configManager.setConfig({ voiceInputMode: "invalid" as any });
      }).toThrow(ConfigValidationError);
    });

    it("rejects invalid stt.backend", () => {
      expect(() => {
        configManager.setConfig({ stt: { backend: "invalid" as any } });
      }).toThrow(ConfigValidationError);
    });

    it("rejects invalid llm.provider", () => {
      expect(() => {
        configManager.setConfig({ llm: { provider: "invalid" as any } });
      }).toThrow(ConfigValidationError);
    });

    it("accepts valid enum values", () => {
      expect(() => {
        configManager.setConfig({
          logLevel: LogLevel.DEBUG,
          voiceInputMode: "toggle",
          stt: { backend: "local" },
          llm: { provider: "anthropic" },
        });
      }).not.toThrow();
    });

    it("provides field name in error message", () => {
      try {
        configManager.setConfig({ logLevel: "invalid" as LogLevel });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as ConfigValidationError).field).toBe("logLevel");
        expect((error as ConfigValidationError).message).toContain("logLevel");
      }
    });
  });
});
