/**
 * Preload script for the text input popup window.
 * Provides a minimal, secure API for the popup renderer.
 *
 * @see F-text-input-popup-window feature specification
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./types";
import type { TextInputSubmitPayload } from "./types";

/**
 * Popup API exposed to the popup renderer process via contextBridge.
 * Provides minimal methods for text input interaction.
 */
const popupAPI = {
  /**
   * Submit text and close the popup.
   * Called when user presses Enter with non-empty text.
   *
   * @param text - The text to submit
   */
  submit: (text: string): void => {
    const payload: TextInputSubmitPayload = {
      text,
      timestamp: new Date().toISOString(),
    };
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_SUBMIT, payload);
  },

  /**
   * Dismiss the popup without submitting.
   * Called when user presses Escape or clicks outside.
   */
  dismiss: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_DISMISSED);
  },

  /**
   * Notify main process that the popup received focus.
   * Used for analytics and state tracking.
   */
  notifyFocused: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TEXT_INPUT_FOCUSED);
  },

  /**
   * Listen for placeholder text updates from main process.
   *
   * @param callback - Function called with new placeholder text
   * @returns Unsubscribe function
   */
  onPlaceholderChange: (callback: (placeholder: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, placeholder: string): void => {
      callback(placeholder);
    };
    ipcRenderer.on("textInput:placeholder", handler);
    return (): void => {
      ipcRenderer.removeListener("textInput:placeholder", handler);
    };
  },

  /**
   * Listen for clear input commands from main process.
   * Called when popup is hidden to reset state for next show.
   *
   * @param callback - Function called when input should be cleared
   * @returns Unsubscribe function
   */
  onClear: (callback: () => void): (() => void) => {
    const handler = (): void => {
      callback();
    };
    ipcRenderer.on("textInput:clear", handler);
    return (): void => {
      ipcRenderer.removeListener("textInput:clear", handler);
    };
  },
};

// Expose the API to the popup renderer process
contextBridge.exposeInMainWorld("popupAPI", popupAPI);

/**
 * Type definition for the popupAPI exposed to renderer.
 * Export this type for use in type declarations.
 */
export type PopupAPI = typeof popupAPI;
