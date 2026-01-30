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

## Goal

Configure Vite and Electron Forge to build the popup window's preload script and renderer, ensuring both development and production builds work correctly.

## Key Files to Create/Modify

| File                                                                 | Purpose                            |
| -------------------------------------------------------------------- | ---------------------------------- |
| `/Users/zach/code/smarthole-desktop/vite.popup-preload.config.ts`    | Create - Preload config for popup  |
| `/Users/zach/code/smarthole-desktop/vite.popup-renderer.config.ts`   | Create - Renderer config for popup |
| `/Users/zach/code/smarthole-desktop/forge.config.ts`                 | Modify - Add popup build entries   |
| `/Users/zach/code/smarthole-desktop/src/windows/text-input-popup.ts` | Modify - Correct path resolution   |

## Patterns to Follow

Follow existing Vite config patterns:

- `vite.preload.config.ts` for preload script configuration
- `vite.renderer.config.ts` for renderer (React) configuration
- `forge.config.ts` VitePlugin structure for multiple entry points

## Implementation Details

### 1. vite.popup-preload.config.ts

Create new file:

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron"],
    },
  },
});
```

### 2. vite.popup-renderer.config.ts

Create new file:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

### 3. Update forge.config.ts

Modify the VitePlugin configuration to add popup entries:

```typescript
import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "SmartHole",
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({
      format: "ULFO",
    }),
  ],
  plugins: [
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
        // NEW: Add popup preload entry
        {
          entry: "src/preload-popup.ts",
          config: "vite.popup-preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
        // NEW: Add popup renderer entry
        {
          name: "popup_window",
          config: "vite.popup-renderer.config.ts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
```

### 4. Update text-input-popup.ts Path Resolution

The Electron Forge VitePlugin provides environment variables for accessing renderer dev server URLs and preload paths. Update the path resolution:

```typescript
/**
 * Gets the preload script path for the popup window.
 * Uses Electron Forge VitePlugin conventions.
 */
function getPreloadPath(): string {
  // In dev, Vite outputs preload to .vite/build directory
  // In prod, it's bundled alongside main
  // The VitePlugin handles this automatically via __dirname resolution
  return path.join(__dirname, "preload-popup.js");
}

/**
 * Gets the URL/path to load for the popup window.
 * Uses Electron Forge VitePlugin environment variables.
 */
function getPopupUrl(): string {
  // The VitePlugin sets POPUP_WINDOW_VITE_DEV_SERVER_URL in dev mode
  // Format: {NAME}_VITE_DEV_SERVER_URL where NAME is uppercase renderer name
  if (process.env.POPUP_WINDOW_VITE_DEV_SERVER_URL) {
    return process.env.POPUP_WINDOW_VITE_DEV_SERVER_URL;
  }

  // In production, use file path
  // VitePlugin sets POPUP_WINDOW_VITE_NAME for the renderer output directory
  return path.join(
    __dirname,
    `../renderer/${process.env.POPUP_WINDOW_VITE_NAME || "popup_window"}/index.html`
  );
}
```

### 5. Ensure popup/index.html is the entry point

The VitePlugin expects an `index.html` at the root of each renderer entry. Make sure the popup renderer config points to the right entry:

In `vite.popup-renderer.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, "src/popup"),
  build: {
    outDir: path.join(__dirname, ".vite/renderer/popup_window"),
  },
});
```

### 6. Directory Structure

After implementation, the popup-related files should be:

```
src/
├── popup/
│   ├── index.html      # Popup HTML entry
│   ├── popup.tsx       # Popup React component
│   └── popup.css       # Popup styles
├── preload-popup.ts    # Popup preload script
└── windows/
    └── text-input-popup.ts  # Popup window management

vite.popup-preload.config.ts   # Popup preload build config
vite.popup-renderer.config.ts  # Popup renderer build config
forge.config.ts                # Updated with popup entries
```

### 7. Verify Dev Mode

After changes, run:

```bash
mise run dev
```

Verify:

- [ ] No build errors for popup preload
- [ ] No build errors for popup renderer
- [ ] Vite dev servers start for both main_window and popup_window
- [ ] Console shows POPUP_WINDOW_VITE_DEV_SERVER_URL being set

### 8. Verify Production Build

After changes, run:

```bash
mise run build
```

Verify:

- [ ] Build completes without errors
- [ ] `.vite/build/preload-popup.js` exists
- [ ] `.vite/renderer/popup_window/index.html` exists
- [ ] Packaged app includes popup assets

## TypeScript Configuration

Ensure `tsconfig.json` includes the new popup files:

```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/popup/**/*.ts", "src/popup/**/*.tsx"]
}
```

## Acceptance Criteria

- [ ] `vite.popup-preload.config.ts` created
- [ ] `vite.popup-renderer.config.ts` with React plugin and correct root
- [ ] `forge.config.ts` updated with popup preload entry
- [ ] `forge.config.ts` updated with popup_window renderer entry
- [ ] `text-input-popup.ts` uses correct path resolution
- [ ] Dev mode works (`mise run dev`) - no errors
- [ ] Production build works (`mise run build`) - no errors
- [ ] Path resolution works in both dev and prod
- [ ] Popup window loads correctly in dev mode
- [ ] Popup window loads correctly in packaged app
- [ ] Quality checks pass: `mise run quality`

## Dependencies

- T-create-popup-preload-script (popup files must exist for build to succeed)

## Estimated Complexity

Medium - Build configuration, path resolution for dev/prod environments.

## Troubleshooting

### Common Issues

1. **"Cannot find module 'preload-popup.js'"**
   - Check that the preload entry is in `forge.config.ts` build array
   - Verify the path in `getPreloadPath()` is correct

2. **"POPUP_WINDOW_VITE_DEV_SERVER_URL is undefined"**
   - Ensure the renderer entry `name` is exactly `popup_window`
   - Restart the dev server after config changes

3. **"index.html not found" in production**
   - Check `vite.popup-renderer.config.ts` has correct `root` and `outDir`
   - Verify the renderer name matches in both config and path resolution

4. **CSS not loading in popup**
   - Ensure `popup.css` is imported in `popup.tsx`
   - Check Vite is processing CSS (should be automatic with React plugin)
