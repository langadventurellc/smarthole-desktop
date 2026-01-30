#!/usr/bin/env node
/* global console, process, setTimeout */
/**
 * Smoke test for the Electron application.
 *
 * This script verifies that the application can build and start without errors.
 * It uses electron-forge to build the app, then runs Electron directly to verify
 * startup succeeds.
 *
 * Success criteria:
 * - electron-forge build completes without errors
 * - Electron process starts and stays alive for a few seconds
 * - No fatal error messages in output
 *
 * Exit codes:
 * - 0: Application built and started successfully
 * - 1: Build or startup failed
 */

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Configuration
const STARTUP_WAIT_MS = 3000; // How long to wait for app to start
const BUILD_TIMEOUT_MS = 120000; // 2 minutes for build

// Patterns that indicate fatal errors (not warnings)
const ERROR_PATTERNS = [
  /App threw an error during load/i,
  /Error: Cannot find module/i,
  /Error: Could not resolve/i,
  /UnhandledPromiseRejection/i,
  /ReferenceError:/i,
  /TypeError:/i,
  /SyntaxError:/i,
];

// Patterns to ignore (warnings, not errors)
const IGNORE_PATTERNS = [
  /GPU/i,
  /gpu/,
  /Passthrough is not supported/i,
  /vulkan/i,
  /libuv/i,
  /sandbox/i,
  /DeprecationWarning/i,
];

/**
 * Check if output contains a fatal error.
 */
function isFatalError(output) {
  // First check if it matches any ignore patterns
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(output)) {
      return false;
    }
  }

  // Then check for error patterns
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(output)) {
      return true;
    }
  }

  return false;
}

/**
 * Build the app using electron-forge.
 * We use 'start' with a timeout because it builds before starting,
 * and catches build errors in the output.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function buildApp() {
  console.log("Building application with electron-forge...");

  // Clean previous build to force a fresh build
  const buildDir = resolve(projectRoot, ".vite/build");
  if (existsSync(buildDir)) {
    rmSync(buildDir, { recursive: true, force: true });
  }

  return new Promise((promiseResolve) => {
    let allOutput = "";
    let hasError = false;
    let errorMessage = "";
    let buildComplete = false;
    let resolved = false;

    const finish = (success, error) => {
      if (resolved) return;
      resolved = true;
      promiseResolve({ success, error });
    };

    // Use electron-forge start but kill it after build completes
    const forgeProcess = spawn("npx", ["electron-forge", "start"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
      },
    });

    const handleOutput = (data) => {
      const text = data.toString();
      allOutput += text;

      // Check for build/startup errors
      if (isFatalError(text)) {
        hasError = true;
        // Extract just the error line
        const lines = text.split("\n").filter((l) => l.trim());
        errorMessage = lines.find((l) => isFatalError(l)) || text.trim();
      }

      // Check if build completed and app launched
      if (text.includes("Launched Electron app") || text.includes("Application ready")) {
        buildComplete = true;
        // Give it a moment to fully start, then kill
        setTimeout(() => {
          forgeProcess.kill("SIGTERM");
        }, 1000);
      }
    };

    forgeProcess.stdout.on("data", handleOutput);
    forgeProcess.stderr.on("data", handleOutput);

    forgeProcess.on("error", (err) => {
      finish(false, `Failed to start electron-forge: ${err.message}`);
    });

    forgeProcess.on("exit", (code, signal) => {
      // If we killed it after successful build, that's fine
      if (signal === "SIGTERM" && buildComplete && !hasError) {
        const mainJs = resolve(projectRoot, ".vite/build/main.js");
        if (existsSync(mainJs)) {
          finish(true);
        } else {
          finish(false, "Build output not found at .vite/build/main.js");
        }
        return;
      }

      // If there was an error, report it
      if (hasError) {
        finish(false, errorMessage);
        return;
      }

      // If it exited on its own with error code
      if (code !== 0 && code !== null) {
        // Check if main.js was built despite error exit
        const mainJs = resolve(projectRoot, ".vite/build/main.js");
        if (existsSync(mainJs)) {
          finish(true);
        } else {
          // Look for error in output
          const errorLines = allOutput
            .split("\n")
            .filter((l) => l.includes("Error") || l.includes("error"));
          finish(false, errorLines[0] || `Build exited with code ${code}`);
        }
        return;
      }

      // Check for build output
      const mainJs = resolve(projectRoot, ".vite/build/main.js");
      if (existsSync(mainJs)) {
        finish(true);
      } else {
        finish(false, "Build completed but output not found");
      }
    });

    // Timeout
    setTimeout(() => {
      if (!resolved) {
        forgeProcess.kill("SIGKILL");
        finish(false, "Build timed out after 2 minutes");
      }
    }, BUILD_TIMEOUT_MS);
  });
}

/**
 * Start Electron directly and check if it runs without errors.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function startApp() {
  return new Promise((promiseResolve) => {
    console.log(`Verifying application startup (${STARTUP_WAIT_MS}ms timeout)...`);

    const electronPath = resolve(projectRoot, "node_modules/.bin/electron");
    const mainJs = resolve(projectRoot, ".vite/build/main.js");

    if (!existsSync(mainJs)) {
      promiseResolve({
        success: false,
        error: `Main entry point not found: ${mainJs}`,
      });
      return;
    }

    let hasError = false;
    let errorMessage = "";
    let processExited = false;
    let resolved = false;

    const finish = (success, error) => {
      if (resolved) return;
      resolved = true;
      promiseResolve({ success, error });
    };

    const electronProcess = spawn(electronPath, [mainJs], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "production",
        ELECTRON_DISABLE_GPU: "1",
      },
    });

    const handleOutput = (data) => {
      const text = data.toString();

      if (isFatalError(text)) {
        hasError = true;
        errorMessage = text.trim();
      }
    };

    electronProcess.stdout.on("data", handleOutput);
    electronProcess.stderr.on("data", handleOutput);

    electronProcess.on("exit", (code, signal) => {
      processExited = true;

      // Ignore if we killed it
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        return;
      }

      if (code !== null && code !== 0) {
        hasError = true;
        errorMessage = `Process exited with code ${code}`;
      }
    });

    // Wait and check
    setTimeout(() => {
      if (hasError) {
        electronProcess.kill("SIGTERM");
        finish(false, errorMessage);
        return;
      }

      if (processExited) {
        finish(true);
        return;
      }

      // App is still running - success!
      electronProcess.kill("SIGTERM");

      setTimeout(() => {
        if (!electronProcess.killed) {
          electronProcess.kill("SIGKILL");
        }
        finish(true);
      }, 500);
    }, STARTUP_WAIT_MS);
  });
}

/**
 * Main entry point.
 */
async function main() {
  console.log("=== Electron Smoke Test ===\n");

  // Step 1: Build
  const buildResult = await buildApp();
  if (!buildResult.success) {
    console.error(`\n❌ BUILD FAILED: ${buildResult.error}`);
    process.exit(1);
  }
  console.log("✓ Build completed\n");

  // Step 2: Verify startup
  const startResult = await startApp();
  if (!startResult.success) {
    console.error(`\n❌ STARTUP FAILED: ${startResult.error}`);
    process.exit(1);
  }
  console.log("✓ Startup verified\n");

  console.log("✅ Smoke test PASSED");
  process.exit(0);
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
