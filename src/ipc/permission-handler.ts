/**
 * IPC permission handlers for checking and requesting system permissions.
 * Used by the onboarding flow to guide users through granting required permissions.
 */

import { IpcMainInvokeEvent, systemPreferences, shell } from "electron";
import type {
  MicrophonePermissionStatus,
  PermissionCheckMicrophoneResponse,
  PermissionRequestMicrophoneResponse,
  PermissionCheckAccessibilityResponse,
  PermissionOpenAccessibilitySettingsResponse,
} from "../types";

/**
 * Valid microphone permission status values from Electron's systemPreferences.
 * Used for runtime validation to handle potential future Electron API changes.
 */
const VALID_MICROPHONE_STATUSES: ReadonlySet<string> = new Set([
  "not-determined",
  "granted",
  "denied",
  "restricted",
]);
import { Logger } from "../services/logger";

/**
 * Creates an IPC handler for PERMISSION_CHECK_MICROPHONE channel.
 * Uses systemPreferences.getMediaAccessStatus('microphone') on macOS.
 * On Windows, microphone access is typically always granted at the OS level.
 */
export function createMicrophoneCheckHandler(
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => Promise<PermissionCheckMicrophoneResponse> {
  return async (_event: IpcMainInvokeEvent): Promise<PermissionCheckMicrophoneResponse> => {
    try {
      let status: MicrophonePermissionStatus;

      if (process.platform === "darwin") {
        // macOS: Use systemPreferences to check microphone access status
        const macStatus = systemPreferences.getMediaAccessStatus("microphone");
        // Validate the returned status in case Electron adds new values in future versions
        status = VALID_MICROPHONE_STATUSES.has(macStatus)
          ? (macStatus as MicrophonePermissionStatus)
          : "unknown";
      } else if (process.platform === "win32") {
        // Windows: Microphone permission is typically always available at OS level
        // The actual permission prompt happens when the app tries to access the device
        status = "granted";
      } else {
        // Linux and other platforms: Assume granted (handled at device level)
        status = "granted";
      }

      ipcLogger.debug("Microphone permission checked", { status, platform: process.platform });

      return { status };
    } catch (error) {
      ipcLogger.error("Failed to check microphone permission", {
        error: error instanceof Error ? error.message : String(error),
      });

      return { status: "unknown" };
    }
  };
}

/**
 * Creates an IPC handler for PERMISSION_REQUEST_MICROPHONE channel.
 * Uses systemPreferences.askForMediaAccess('microphone') on macOS.
 * On Windows, this is a no-op as permission is handled when accessing the device.
 */
export function createMicrophoneRequestHandler(
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => Promise<PermissionRequestMicrophoneResponse> {
  return async (_event: IpcMainInvokeEvent): Promise<PermissionRequestMicrophoneResponse> => {
    try {
      let granted: boolean;

      if (process.platform === "darwin") {
        // macOS: Request microphone access (will show system dialog if not yet determined)
        granted = await systemPreferences.askForMediaAccess("microphone");
      } else {
        // Windows/Linux: Permission is granted at device access time
        // Return true to indicate the request "succeeded" (no OS-level blocking)
        granted = true;
      }

      ipcLogger.info("Microphone permission requested", { granted, platform: process.platform });

      return { granted };
    } catch (error) {
      ipcLogger.error("Failed to request microphone permission", {
        error: error instanceof Error ? error.message : String(error),
      });

      return { granted: false };
    }
  };
}

/**
 * Creates an IPC handler for PERMISSION_CHECK_ACCESSIBILITY channel.
 * Uses systemPreferences.isTrustedAccessibilityClient(false) on macOS.
 * On non-macOS platforms, always returns true (accessibility permissions not required).
 */
export function createAccessibilityCheckHandler(
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => Promise<PermissionCheckAccessibilityResponse> {
  return async (_event: IpcMainInvokeEvent): Promise<PermissionCheckAccessibilityResponse> => {
    try {
      let trusted: boolean;

      if (process.platform === "darwin") {
        // macOS: Check if app is trusted for accessibility
        // Pass false to check without prompting
        trusted = systemPreferences.isTrustedAccessibilityClient(false);
      } else {
        // Windows/Linux: Accessibility permissions not required at OS level
        trusted = true;
      }

      ipcLogger.debug("Accessibility permission checked", { trusted, platform: process.platform });

      return { trusted };
    } catch (error) {
      ipcLogger.error("Failed to check accessibility permission", {
        error: error instanceof Error ? error.message : String(error),
      });

      return { trusted: false };
    }
  };
}

/**
 * Creates an IPC handler for PERMISSION_OPEN_ACCESSIBILITY_SETTINGS channel.
 * Opens System Preferences to the Accessibility pane on macOS.
 * On non-macOS platforms, this is a no-op that returns success.
 */
export function createAccessibilitySettingsHandler(
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => Promise<PermissionOpenAccessibilitySettingsResponse> {
  return async (
    _event: IpcMainInvokeEvent
  ): Promise<PermissionOpenAccessibilitySettingsResponse> => {
    try {
      if (process.platform === "darwin") {
        // macOS: Open System Preferences to Accessibility pane
        // This URL scheme opens the Privacy & Security > Accessibility section
        await shell.openExternal(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        );
        ipcLogger.info("Opened accessibility settings");
      } else {
        // Windows/Linux: No equivalent system settings to open
        ipcLogger.debug("Accessibility settings not applicable on this platform", {
          platform: process.platform,
        });
      }

      return { success: true };
    } catch (error) {
      ipcLogger.error("Failed to open accessibility settings", {
        error: error instanceof Error ? error.message : String(error),
      });

      return { success: false };
    }
  };
}
