import { useState, useEffect, useCallback } from "react";
import { StepLayout } from "./StepLayout";
import type { SttBackend } from "../../types/config";

interface SttStepProps {
  backend: SttBackend;
  localWhisperPath: string;
  onBackendChange: (backend: SttBackend) => void;
  onLocalPathChange: (path: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const BACKEND_OPTIONS = [
  {
    value: "cloud" as const,
    label: "Cloud (Groq Whisper API)",
    description: "Easiest setup. Requires an API key and internet connection.",
  },
  {
    value: "local" as const,
    label: "Local (Self-hosted Whisper)",
    description: "Privacy-friendly. Requires local Whisper installation.",
  },
];

export function SttStep({
  backend,
  localWhisperPath,
  onBackendChange,
  onLocalPathChange,
  onNext,
  onBack,
  onSkip,
}: SttStepProps): React.ReactNode {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  // Check if STT API key exists
  useEffect(() => {
    window.electronAPI
      .hasCredential("stt-api-key")
      .then(setHasApiKey)
      .catch(() => setHasApiKey(false));
  }, []);

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKeyInput.trim()) return;
    setIsSavingApiKey(true);
    try {
      await window.electronAPI.storeCredential("stt-api-key", apiKeyInput);
      setHasApiKey(true);
      setIsEditingApiKey(false);
      setApiKeyInput("");
      setShowApiKey(false);
    } finally {
      setIsSavingApiKey(false);
    }
  }, [apiKeyInput]);

  const handleClearApiKey = useCallback(async () => {
    setIsSavingApiKey(true);
    try {
      await window.electronAPI.deleteCredential("stt-api-key");
      setHasApiKey(false);
    } finally {
      setIsSavingApiKey(false);
    }
  }, []);

  const handleBrowsePath = useCallback(async () => {
    const result = await window.electronAPI.showOpenDialog({
      title: "Select Whisper Installation Directory",
      properties: ["openDirectory"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      onLocalPathChange(result.filePaths[0]);
    }
  }, [onLocalPathChange]);

  const canProceed = backend === "local" ? localWhisperPath.trim() !== "" : hasApiKey === true;

  return (
    <StepLayout
      title="Speech-to-Text"
      description="Choose how SmartHole converts your voice to text."
    >
      <div className="stt-content">
        <div className="backend-options">
          {BACKEND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`backend-option ${backend === option.value ? "backend-option--selected" : ""}`}
              onClick={() => onBackendChange(option.value)}
            >
              <div className="backend-option-radio">
                <div className="backend-option-radio-inner" />
              </div>
              <div className="backend-option-content">
                <span className="backend-option-label">{option.label}</span>
                <span className="backend-option-description">{option.description}</span>
              </div>
            </button>
          ))}
        </div>

        {backend === "cloud" && (
          <div className="stt-config-section">
            <div className="setting-field">
              <label className="setting-field-label">Groq API Key</label>
              <span className="setting-field-description">
                Your API key for the Groq Whisper speech-to-text service.
              </span>

              {hasApiKey === null && <div className="setting-field-loading">Loading...</div>}

              {hasApiKey !== null && !isEditingApiKey && (
                <div className="setting-field-secret-display">
                  <span className="setting-field-secret-value">
                    {hasApiKey
                      ? "\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF"
                      : "Not configured"}
                  </span>
                  <div className="setting-field-secret-actions">
                    <button
                      type="button"
                      className="onboarding-button onboarding-button--secondary"
                      onClick={() => setIsEditingApiKey(true)}
                    >
                      {hasApiKey ? "Change" : "Add"}
                    </button>
                    {hasApiKey && (
                      <button
                        type="button"
                        className="onboarding-button onboarding-button--danger"
                        onClick={handleClearApiKey}
                        disabled={isSavingApiKey}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isEditingApiKey && (
                <div className="setting-field-secret-edit">
                  <div className="setting-field-secret-input-group">
                    <input
                      type={showApiKey ? "text" : "password"}
                      className="setting-field-input"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="gsk_..."
                      autoFocus
                    />
                    <button
                      type="button"
                      className="setting-field-secret-toggle"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="setting-field-secret-actions">
                    <button
                      type="button"
                      className="onboarding-button onboarding-button--primary"
                      onClick={handleSaveApiKey}
                      disabled={isSavingApiKey || !apiKeyInput.trim()}
                    >
                      {isSavingApiKey ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      className="onboarding-button"
                      onClick={() => {
                        setIsEditingApiKey(false);
                        setApiKeyInput("");
                        setShowApiKey(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {backend === "local" && (
          <div className="stt-config-section">
            <div className="setting-field">
              <label className="setting-field-label">Whisper Installation Path</label>
              <span className="setting-field-description">
                Path to your local Whisper installation directory.
              </span>
              <div className="setting-field-path-group">
                <input
                  type="text"
                  className="setting-field-input setting-field-input--path"
                  value={localWhisperPath}
                  onChange={(e) => onLocalPathChange(e.target.value)}
                  placeholder="Select Whisper directory..."
                />
                <button
                  type="button"
                  className="onboarding-button onboarding-button--secondary"
                  onClick={handleBrowsePath}
                >
                  Browse
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="step-navigation">
          <button type="button" className="onboarding-button" onClick={onBack}>
            Back
          </button>
          <div className="step-navigation-right">
            <button
              type="button"
              className="onboarding-button onboarding-button--text"
              onClick={onSkip}
            >
              Skip for now
            </button>
            <button
              type="button"
              className="onboarding-button onboarding-button--primary"
              onClick={onNext}
              disabled={!canProceed}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </StepLayout>
  );
}
