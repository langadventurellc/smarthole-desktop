import { StepLayout } from "./StepLayout";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps): React.ReactNode {
  return (
    <StepLayout
      title="Welcome to SmartHole"
      description="Your intelligent voice-powered command router"
    >
      <div className="welcome-content">
        <div className="welcome-logo">
          <svg
            className="welcome-logo-icon"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" />
            <path
              d="M32 20V44M32 44L24 36M32 44L40 36"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="welcome-features">
          <div className="welcome-feature">
            <div className="welcome-feature-icon">
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
                  d="M12 18V22M8 22H16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span>Voice Commands</span>
          </div>
          <div className="welcome-feature">
            <div className="welcome-feature-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span>Smart Routing</span>
          </div>
          <div className="welcome-feature">
            <div className="welcome-feature-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M9 9H15M9 15H15M9 12H15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span>App Plugins</span>
          </div>
        </div>

        <p className="welcome-text">
          SmartHole listens for your voice commands and routes them to the right application using
          AI. Let&apos;s get you set up in just a few steps.
        </p>

        <button
          type="button"
          className="onboarding-button onboarding-button--primary"
          onClick={onNext}
        >
          Get Started
        </button>
      </div>
    </StepLayout>
  );
}
