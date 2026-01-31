/**
 * Tray menu template building logic.
 * Extracted to a separate module for testability without Electron dependencies.
 */

import { InputState } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Input state for building the tray menu template.
 * Extracted to enable unit testing without Electron dependencies.
 */
export interface TrayMenuState {
  clientCount: number;
  connectedClients: { name: string; description?: string }[];
  currentInputState: InputState;
  isRecording: boolean;
}

/**
 * Actions that can be triggered from the tray menu.
 * Click handlers are injected to enable testing.
 */
export interface TrayMenuActions {
  onOpenTextInput: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSettings: () => void;
  onAbout: () => void;
  onQuit: () => void;
}

/**
 * Menu item constructor options compatible with Electron.
 * Redefined here to avoid Electron import in test environment.
 */
export interface MenuItemOptions {
  label?: string;
  type?: "separator" | "normal" | "submenu";
  enabled?: boolean;
  sublabel?: string;
  click?: () => void;
  submenu?: MenuItemOptions[];
}

// ============================================================================
// Template Building
// ============================================================================

/**
 * Builds the tray menu template from state and actions.
 * This is a pure function that can be tested without Electron.
 *
 * @param state - Current application state for the menu
 * @param actions - Click handlers for menu items
 * @returns Array of menu item options
 */
export function buildTrayMenuTemplate(
  state: TrayMenuState,
  actions: TrayMenuActions
): MenuItemOptions[] {
  const { clientCount, connectedClients, currentInputState, isRecording } = state;

  // Build menu template with client status
  const template: MenuItemOptions[] = [
    {
      label: `${clientCount} client${clientCount !== 1 ? "s" : ""} connected`,
      enabled: false, // Display-only label
    },
  ];

  // Add connected clients submenu when clients are connected
  if (clientCount > 0) {
    template.push({
      label: "Connected Clients",
      submenu: connectedClients.map((client) => ({
        label: client.name,
        sublabel: client.description,
        enabled: false,
      })),
    });
  }

  // Add separator and input menu items
  template.push({ type: "separator" });

  // Open Text Input menu item
  // Disabled during PROCESSING to avoid conflicting with pending audio processing
  template.push({
    label: "Open Text Input",
    click: actions.onOpenTextInput,
    enabled: currentInputState !== InputState.PROCESSING,
  });

  // Recording toggle menu item - label and behavior depend on current state
  const recordingItem: MenuItemOptions = isRecording
    ? {
        label: "Stop Recording",
        click: actions.onStopRecording,
        // Only enabled when actually in RECORDING state (not during transitions)
        enabled: currentInputState === InputState.RECORDING,
      }
    : {
        label: "Start Recording",
        click: actions.onStartRecording,
        // Only enabled when in IDLE state
        enabled: currentInputState === InputState.IDLE,
      };
  template.push(recordingItem);

  // Add separator and standard menu items
  template.push(
    { type: "separator" },
    {
      label: "Settings...",
      click: actions.onSettings,
    },
    {
      label: "About SmartHole",
      click: actions.onAbout,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: actions.onQuit,
    }
  );

  return template;
}
