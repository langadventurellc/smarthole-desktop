import { useState, useEffect, useCallback } from "react";
import { StepLayout } from "./StepLayout";

interface CompleteStepProps {
  onFinish: () => void;
  onBack: () => void;
}

interface ConfigSummary {
  microphoneAccess: boolean;
  accessibilityAccess: boolean | null;
  sttConfigured: boolean;
  aiConfigured: boolean;
}

export function CompleteStep({ onFinish, onBack }: CompleteStepProps): React.ReactNode {
  const [summary, setSummary] = useState<ConfigSummary | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const isMacOS = navigator.platform.toLowerCase().includes("mac");

  // Check configuration status
  useEffect(() => {
    let mounted = true;

    async function checkStatus(): Promise<void> {
      try {
        const [micResult, accessibilityResult, configResponse, hasSttKey, hasAiKey] =
          await Promise.all([
            window.electronAPI.checkMicrophonePermission(),
            isMacOS
              ? window.electronAPI.checkAccessibilityPermission()
              : Promise.resolve({ trusted: true }),
            window.electronAPI.getConfig(),
            window.electronAPI.hasCredential("stt-api-key"),
            window.electronAPI.hasCredential("anthropic-api-key"),
          ]);

        // Determine STT configuration status based on backend type
        const sttBackend = configResponse.config.stt.backend;
        const localWhisperPath = configResponse.config.stt.localWhisperPath;
        const sttConfigured =
          sttBackend === "local"
            ? Boolean(localWhisperPath && localWhisperPath.trim() !== "")
            : hasSttKey;

        if (mounted) {
          setSummary({
            microphoneAccess: micResult.status === "granted",
            accessibilityAccess: isMacOS ? accessibilityResult.trusted : null,
            sttConfigured,
            aiConfigured: hasAiKey,
          });
        }
      } catch {
        if (mounted) {
          setSummary({
            microphoneAccess: false,
            accessibilityAccess: isMacOS ? false : null,
            sttConfigured: false,
            aiConfigured: false,
          });
        }
      }
    }

    checkStatus();

    return () => {
      mounted = false;
    };
  }, [isMacOS]);

  const handleFinish = useCallback(async () => {
    setIsFinishing(true);
    try {
      await window.electronAPI.setConfig({ firstRunCompleted: true });
      onFinish();
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      setIsFinishing(false);
    }
  }, [onFinish]);

  const getStatusIcon = (status: boolean | null): React.ReactNode => {
    if (status === null) {
      return (
        <span className="summary-status-icon summary-status-icon--na">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      );
    }
    if (status) {
      return (
        <span className="summary-status-icon summary-status-icon--success">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M13.5 4.5L6.5 11.5L3 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    }
    return (
      <span className="summary-status-icon summary-status-icon--warning">
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    );
  };

  return (
    <StepLayout title="You're All Set!" description="SmartHole is ready to use.">
      <div className="complete-content">
        <div className="complete-icon">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="none" />
            <path
              d="M20 32L28 40L44 24"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {summary && (
          <div className="configuration-summary">
            <h3 className="summary-title">Configuration Summary</h3>
            <ul className="summary-list">
              <li className="summary-item">
                {getStatusIcon(summary.microphoneAccess)}
                <span>Microphone Access</span>
              </li>
              {isMacOS && (
                <li className="summary-item">
                  {getStatusIcon(summary.accessibilityAccess)}
                  <span>Accessibility Access</span>
                </li>
              )}
              <li className="summary-item">
                {getStatusIcon(summary.sttConfigured)}
                <span>Speech-to-Text</span>
              </li>
              <li className="summary-item">
                {getStatusIcon(summary.aiConfigured)}
                <span>AI Routing</span>
              </li>
            </ul>

            {(!summary.microphoneAccess ||
              (isMacOS && !summary.accessibilityAccess) ||
              !summary.sttConfigured ||
              !summary.aiConfigured) && (
              <p className="summary-note">
                Some items are not configured. You can set them up later in Settings (accessible
                from the system tray menu).
              </p>
            )}
          </div>
        )}

        <div className="complete-info">
          <p>
            SmartHole runs in your system tray. Use your configured hotkey to activate voice input,
            or right-click the tray icon to access settings and other options.
          </p>
        </div>

        <div className="step-navigation">
          <button type="button" className="onboarding-button" onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="onboarding-button onboarding-button--primary onboarding-button--large"
            onClick={handleFinish}
            disabled={isFinishing}
          >
            {isFinishing ? "Finishing..." : "Finish Setup"}
          </button>
        </div>
      </div>
    </StepLayout>
  );
}
