---
id: T-implement-onboarding-wizard
title: Implement onboarding wizard React UI
status: open
priority: high
parent: F-first-run-experience
prerequisites:
  - T-add-permission-ipc-infrastruct
  - T-create-onboarding-window
affectedFiles: {}
log: []
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
