---
id: T-create-onboarding-window
title: Create onboarding window management service
status: done
priority: high
parent: F-first-run-experience
prerequisites: []
affectedFiles:
  src/windows/onboarding-window.ts: Created onboarding window service with
    BrowserWindow management, singleton pattern, show/hide/isVisible/getWindow
    methods, escape key handling, and cleanup on app quit
  src/windows/onboarding-window.test.ts: Created 23 unit tests covering singleton
    lifecycle, show behavior, hide behavior, visibility, getWindow, escape key
    handling, window closed events, and app cleanup
  src/windows/index.ts: Added exports for initializeOnboardingWindow,
    getOnboardingWindow, resetOnboardingWindow, and OnboardingWindowService type
  vite.onboarding-renderer.config.ts: Created Vite config for onboarding renderer
    with react plugin and root set to src/onboarding
  forge.config.ts: Added onboarding_window entry to renderer array in VitePlugin configuration
  src/onboarding/index.html: Created HTML entry point for onboarding window
  src/onboarding/renderer.tsx: Created React renderer entry point
  src/onboarding/OnboardingApp.tsx: Created minimal OnboardingApp component placeholder
  src/onboarding/index.css: Created CSS styles for onboarding window with light/dark theme support
log:
  - >-
    Research phase completed. Verified patterns from:

    - src/windows/settings-window.ts - window service pattern with singleton
    management

    - forge.config.ts - renderer array pattern for Vite entry points

    - vite.settings-renderer.config.ts - simple Vite config pattern

    - src/settings/ - HTML, renderer.tsx, index.css patterns

    - src/windows/settings-window.test.ts - test pattern with mocked Electron


    Plan:

    1. Create src/windows/onboarding-window.ts (following settings-window
    pattern)

    2. Add vite.onboarding-renderer.config.ts

    3. Update forge.config.ts with onboarding_window entry

    4. Create src/onboarding/index.html, renderer.tsx, OnboardingApp.tsx,
    index.css

    5. Update src/windows/index.ts exports

    6. Create src/windows/onboarding-window.test.ts
  - >-
    Implementation completed successfully:

    - Created src/windows/onboarding-window.ts with full window service

    - Created vite.onboarding-renderer.config.ts for Vite build

    - Updated forge.config.ts with onboarding_window renderer entry

    - Created src/onboarding/index.html, renderer.tsx, OnboardingApp.tsx,
    index.css

    - Updated src/windows/index.ts with exports

    - Created src/windows/onboarding-window.test.ts with 23 tests


    All quality checks pass. All 971 tests pass (including 23 new tests).
  - >-
    Created onboarding window management service following the settings-window
    pattern. The implementation includes:

    - OnboardingWindowService interface with show(), hide(), isVisible(),
    getWindow() methods

    - OnboardingWindowImpl class with 600x500 fixed dimensions, centered on
    screen, non-resizable

    - Singleton management with initializeOnboardingWindow(),
    getOnboardingWindow(), resetOnboardingWindow()

    - Vite configuration for onboarding renderer build

    - Minimal React entry points (OnboardingApp placeholder, renderer.tsx,
    index.html, index.css)

    - Exports added to src/windows/index.ts

    - 23 unit tests covering singleton lifecycle, show/hide behavior, visibility
    state, escape key handling, and cleanup
schema: v1.0
childrenIds: []
created: 2026-01-31T16:47:28.789Z
updated: 2026-01-31T16:47:28.789Z
---

# Create Onboarding Window Management Service

## Overview

Create the BrowserWindow management service for the onboarding window, following the established pattern from `src/windows/settings-window.ts`.

## Deliverables

### 1. Create Window Service (`src/windows/onboarding-window.ts`)

Follow the settings-window.ts pattern:

- `OnboardingWindowService` interface with `show()`, `hide()`, `isVisible()`, `getWindow()` methods
- `OnboardingWindowImpl` class with:
  - Window dimensions: 600x500 (same as settings)
  - Standard frame (not frameless)
  - Center on screen
  - Not resizable (fixed wizard size)
  - Modal-like behavior (blocks interaction with main app)
- Path resolution functions for preload and content URLs
- Singleton management with `initializeOnboardingWindow()`, `getOnboardingWindow()`, `resetOnboardingWindow()`

### 2. Configure Vite Entry Point

Add to `forge.config.ts` renderer array:

```typescript
{
  name: "onboarding_window",
  config: "vite.onboarding-renderer.config.ts",
}
```

Create `vite.onboarding-renderer.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src/onboarding",
  plugins: [react()],
});
```

### 3. Create Onboarding HTML Entry (`src/onboarding/index.html`)

Follow the settings pattern:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to SmartHole</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./renderer.tsx"></script>
  </body>
</html>
```

### 4. Create Minimal Renderer Entry (`src/onboarding/renderer.tsx`)

Basic React entry point:

```typescript
import "./index.css";
import { createRoot } from "react-dom/client";
import { OnboardingApp } from "./OnboardingApp";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<OnboardingApp />);
}
```

### 5. Export from Index (`src/windows/index.ts`)

Add exports for the new window service.

## Technical Notes

- Uses the main preload script (shares permission, config, and credential IPC)
- Vite define constants: `ONBOARDING_WINDOW_VITE_DEV_SERVER_URL`, `ONBOARDING_WINDOW_VITE_NAME`
- Window should be shown centered on screen

## Acceptance Criteria

- [ ] Onboarding window service created following settings-window pattern
- [ ] Vite configuration added for onboarding renderer
- [ ] HTML and minimal React entry points created
- [ ] Window can be created and shown
- [ ] Unit tests for window service
