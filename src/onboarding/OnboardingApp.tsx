/**
 * Main onboarding application component.
 * Provides a multi-step wizard for first-run setup.
 */

export function OnboardingApp(): React.ReactNode {
  return (
    <div className="onboarding-container">
      <header className="onboarding-header">
        <h1 className="onboarding-title">Welcome to SmartHole</h1>
      </header>
      <main className="onboarding-content">
        <p className="onboarding-description">
          Let's get you set up. This wizard will guide you through the initial configuration.
        </p>
      </main>
    </div>
  );
}
