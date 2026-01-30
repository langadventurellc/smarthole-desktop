---
id: T-update-build-configuration
title: Update build configuration for popup window
status: open
priority: medium
parent: F-text-input-popup-window
prerequisites:
  - T-create-popup-preload-script
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T23:42:43.741Z
updated: 2026-01-30T23:42:43.741Z
---

# Update Build Configuration for Popup Window

## Context

The Text Input Popup requires build configuration updates to:

1. Build the popup preload script separately
2. Include the popup renderer as a separate entry point
3. Ensure assets are properly bundled for distribution

**Reference**:

- Feature spec: F-text-input-popup-window
- Build config: `forge.config.ts`, `vite.*.config.ts`

## Implementation Requirements

### 1. Add Popup Preload Build Target

Update `forge.config.ts` to build the popup preload script:

```typescript
new VitePlugin({
  build: [
    {
      entry: "src/main.ts",
      config: "vite.main.config.ts",
      target: "main",
    },
    {
      entry: "src/preload.ts",
      config: "vite.preload.config.ts",
      target: "preload",
    },
    // Add popup preload
    {
      entry: "src/preload-popup.ts",
      config: "vite.preload.config.ts", // Reuse existing preload config
      target: "preload",
    },
  ],
  renderer: [
    {
      name: "main_window",
      config: "vite.renderer.config.ts",
    },
    // Add popup renderer
    {
      name: "popup_window",
      config: "vite.popup.config.ts",
    },
  ],
}),
```

### 2. Create Popup Vite Config

Create `vite.popup.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: "src/popup/index.html",
    },
  },
});
```

### 3. Update Window Service Path

Ensure `src/windows/text-input-popup.ts` uses correct paths:

- Preload: Use Vite's generated path for `preload-popup.js`
- HTML: Use Vite's dev server URL in dev mode, file path in production

The window service should use `MAIN_WINDOW_VITE_DEV_SERVER_URL` pattern for dev/prod handling (see how main renderer handles this).

### 4. Verify Build Output

After configuration:

- `mise run build` should produce popup assets
- Preload script should be in correct location
- HTML and JS should be bundled

## Files to Create

- `vite.popup.config.ts` - Vite config for popup renderer

## Files to Modify

- `forge.config.ts` - Add popup build targets

## Acceptance Criteria

- [ ] `mise run dev` serves popup renderer correctly
- [ ] `mise run build` includes popup assets in distribution
- [ ] Popup preload script builds to correct location
- [ ] Window service can load popup HTML in both dev and production modes
- [ ] No build warnings or errors
- [ ] Passes `mise run quality`

## Testing Requirements

- Verify `mise run dev` starts without errors
- Verify `mise run build` completes and includes popup files
- Manual verification that popup loads correctly

## Out of Scope

- Window management logic (T-create-text-input-popup)
- Popup UI implementation (T-create-popup-preload-script)
- IPC handlers (T-add-text-input-ipc-handlers)
