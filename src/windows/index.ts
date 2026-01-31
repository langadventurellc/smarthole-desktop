/**
 * Window management services.
 */

export {
  initializeTextInputPopup,
  getTextInputPopup,
  resetTextInputPopup,
  getTextInputPopupImpl,
  calculateCenteredPosition,
  type TextInputPopupService,
  type TextInputPopupEvents,
} from "./text-input-popup";

export {
  initializeSettingsWindow,
  getSettingsWindow,
  resetSettingsWindow,
  type SettingsWindowService,
} from "./settings-window";

export {
  initializeOnboardingWindow,
  getOnboardingWindow,
  resetOnboardingWindow,
  type OnboardingWindowService,
} from "./onboarding-window";
