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
    osxSign: {
      identity: process.env.APPLE_IDENTITY,
      optionsForFile: (filePath: string) => {
        // GPU and Renderer helpers should use osx-sign defaults (more restrictive)
        // Main app and Plugin helper need our custom entitlements for native modules and audio
        if (filePath.includes("(GPU).app") || filePath.includes("(Renderer).app")) {
          return {};
        }
        return {
          entitlements: "src/entitlements.plist",
        };
      },
    },
    osxNotarize:
      process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD && process.env.APPLE_TEAM_ID
        ? {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
          }
        : undefined,
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
          entry: "src/preload/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
        {
          entry: "src/preload/popup.ts",
          config: "vite.popup-preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
        {
          name: "popup_window",
          config: "vite.popup-renderer.config.ts",
        },
        {
          name: "settings_window",
          config: "vite.settings-renderer.config.ts",
        },
        {
          name: "onboarding_window",
          config: "vite.onboarding-renderer.config.ts",
        },
        {
          name: "background_window",
          config: "vite.background-renderer.config.ts",
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
