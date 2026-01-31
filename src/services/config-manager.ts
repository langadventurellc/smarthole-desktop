import { EventEmitter } from "events";
import Store from "electron-store";
import { getLogger, Logger } from "./logger";
import {
  AppConfig,
  PartialAppConfig,
  DEFAULT_CONFIG,
  isLogLevel,
  isVoiceInputMode,
  isSttBackend,
  isLlmProvider,
} from "../types";

// ============================================================================
// Types
// ============================================================================

export type ConfigChangedListener = (config: AppConfig, changedKeys: string[]) => void;

export class ConfigValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(`Invalid value for ${field}: ${JSON.stringify(value)}`);
    this.name = "ConfigValidationError";
  }
}

export interface ConfigManagerService {
  getConfig(): AppConfig;
  /** Returns dot-notation paths that changed (e.g., ['stt.backend', 'logLevel']) */
  setConfig(updates: PartialAppConfig): string[];
  on(event: "configChanged", listener: ConfigChangedListener): void;
  off(event: "configChanged", listener: ConfigChangedListener): void;
  reset(): void;
}

// ============================================================================
// Implementation
// ============================================================================

class ConfigManagerServiceImpl implements ConfigManagerService {
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;
  private readonly store: Store<AppConfig>;

  constructor() {
    this.logger = getLogger().child({ component: "ConfigManager" });
    this.emitter = new EventEmitter();
    this.store = new Store<AppConfig>({
      defaults: DEFAULT_CONFIG,
      name: "smarthole-config",
    });

    this.logger.debug("ConfigManager initialized", {
      configPath: this.store.path,
    });
  }

  getConfig(): AppConfig {
    return this.store.store;
  }

  setConfig(updates: PartialAppConfig): string[] {
    // Validate updates before applying
    this.validateUpdates(updates);

    const beforeConfig = this.getConfig();
    const changedKeys = this.getChangedKeyPaths(beforeConfig, updates);

    if (changedKeys.length === 0) {
      this.logger.debug("setConfig called but no changes detected");
      return [];
    }

    this.applyUpdates(updates);

    const afterConfig = this.getConfig();

    this.logger.info("Configuration updated", {
      changedKeys,
    });

    this.emitter.emit("configChanged", afterConfig, changedKeys);

    return changedKeys;
  }

  private validateUpdates(updates: PartialAppConfig): void {
    if (updates.logLevel !== undefined && !isLogLevel(updates.logLevel)) {
      throw new ConfigValidationError("logLevel", updates.logLevel);
    }

    if (updates.voiceInputMode !== undefined && !isVoiceInputMode(updates.voiceInputMode)) {
      throw new ConfigValidationError("voiceInputMode", updates.voiceInputMode);
    }

    if (updates.stt?.backend !== undefined && !isSttBackend(updates.stt.backend)) {
      throw new ConfigValidationError("stt.backend", updates.stt.backend);
    }

    if (updates.llm?.provider !== undefined && !isLlmProvider(updates.llm.provider)) {
      throw new ConfigValidationError("llm.provider", updates.llm.provider);
    }
  }

  on(event: "configChanged", listener: ConfigChangedListener): void {
    this.emitter.on(event, listener);
  }

  off(event: "configChanged", listener: ConfigChangedListener): void {
    this.emitter.off(event, listener);
  }

  reset(): void {
    this.store.clear();
    // After clear, electron-store restores defaults
    this.emitter.removeAllListeners();
    this.logger.debug("Configuration reset to defaults");
  }

  private applyUpdates(updates: PartialAppConfig, prefix = ""): void {
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        continue;
      }

      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        // Recursively apply nested objects
        this.applyUpdates(value as PartialAppConfig, fullKey);
      } else {
        // Set the value directly using dot notation
        this.store.set(fullKey, value);
      }
    }
  }

  private getChangedKeyPaths(current: AppConfig, updates: PartialAppConfig, prefix = ""): string[] {
    const changedKeys: string[] = [];

    for (const [key, newValue] of Object.entries(updates)) {
      if (newValue === undefined) {
        continue;
      }

      const fullKey = prefix ? `${prefix}.${key}` : key;
      const currentValue = this.getNestedValue(current, fullKey);

      if (newValue !== null && typeof newValue === "object" && !Array.isArray(newValue)) {
        // Recursively check nested objects
        const nestedChanges = this.getChangedKeyPaths(
          current,
          newValue as PartialAppConfig,
          fullKey
        );
        changedKeys.push(...nestedChanges);
      } else if (!this.isEqual(currentValue, newValue)) {
        // Value is different, mark as changed
        changedKeys.push(fullKey);
      }
    }

    return changedKeys;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private isEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }

    // Handle null/undefined
    if (a === null || a === undefined || b === null || b === undefined) {
      return a === b;
    }

    // For arrays, do a simple JSON comparison
    if (Array.isArray(a) && Array.isArray(b)) {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return false;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let configManagerInstance: ConfigManagerServiceImpl | null = null;

/** Must be called inside `app.whenReady()` after the logger has been initialized. */
export function initializeConfigManager(): ConfigManagerService {
  if (configManagerInstance) {
    return configManagerInstance;
  }

  configManagerInstance = new ConfigManagerServiceImpl();
  return configManagerInstance;
}

export function getConfigManager(): ConfigManagerService {
  if (!configManagerInstance) {
    throw new Error(
      "ConfigManager not initialized. Call initializeConfigManager() before using getConfigManager()."
    );
  }
  return configManagerInstance;
}

export function resetConfigManager(): void {
  if (configManagerInstance) {
    configManagerInstance.reset();
  }
  configManagerInstance = null;
}
