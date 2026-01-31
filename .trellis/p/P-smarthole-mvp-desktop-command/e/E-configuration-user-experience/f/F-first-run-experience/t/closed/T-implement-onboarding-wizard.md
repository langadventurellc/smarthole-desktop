---
id: T-implement-onboarding-wizard
title: Implement onboarding wizard React UI
status: done
priority: high
parent: F-first-run-experience
prerequisites:
  - T-add-permission-ipc-infrastruct
  - T-create-onboarding-window
affectedFiles:
  src/onboarding/OnboardingApp.tsx: Completely rewritten with wizard state
    management, step navigation, config loading, and STT config persistence
  src/onboarding/OnboardingApp.test.tsx: Created 9 unit tests for wizard
    functionality including navigation, skip, and config saving
  src/onboarding/index.css: Expanded with comprehensive wizard styles including
    progress indicator, step layouts, permission cards, buttons, and form
    elements
  src/onboarding/components/index.ts: Created exports for all onboarding components
  src/onboarding/components/ProgressIndicator.tsx: Created step indicator with
    completion state, current step highlight, and step labels
  src/onboarding/components/StepLayout.tsx: Created consistent layout wrapper with title, description, and content areas
  src/onboarding/components/WelcomeStep.tsx: Created welcome screen with app logo,
    feature highlights, and Get Started button
  src/onboarding/components/PermissionsStep.tsx: Created permissions step with
    microphone request, accessibility check (macOS), and polling for permission
    changes
  src/onboarding/components/SttStep.tsx: Created STT configuration with backend
    selection (cloud/local), API key input, and Whisper path selection
  src/onboarding/components/AiStep.tsx: Created Anthropic API key configuration with explanation and secure input
  src/onboarding/components/CompleteStep.tsx: Created completion step with
    configuration summary, status icons, and Finish button that sets
    firstRunCompleted
