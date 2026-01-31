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
export * from "./errors";
export * from "./hotkey";
export * from "./input";
export * from "./ipc";
export * from "./messages";
export * from "./guards";
export * from "./client-registry";

// Re-export ElectronAPI type from preload for external use
export type { ElectronAPI } from "../preload";
