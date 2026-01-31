import { useState, useEffect, useCallback } from "react";
import type { SttBackend, AppConfig } from "../types/config";
import {
  ProgressIndicator,
  WelcomeStep,
  PermissionsStep,
  SttStep,
  AiStep,
  CompleteStep,
} from "./components";

const STEPS = ["Welcome", "Permissions", "Speech", "AI", "Complete"];

type OnboardingStep = 0 | 1 | 2 | 3 | 4;

interface OnboardingState {
  currentStep: OnboardingStep;
  sttBackend: SttBackend;
  localWhisperPath: string;
}

const DEFAULT_STATE: OnboardingState = {
  currentStep: 0,
  sttBackend: "cloud",
  localWhisperPath: "",
};

export function OnboardingApp(): React.ReactNode {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial config and state on mount
  useEffect(() => {
    let mounted = true;

    async function loadInitialState(): Promise<void> {
      try {
        const response = await window.electronAPI.getConfig();
        const config: AppConfig = response.config;

        if (mounted) {
          setState((prev) => ({
            ...prev,
            sttBackend: config.stt.backend,
            localWhisperPath: config.stt.localWhisperPath || "",
          }));
        }
      } catch (error) {
        console.error("Failed to load config:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialState();

    return () => {
      mounted = false;
    };
  }, []);

  const goToStep = useCallback((step: OnboardingStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, 4) as OnboardingStep,
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0) as OnboardingStep,
    }));
  }, []);

  const handleSttBackendChange = useCallback(async (backend: SttBackend) => {
    setState((prev) => ({ ...prev, sttBackend: backend }));
    // Save immediately to config
    try {
      await window.electronAPI.setConfig({ stt: { backend } });
    } catch (error) {
      console.error("Failed to save STT backend:", error);
    }
  }, []);

  const handleLocalPathChange = useCallback(async (path: string) => {
    setState((prev) => ({ ...prev, localWhisperPath: path }));
    // Save immediately to config
    try {
      await window.electronAPI.setConfig({ stt: { localWhisperPath: path } });
    } catch (error) {
      console.error("Failed to save Whisper path:", error);
    }
  }, []);

  const handleFinish = useCallback(() => {
    // Close the onboarding window via IPC
    window.electronAPI.closeOnboardingWindow();
  }, []);

  const handleSkip = useCallback(() => {
    // Skip to the complete step
    goToStep(4);
  }, [goToStep]);

  if (isLoading) {
    return (
      <div className="onboarding-container">
        <div className="onboarding-loading">
          <div className="onboarding-loading-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-container">
      <header className="onboarding-header">
        <ProgressIndicator steps={STEPS} currentStep={state.currentStep} />
      </header>

      <main className="onboarding-content">
        {state.currentStep === 0 && <WelcomeStep onNext={nextStep} />}

        {state.currentStep === 1 && (
          <PermissionsStep onNext={nextStep} onBack={prevStep} onSkip={handleSkip} />
        )}

        {state.currentStep === 2 && (
          <SttStep
            backend={state.sttBackend}
            localWhisperPath={state.localWhisperPath}
            onBackendChange={handleSttBackendChange}
            onLocalPathChange={handleLocalPathChange}
            onNext={nextStep}
            onBack={prevStep}
            onSkip={handleSkip}
          />
        )}

        {state.currentStep === 3 && (
          <AiStep onNext={nextStep} onBack={prevStep} onSkip={handleSkip} />
        )}

        {state.currentStep === 4 && <CompleteStep onFinish={handleFinish} onBack={prevStep} />}
      </main>
    </div>
  );
}