log:
  - >-
    Research phase completed. Verified patterns from:

    - src/settings/App.tsx - React app structure, config loading, credential
    management patterns

    - src/settings/components/* - Reusable input components (SecretInput,
    SelectInput, PathInput)

    - src/settings/index.css - Complete styling patterns for settings UI

    - src/onboarding/OnboardingApp.tsx - Placeholder component to replace

    - src/onboarding/index.css - Basic styling started, needs expansion

    - src/preload/main.ts - Full electronAPI interface with permission methods

    - src/types/config.ts - AppConfig type with firstRunCompleted field

    - src/types/credentials.ts - CredentialKey type for API keys


    Plan:

    1. Update src/onboarding/index.css with wizard-specific styles (reusing
    settings patterns)

    2. Create src/onboarding/components/ directory

    3. Create ProgressIndicator.tsx - step dots/numbers with labels

    4. Create StepLayout.tsx - consistent wrapper for all steps

    5. Create WelcomeStep.tsx - intro message with app logo

    6. Create PermissionsStep.tsx - microphone/accessibility permission handling

    7. Create SttStep.tsx - STT backend selection (reuse SelectInput,
    SecretInput, PathInput)

    8. Create AiStep.tsx - Anthropic API key (reuse SecretInput)

    9. Create CompleteStep.tsx - success message and finish button

    10. Rewrite OnboardingApp.tsx with wizard state management and navigation

    11. Add tests for wizard components


    Starting implementation...
  - >-
    Implementation completed successfully:


    1. Created shared components:
       - ProgressIndicator.tsx - step dots with completion state and labels
       - StepLayout.tsx - consistent wrapper for all steps

    2. Created step components:
       - WelcomeStep.tsx - welcome message with app logo and "Get Started" button
       - PermissionsStep.tsx - microphone and accessibility permission handling with polling
       - SttStep.tsx - STT backend selection (cloud/local) with API key and path inputs
       - AiStep.tsx - Anthropic API key configuration
       - CompleteStep.tsx - success summary with configuration status

    3. Updated OnboardingApp.tsx:
       - Wizard state management with currentStep, sttBackend, localWhisperPath
       - Navigation: nextStep, prevStep, goToStep
       - Skip functionality that jumps to complete step
       - Config loading on mount
       - Immediate save of STT settings when changed

    4. Updated index.css with comprehensive wizard styling:
       - Progress indicator styles
       - Step layout styles
       - Permission card styles
       - Backend option radio buttons
       - Button variants (primary, secondary, text, danger)
       - Light/dark theme support
       - Accessibility features

    5. Added 9 unit tests covering:
       - Loading state
       - Welcome step rendering
       - Config loading
       - Step navigation
       - Back button
       - Skip functionality
       - STT config saving
       - Error handling

    All 980 tests pass. All quality checks pass.
  - "Implemented the complete onboarding wizard React UI with a 5-step flow:
    Welcome, Permissions, Speech-to-Text, AI Configuration, and Complete.
    Created 7 new React components (ProgressIndicator, StepLayout, WelcomeStep,
    PermissionsStep, SttStep, AiStep, CompleteStep) and updated OnboardingApp
    with full wizard state management. The wizard supports navigation
    (next/back/skip), saves configuration changes immediately, handles
    permission requests with polling for accessibility, and displays a
    configuration summary on completion. Added comprehensive CSS styling with
    light/dark theme support and 9 unit tests."
schema: v1.0
childrenIds: []
created: 2026-01-31T16:47:28.937Z
updated: 2026-01-31T16:47:28.937Z
---

# Implement Onboarding Wizard React UI

## Overview

Create the React components for the multi-step onboarding wizard that guides new users through initial setup.

## Deliverables

### 1. Main Container (`src/onboarding/OnboardingApp.tsx`)

- Manages wizard state: current step, step completion status
- Provides navigation between steps (Next, Back, Skip)
- Progress indicator showing current step
- Saves progress to config to resume if window closes

### 2. Step Components (`src/onboarding/components/`)

#### WelcomeStep.tsx

- Brief welcome message explaining what SmartHole does
- App logo/icon
- "Get Started" button to proceed

#### PermissionsStep.tsx

- Microphone permission section:
  - Shows current status (granted/denied/not-determined)
  - Explanation of why it's needed
  - "Grant Access" button that calls `window.electronAPI.requestMicrophonePermission()`
  - Success/error state indication
- Accessibility permission section (macOS only):
  - Shows current status
  - Explanation of why it's needed for global hotkeys
  - "Open Settings" button that calls `window.electronAPI.openAccessibilitySettings()`
  - Instructions for enabling in System Preferences
  - Polling to detect when user grants permission

#### SttStep.tsx

- Backend selection (Cloud vs Local) using SelectInput pattern
- Cloud mode: SecretInput for STT API key
- Local mode: PathInput for Whisper installation path
- Saves to config immediately when changed

#### AiStep.tsx

- SecretInput for Anthropic API key
- Brief explanation of what the routing agent does
- Model selection (optional, can use default)

#### CompleteStep.tsx

- Success message
- Summary of configured items
- "Finish" button that marks `firstRunCompleted: true` and closes window
- Mention that settings can be changed later via tray menu

### 3. Shared Components

#### ProgressIndicator.tsx

- Shows step numbers/dots with current step highlighted
- Step labels: "Welcome", "Permissions", "Speech", "AI", "Complete"

#### StepLayout.tsx

- Consistent layout wrapper for all steps
- Title, description area, content area, navigation footer

### 4. Styling (`src/onboarding/index.css`)

- Match the settings window aesthetic
- Clean, welcoming design
- Clear visual hierarchy for each step
- Responsive button states

## Technical Notes

- Reuse existing input components from `src/settings/components/` where possible
- Use `window.electronAPI` for all IPC operations (permissions, config, credentials)
- Platform detection: `navigator.platform` for macOS-specific UI
- Keep total flow under 2 minutes for typical user

## Acceptance Criteria

- [ ] OnboardingApp manages wizard state and navigation
- [ ] All five step components implemented
- [ ] Progress indicator shows current step
- [ ] Back/Next/Skip navigation works correctly
- [ ] Permissions step correctly requests/checks permissions
- [ ] STT step saves backend choice and credentials
- [ ] AI step saves API key
- [ ] Complete step marks firstRunCompleted and closes window
- [ ] Skip functionality available at each step
- [ ] Styling matches application aesthetic
