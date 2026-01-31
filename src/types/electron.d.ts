/**
 * Type declarations for the Electron API exposed to the renderer process.
 * This augments the global Window interface to include the typed electronAPI.
 *
 * @example
 * ```ts
 * // In renderer code, window.electronAPI is fully typed:
 * window.electronAPI.logInfo("Hello from renderer");
 * const { config } = await window.electronAPI.getConfig();
 * ```
 */

import type { ElectronAPI } from "../preload";
import type { PopupAPI } from "../preload-popup";

declare global {
  interface Window {
    /**
     * The Electron API exposed via contextBridge in preload.ts.
     * Provides type-safe access to main process functionality.
     */
    electronAPI: ElectronAPI;

    /**
     * The Popup API exposed via contextBridge in preload-popup.ts.
     * Provides type-safe access for the text input popup window.
     */
    popupAPI: PopupAPI;
  }
}

// This empty export makes this file a module, which is required for global augmentation
export {};
