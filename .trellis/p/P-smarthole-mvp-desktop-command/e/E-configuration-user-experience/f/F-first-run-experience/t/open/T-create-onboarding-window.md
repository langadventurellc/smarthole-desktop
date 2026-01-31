---
id: T-create-onboarding-window
title: Create onboarding window management service
status: open
priority: high
parent: F-first-run-experience
prerequisites: []
affectedFiles: {}
log: []
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
