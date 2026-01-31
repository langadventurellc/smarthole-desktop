/**
 * IPC handlers for onboarding window communication.
 * Bridges the OnboardingWindowService to IPC channels.
 *
 * @see F-first-run-experience feature specification
 */

import { IpcMainEvent } from "electron";
import { IPC_CHANNELS } from "../types";
import { OnboardingWindowService } from "../windows/onboarding-window";
import { Logger } from "../services/logger";

/**
 * Creates handler for ONBOARDING_CLOSE channel.
 * Handles close request from the onboarding renderer process.
 *
 * @param onboardingGetter - Function to get the onboarding window service
 * @param logger - Logger for debug output
 * @returns Handler function compatible with ipcMain.on()
 */
export function createOnboardingCloseHandler(
  onboardingGetter: () => OnboardingWindowService,
  logger: Logger
): (event: IpcMainEvent) => void {
  return (_event: IpcMainEvent): void => {
    logger.debug("Onboarding close requested via IPC");
    const onboarding = onboardingGetter();
    onboarding.hide();
  };
}

/**
 * Registers all onboarding IPC handlers with ipcMain.
 * Call this after initializing the onboarding window service.
 *
 * @param ipcMain - The Electron ipcMain module
 * @param onboardingGetter - Function to get the onboarding window service
 * @param logger - Logger for debug output
 */
export function registerOnboardingHandlers(
  ipcMain: Electron.IpcMain,
  onboardingGetter: () => OnboardingWindowService,
  logger: Logger
): void {
  ipcMain.on(IPC_CHANNELS.ONBOARDING_CLOSE, createOnboardingCloseHandler(onboardingGetter, logger));
  logger.info("Onboarding IPC handlers registered");
}
