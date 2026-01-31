import { useState, useEffect, useCallback } from "react";
import { StepLayout } from "./StepLayout";

interface AiStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function AiStep({ onNext, onBack, onSkip }: AiStepProps): React.ReactNode {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  // Check if Anthropic API key exists
  useEffect(() => {
    window.electronAPI
      .hasCredential("anthropic-api-key")
      .then(setHasApiKey)
      .catch(() => setHasApiKey(false));
  }, []);

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKeyInput.trim()) return;
    setIsSavingApiKey(true);
    try {
      await window.electronAPI.storeCredential("anthropic-api-key", apiKeyInput);
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
      await window.electronAPI.deleteCredential("anthropic-api-key");
      setHasApiKey(false);
    } finally {
      setIsSavingApiKey(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && apiKeyInput.trim()) {
        e.preventDefault();
        handleSaveApiKey();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsEditingApiKey(false);
        setApiKeyInput("");
        setShowApiKey(false);
      }
    },
    [apiKeyInput, handleSaveApiKey]
  );

  return (
    <StepLayout
      title="AI Configuration"
      description="Configure the AI that routes your commands to the right application."
    >
      <div className="ai-content">
        <div className="ai-explanation">
          <div className="ai-explanation-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p>
            SmartHole uses Claude to understand your voice commands and route them to the
            appropriate application. The routing agent analyzes your intent and chooses the best
            plugin to handle your request.
          </p>
        </div>

        <div className="setting-field">
          <label className="setting-field-label">Anthropic API Key</label>
          <span className="setting-field-description">
            Your API key from{" "}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="setting-field-link"
            >
              console.anthropic.com
            </a>
          </span>

          {hasApiKey === null && <div className="setting-field-loading">Loading...</div>}

          {hasApiKey !== null && !isEditingApiKey && (
            <div className="setting-field-secret-display">
              <span className="setting-field-secret-value">
                {hasApiKey ? "\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF" : "Not configured"}
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
                  onKeyDown={handleKeyDown}
                  placeholder="sk-ant-..."
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
              disabled={!hasApiKey}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </StepLayout>
  );
}
