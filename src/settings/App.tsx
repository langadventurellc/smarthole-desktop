import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { AppConfig, VoiceInputMode, SttBackend, LogLevel } from "../types/config";
import type { CredentialKey } from "../types/credentials";
import {
  SettingsSection,
  HotkeyInput,
  SecretInput,
  SelectInput,
  NumberInput,
  ToggleInput,
  PathInput,
} from "./components";

type SettingsTab = "hotkeys" | "voice" | "stt" | "ai" | "logging" | "advanced";

interface TabConfig {
  id: SettingsTab;
  label: string;
}

const TABS: TabConfig[] = [
  { id: "hotkeys", label: "Hotkeys" },
  { id: "voice", label: "Voice Input" },
  { id: "stt", label: "Speech-to-Text" },
  { id: "ai", label: "AI Routing" },
  { id: "logging", label: "Logging" },
  { id: "advanced", label: "Advanced" },
];

const VOICE_MODE_OPTIONS = [
  { value: "push-to-talk", label: "Push-to-Talk (hold hotkey while speaking)" },
  { value: "toggle", label: "Toggle (press to start, press again to stop)" },
];

const STT_BACKEND_OPTIONS = [
  { value: "cloud", label: "Cloud (OpenAI Whisper API)" },
  { value: "local", label: "Local (Self-hosted Whisper)" },
];

