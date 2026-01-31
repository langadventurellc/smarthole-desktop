import { useState, useEffect, useCallback, useRef } from "react";
import { StepLayout } from "./StepLayout";

type MicPermissionStatus = "not-determined" | "granted" | "denied" | "restricted" | "unknown";

interface PermissionsStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function PermissionsStep({ onNext, onBack, onSkip }: PermissionsStepProps): React.ReactNode {
  const [micStatus, setMicStatus] = useState<MicPermissionStatus>("unknown");
  const [accessibilityStatus, setAccessibilityStatus] = useState<boolean | null>(null);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [isOpeningSettings, setIsOpeningSettings] = useState(false);
  const isMacOS = navigator.platform.toLowerCase().includes("mac");
  const accessibilityPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check microphone permission status
  const checkMicPermission = useCallback(async () => {
    try {
      const result = await window.electronAPI.checkMicrophonePermission();
      setMicStatus(result.status);
    } catch {
      setMicStatus("unknown");
    }
  }, []);

  // Check accessibility permission status (macOS only)
  const checkAccessibilityPermission = useCallback(async () => {
    if (!isMacOS) {
      setAccessibilityStatus(true);
      return;
    }
    try {
      const result = await window.electronAPI.checkAccessibilityPermission();
      setAccessibilityStatus(result.trusted);
    } catch {
      setAccessibilityStatus(null);
    }
  }, [isMacOS]);

  // Initial permission check on mount
  useEffect(() => {
    checkMicPermission();
    checkAccessibilityPermission();
  }, [checkMicPermission, checkAccessibilityPermission]);

  // Poll accessibility permission after opening settings
  useEffect(() => {
    return () => {
      if (accessibilityPollRef.current) {
        clearInterval(accessibilityPollRef.current);
      }
    };
  }, []);

  const handleRequestMicPermission = useCallback(async () => {
    setIsRequestingMic(true);
    try {
      const result = await window.electronAPI.requestMicrophonePermission();
      if (result.granted) {
        setMicStatus("granted");
      } else {
        // Re-check to get actual status
        await checkMicPermission();
      }
    } catch {
      await checkMicPermission();
    } finally {
      setIsRequestingMic(false);
    }
  }, [checkMicPermission]);

  const handleOpenAccessibilitySettings = useCallback(async () => {
    setIsOpeningSettings(true);
    try {
      await window.electronAPI.openAccessibilitySettings();
      // Start polling for permission changes
      if (accessibilityPollRef.current) {
        clearInterval(accessibilityPollRef.current);
      }
      accessibilityPollRef.current = setInterval(async () => {
        const result = await window.electronAPI.checkAccessibilityPermission();
        if (result.trusted) {
          setAccessibilityStatus(true);
          if (accessibilityPollRef.current) {
            clearInterval(accessibilityPollRef.current);
            accessibilityPollRef.current = null;
          }
        }
      }, 1000);
    } finally {
      setIsOpeningSettings(false);
    }
  }, []);

  const getMicStatusDisplay = (): { text: string; className: string } => {
    switch (micStatus) {
      case "granted":
        return { text: "Access granted", className: "permission-status--granted" };
      case "denied":
        return { text: "Access denied", className: "permission-status--denied" };
      case "restricted":
        return { text: "Restricted by system", className: "permission-status--denied" };
      case "not-determined":
        return { text: "Not requested yet", className: "permission-status--pending" };
      default:
        return { text: "Checking...", className: "permission-status--pending" };
    }
  };

  const getAccessibilityStatusDisplay = (): { text: string; className: string } => {
    if (accessibilityStatus === null) {
      return { text: "Checking...", className: "permission-status--pending" };
    }
    if (accessibilityStatus) {
      return { text: "Access granted", className: "permission-status--granted" };
    }
    return { text: "Not enabled", className: "permission-status--denied" };
  };

  const micStatusDisplay = getMicStatusDisplay();
  const accessibilityStatusDisplay = getAccessibilityStatusDisplay();

  const canProceed = micStatus === "granted" && (!isMacOS || accessibilityStatus === true);

  return (
    <StepLayout
      title="Permissions"
      description="SmartHole needs a few permissions to work properly."
    >
      <div className="permissions-content">
        {/* Microphone Permission */}
        <div className="permission-card">
          <div className="permission-card-header">
            <div className="permission-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19 11C19 14.866 15.866 18 12 18C8.13401 18 5 14.866 5 11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 18V22"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="permission-info">
              <h3 className="permission-title">Microphone Access</h3>
              <p className="permission-explanation">
                Required for voice input. SmartHole uses your microphone only when you activate the
                hotkey.
              </p>
            </div>
          </div>
          <div className="permission-card-footer">
            <span className={`permission-status ${micStatusDisplay.className}`}>
              {micStatusDisplay.text}
            </span>
            {micStatus !== "granted" && micStatus !== "restricted" && (
              <button
                type="button"
                className="onboarding-button onboarding-button--secondary"
                onClick={handleRequestMicPermission}
                disabled={isRequestingMic}
              >
                {isRequestingMic ? "Requesting..." : "Grant Access"}
              </button>
            )}
            {micStatus === "granted" && (
              <span className="permission-check">
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
            )}
          </div>
        </div>

        {/* Accessibility Permission (macOS only) */}
        {isMacOS && (
          <div className="permission-card">
            <div className="permission-card-header">
              <div className="permission-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect
                    x="2"
                    y="4"
                    width="20"
                    height="16"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M6 10H10M6 14H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 10L17 12L15 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="permission-info">
                <h3 className="permission-title">Accessibility Access</h3>
                <p className="permission-explanation">
                  Required for global hotkeys to work across all apps. You&apos;ll need to enable
                  this manually in System Settings.
                </p>
              </div>
            </div>
            <div className="permission-card-footer">
              <span className={`permission-status ${accessibilityStatusDisplay.className}`}>
                {accessibilityStatusDisplay.text}
              </span>
              {accessibilityStatus === false && (
                <button
                  type="button"
                  className="onboarding-button onboarding-button--secondary"
                  onClick={handleOpenAccessibilitySettings}
                  disabled={isOpeningSettings}
                >
                  {isOpeningSettings ? "Opening..." : "Open Settings"}
                </button>
              )}
              {accessibilityStatus === true && (
                <span className="permission-check">
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
              )}
            </div>
            {accessibilityStatus === false && (
              <div className="permission-instructions">
                <p>To enable Accessibility access:</p>
                <ol>
                  <li>Click &quot;Open Settings&quot; above</li>
                  <li>Find SmartHole in the list</li>
                  <li>Toggle it on (you may need to unlock first)</li>
                </ol>
              </div>
            )}
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
              {canProceed ? "Continue" : "Grant Permissions to Continue"}
            </button>
          </div>
        </div>
      </div>
    </StepLayout>
  );
}
