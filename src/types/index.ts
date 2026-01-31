/**
 * Type definitions barrel export for SmartHole application.
 * Import all shared types from this module.
 *
 * @example
 * ```ts
 * import { Result, MessageId, createMessageId } from '../types';
 * ```
 */

export * from "./audio";
export * from "./common";
export * from "./config";
export * from "./credentials";
export * from "./errors";
export * from "./hotkey";
export * from "./input";
export * from "./ipc";
export * from "./messages";
export * from "./guards";
export * from "./client-registry";

// NOTE: ElectronAPI is NOT exported here to avoid bundling preload into main.
// Import directly from "../preload/main" if needed in renderer code.