const LOG_LEVEL_OPTIONS = [
  { value: "error", label: "Error" },
  { value: "warn", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
  { value: "trace", label: "Trace" },
];

interface ValidationErrors {
  websocketPort?: string;
  voiceHotkey?: string;
  textHotkey?: string;
}

function validateConfig(config: AppConfig): ValidationErrors {
  const errors: ValidationErrors = {};

  // Validate WebSocket port
  if (config.websocketPort < 1024 || config.websocketPort > 65535) {
    errors.websocketPort = "Port must be between 1024 and 65535";
  }

  // Validate voice hotkey (required)
  if (!config.hotkey.voiceInput || config.hotkey.voiceInput.trim() === "") {
    errors.voiceHotkey = "Voice input hotkey is required";
  }

  return errors;
}

export function App(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<SettingsTab>("hotkeys");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [hasExternalChanges, setHasExternalChanges] = useState(false);

  // Refs to track current state for use in callbacks
  const configRef = useRef<AppConfig | null>(null);
  const originalConfigRef = useRef<AppConfig | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    originalConfigRef.current = originalConfig;
  }, [originalConfig]);

  // Load config on mount
  useEffect(() => {
    let mounted = true;

    async function loadConfig(): Promise<void> {
      try {
        const response = await window.electronAPI.getConfig();
        if (mounted) {
          setConfig(response.config);
          setOriginalConfig(response.config);
          setIsLoading(false);
        }
      } catch (error) {
        if (mounted) {
          console.error("Failed to load config:", error);
          setIsLoading(false);
        }
      }
    }

    loadConfig();

    // Subscribe to external config changes
    const unsubscribe = window.electronAPI.onConfigChanged((newConfig: AppConfig) => {
      if (mounted) {
        const currentConfig = configRef.current;
        const currentOriginal = originalConfigRef.current;

        // Check if user has unsaved changes
        const hasDirtyState =
          currentConfig &&
          currentOriginal &&
          JSON.stringify(currentConfig) !== JSON.stringify(currentOriginal);

        if (hasDirtyState) {
          // User has unsaved changes - only update originalConfig and show warning
          // This preserves the user's pending changes
          setOriginalConfig(newConfig);
          setHasExternalChanges(true);
          setSaveMessage({
            type: "warning",
            text: "Settings changed externally. Your changes are preserved.",
          });
        } else {
          // No unsaved changes - update both config and originalConfig
          setConfig(newConfig);
          setOriginalConfig(newConfig);
          setHasExternalChanges(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Check if config has unsaved changes
  const isDirty = useMemo(() => {
    if (!config || !originalConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  }, [config, originalConfig]);

  // Validation errors
  const validationErrors = useMemo(() => {
    if (!config) return {};
    return validateConfig(config);
  }, [config]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  // Update a config value
  const updateConfig = useCallback(<K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveMessage(null);
  }, []);

  // Update nested config value
  const updateNestedConfig = useCallback(
    <K extends keyof AppConfig>(key: K, nestedKey: string, value: unknown) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const current = prev[key];
        if (typeof current === "object" && current !== null) {
          return {
            ...prev,
            [key]: { ...current, [nestedKey]: value },
          };
        }
        return prev;
      });
      setSaveMessage(null);
    },
    []
  );

  // Save config
  const handleSave = useCallback(async () => {
    if (!config || hasErrors) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      await window.electronAPI.setConfig(config);
      setOriginalConfig(config);
      setHasExternalChanges(false);
      setSaveMessage({ type: "success", text: "Settings saved successfully" });
    } catch (error) {
      console.error("Failed to save config:", error);
      setSaveMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  }, [config, hasErrors]);

  // Revert to original config
  const handleCancel = useCallback(() => {
    setConfig(originalConfig);
    setSaveMessage(null);
  }, [originalConfig]);

  // Store credential
  const storeCredential = useCallback(async (key: CredentialKey, value: string) => {
    await window.electronAPI.storeCredential(key, value);
  }, []);

  // Delete credential
  const deleteCredential = useCallback(async (key: CredentialKey) => {
    await window.electronAPI.deleteCredential(key);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !hasErrors && !isSaving) {
          handleSave();
        }
      }
      // Escape to close (if no unsaved changes) or revert
      if (e.key === "Escape") {
        if (isDirty) {
          handleCancel();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, hasErrors, isSaving, handleSave, handleCancel]);

  if (isLoading) {
    return (
      <div className="settings-loading">
        <div className="settings-loading-spinner" />
        <p>Loading settings...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="settings-error">
        <p>Failed to load settings. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1 className="settings-title">Settings</h1>
        {saveMessage && (
          <div className={`settings-message settings-message--${saveMessage.type}`}>
            {saveMessage.text}
          </div>
        )}
      </header>

      <div className="settings-layout">
        <nav className="settings-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-nav-item ${activeTab === tab.id ? "settings-nav-item--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="settings-content">
          {activeTab === "hotkeys" && (
            <SettingsSection
              title="Hotkeys"
              description="Configure global keyboard shortcuts for SmartHole."
            >
              <HotkeyInput
                id="hotkey-voice"
                label="Voice Input Hotkey"
                description="The keyboard shortcut to activate voice input."
                value={config.hotkey.voiceInput}
                onChange={(value) => updateNestedConfig("hotkey", "voiceInput", value)}
                error={validationErrors.voiceHotkey}
              />
              <HotkeyInput
                id="hotkey-text"
                label="Text Input Hotkey"
                description="Optional keyboard shortcut for text input popup."
                value={config.hotkey.textInput || ""}
                onChange={(value) => updateNestedConfig("hotkey", "textInput", value || undefined)}
                error={validationErrors.textHotkey}
              />
            </SettingsSection>
          )}

          {activeTab === "voice" && (
            <SettingsSection title="Voice Input" description="Configure how voice recording works.">
              <SelectInput
                id="voice-mode"
                label="Recording Mode"
                description="How the voice recording is triggered and stopped."
                value={config.voiceInputMode}
                options={VOICE_MODE_OPTIONS}
                onChange={(value) => updateConfig("voiceInputMode", value as VoiceInputMode)}
              />
            </SettingsSection>
          )}

          {activeTab === "stt" && (
            <SettingsSection
              title="Speech-to-Text"
              description="Configure the speech recognition service."
            >
              <SelectInput
                id="stt-backend"
                label="Backend"
                description="Choose between cloud-based or local speech recognition."
                value={config.stt.backend}
                options={STT_BACKEND_OPTIONS}
                onChange={(value) => updateNestedConfig("stt", "backend", value as SttBackend)}
              />

              {config.stt.backend === "cloud" && (
                <SecretInput
                  id="stt-api-key"
                  label="STT API Key"
                  description="API key for the cloud speech-to-text service."
                  credentialKey="stt-api-key"
                  onSave={(value) => storeCredential("stt-api-key", value)}
                  onClear={() => deleteCredential("stt-api-key")}
                />
              )}

              {config.stt.backend === "local" && (
                <PathInput
                  id="stt-whisper-path"
                  label="Local Whisper Path"
                  description="Path to your local Whisper installation."
                  value={config.stt.localWhisperPath || ""}
                  onChange={(value) => updateNestedConfig("stt", "localWhisperPath", value)}
                  selectDirectory
                  placeholder="Select Whisper installation directory..."
                />
              )}
            </SettingsSection>
          )}

          {activeTab === "ai" && (
            <SettingsSection
              title="AI Routing"
              description="Configure the AI model used for routing commands."
            >
              <SecretInput
                id="anthropic-api-key"
                label="Anthropic API Key"
                description="Your Anthropic API key for Claude."
                credentialKey="anthropic-api-key"
                onSave={(value) => storeCredential("anthropic-api-key", value)}
                onClear={() => deleteCredential("anthropic-api-key")}
              />
              <SelectInput
                id="llm-model"
                label="Model"
                description="The Claude model to use for command routing."
                value={config.llm.model}
                options={[
                  { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku (fastest)" },
                  { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
                  { value: "claude-3-opus-20240229", label: "Claude 3 Opus (most capable)" },
                ]}
                onChange={(value) => updateNestedConfig("llm", "model", value)}
              />
            </SettingsSection>
          )}

          {activeTab === "logging" && (
            <SettingsSection title="Logging" description="Configure application logging behavior.">
              <SelectInput
                id="log-level"
                label="Log Level"
                description="Minimum log level to record. Lower levels include all higher levels."
                value={config.logLevel}
                options={LOG_LEVEL_OPTIONS}
                onChange={(value) => updateConfig("logLevel", value as LogLevel)}
              />
              <ToggleInput
                id="log-message-content"
                label="Log Message Content"
                description="Include full message text in logs. Disable for privacy."
                checked={config.logMessageContent}
                onChange={(checked) => updateConfig("logMessageContent", checked)}
              />
            </SettingsSection>
          )}

          {activeTab === "advanced" && (
            <SettingsSection title="Advanced" description="Advanced configuration options.">
              <NumberInput
                id="websocket-port"
                label="WebSocket Port"
                description="Port for client connections. Must be between 1024 and 65535."
                value={config.websocketPort}
                onChange={(value) => updateConfig("websocketPort", value)}
                min={1024}
                max={65535}
                error={validationErrors.websocketPort}
              />
            </SettingsSection>
          )}
        </main>
      </div>

      <footer className="settings-footer">
        <div className="settings-footer-status">
          {isDirty && <span className="settings-dirty-indicator">Unsaved changes</span>}
          {hasExternalChanges && isDirty && (
            <span className="settings-external-changes-indicator">
              (baseline updated externally)
            </span>
          )}
        </div>
        <div className="settings-footer-actions">
          <button
            type="button"
            className="setting-button"
            onClick={handleCancel}
            disabled={!isDirty || isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="setting-button setting-button--primary"
            onClick={handleSave}
            disabled={!isDirty || hasErrors || isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </footer>
    </div>
  );
}
