interface ProgressIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function ProgressIndicator({ steps, currentStep }: ProgressIndicatorProps): React.ReactNode {
  return (
    <div className="progress-indicator">
      {steps.map((label, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const stepClasses = [
          "progress-step",
          isCompleted ? "progress-step--completed" : "",
          isCurrent ? "progress-step--current" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div key={label} className={stepClasses}>
            <div className="progress-step-dot">
              {isCompleted ? (
                <svg
                  className="progress-step-check"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13.5 4.5L6.5 11.5L3 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span className="progress-step-number">{index + 1}</span>
              )}
            </div>
            <span className="progress-step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
