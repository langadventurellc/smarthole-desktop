#!/usr/bin/env npx tsx

/**
 * Test harness plugin for SmartHole.
 *
 * A standalone WebSocket plugin that connects to SmartHole and echoes messages back.
 * Serves as a reference implementation for plugin developers and enables MVP
 * validation and debugging.
 *
 * Usage:
 *   mise run test-plugin                    # Normal echo behavior
 *   mise run test-plugin -- --reject        # Always reject messages
 *   mise run test-plugin -- --delay 3000    # Add 3 second delay before responding
 *   mise run test-plugin -- --silent        # Only send ack, skip notification
 */

import WebSocket from "ws";

// ============================================================================
// Configuration
// ============================================================================

const WS_URL = "ws://127.0.0.1:9473";
const PLUGIN_NAME = "test-harness";
const PLUGIN_DESCRIPTION =
  "A test plugin that echoes messages back. Use for debugging and testing the routing system.";
const PLUGIN_VERSION = "1.0.0";

// Reconnection settings
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;

// ============================================================================
// Types (matching src/types/messages.ts protocol)
// ============================================================================

interface CommandLineArgs {
  reject: boolean;
  delay: number;
  silent: boolean;
}

interface ClientRegistration {
  name: string;
  description: string;
  version: string;
}

interface WebSocketRegistrationMessage {
  type: "registration";
  payload: ClientRegistration;
}

interface RegistrationSuccessResponse {
  success: true;
  clientId: string;
  message: string;
}

interface RegistrationFailureResponse {
  success: false;
  code: string;
  message: string;
}

type RegistrationResponse = RegistrationSuccessResponse | RegistrationFailureResponse;

interface WebSocketRegistrationResponseMessage {
  type: "registration_response";
  payload: RegistrationResponse;
}

interface MessageMetadata {
  confidence?: number;
  routingReason?: string;
  inputMethod: "voice" | "text";
  directRouted: boolean;
}

interface RoutedMessage {
  id: string;
  text: string;
  timestamp: string;
  metadata: MessageMetadata;
}

interface WebSocketRoutedMessage {
  type: "message";
  payload: RoutedMessage;
}

// Payload types (inner payload of ClientResponse)
type AckPayload = Record<string, never>; // Empty object

interface RejectPayload {
  reason?: string;
}

interface NotificationPayload {
  title?: string;
  body?: string;
  priority?: "low" | "normal" | "high";
}

// ClientResponse structure (matches src/types/messages.ts)
interface ClientResponse {
  messageId: string;
  type: "ack" | "reject" | "notification";
  payload: AckPayload | RejectPayload | NotificationPayload;
}

interface WebSocketResponseMessage {
  type: "response";
  payload: ClientResponse;
}

type IncomingMessage = WebSocketRegistrationResponseMessage | WebSocketRoutedMessage;

// ============================================================================
// Logging
// ============================================================================

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[${timestamp}] ${level}: ${message}${dataStr}`);
}

// ============================================================================
// Command Line Parsing
// ============================================================================

function parseArgs(): CommandLineArgs {
  const args: CommandLineArgs = {
    reject: false,
    delay: 0,
    silent: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--reject") {
      args.reject = true;
    } else if (arg === "--silent") {
      args.silent = true;
    } else if (arg === "--delay") {
      const delayStr = argv[i + 1];
      if (delayStr !== undefined) {
        const delay = parseInt(delayStr, 10);
        if (!isNaN(delay) && delay >= 0) {
          args.delay = delay;
          i++; // Skip next arg since we consumed it
        } else {
          log("WARN", `Invalid delay value: ${delayStr}, ignoring`);
        }
      } else {
        log("WARN", "--delay requires a value in milliseconds");
      }
    }
  }

  return args;
}

// ============================================================================
// Test Harness Plugin
// ============================================================================

class TestHarnessPlugin {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly args: CommandLineArgs;
  private isShuttingDown = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private clientId: string | null = null;

  constructor(args: CommandLineArgs) {
    this.args = args;
  }

  /**
   * Connect to the WebSocket server.
   */
  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    log("INFO", `Connecting to ${WS_URL}...`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.on("open", () => {
          log("INFO", "Connected, sending registration...");
          this.reconnectAttempts = 0;
          this.sendRegistration();
          resolve();
        });

        this.ws.on("message", (data: WebSocket.RawData) => {
          this.handleMessage(data);
        });

        this.ws.on("close", (code: number, reason: Buffer) => {
          const reasonStr = reason.toString() || "No reason provided";
          log("INFO", `Connection closed`, { code, reason: reasonStr });
          this.ws = null;
          this.clientId = null;

          if (!this.isShuttingDown) {
            this.scheduleReconnect();
          }
        });

        this.ws.on("error", (error: Error) => {
          log("ERROR", `WebSocket error: ${error.message}`);
          // Don't reject here - error is followed by close event
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log("ERROR", `Failed to create WebSocket: ${errorMessage}`);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(data: WebSocket.RawData): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(data.toString());
    } catch {
      log("WARN", "Received non-JSON message, ignoring");
      return;
    }

    if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
      log("WARN", "Received invalid message format, ignoring");
      return;
    }

    const message = parsed as IncomingMessage;

    switch (message.type) {
      case "registration_response":
        this.handleRegistrationResponse(message.payload);
        break;

      case "message":
        this.handleRoutedMessage(message.payload);
        break;

      default:
        log("DEBUG", `Received unknown message type: ${(parsed as { type: string }).type}`);
    }
  }

  /**
   * Handle registration response from server.
   */
  private handleRegistrationResponse(response: RegistrationResponse): void {
    if (response.success) {
      this.clientId = response.clientId;
      log("INFO", `Registered successfully as "${PLUGIN_NAME}"`, {
        clientId: response.clientId,
        message: response.message,
      });
    } else {
      log("ERROR", `Registration failed: ${response.message}`, {
        code: response.code,
      });
      // Close connection and attempt reconnect after failure
      this.ws?.close();
    }
  }

  /**
   * Handle a routed message from the server.
   */
  private async handleRoutedMessage(message: RoutedMessage): Promise<void> {
    const { id: messageId, text, metadata } = message;

    log("INFO", `Received message [${messageId}]: "${text}"`, {
      inputMethod: metadata.inputMethod,
      directRouted: metadata.directRouted,
      routingReason: metadata.routingReason,
    });

    // Apply delay if configured
    if (this.args.delay > 0) {
      log("DEBUG", `Delaying response by ${this.args.delay}ms`);
      await this.sleep(this.args.delay);
    }

    // Handle reject mode
    if (this.args.reject) {
      this.sendReject(messageId, "Test rejection mode");
      return;
    }

    // Send ack
    this.sendAck(messageId);

    // Send notification unless silent mode
    if (!this.args.silent) {
      this.sendNotification(messageId, text);
    }
  }

  /**
   * Send registration message to server.
   */
  private sendRegistration(): void {
    const registration: WebSocketRegistrationMessage = {
      type: "registration",
      payload: {
        name: PLUGIN_NAME,
        description: PLUGIN_DESCRIPTION,
        version: PLUGIN_VERSION,
      },
    };

    this.send(registration);
    log("DEBUG", "Sent registration message");
  }

  /**
   * Send ack response for a message.
   */
  private sendAck(messageId: string): void {
    const response: WebSocketResponseMessage = {
      type: "response",
      payload: {
        messageId,
        type: "ack",
        payload: {},
      },
    };

    this.send(response);
    log("INFO", `Sent ack for ${messageId}`);
  }

  /**
   * Send reject response for a message.
   */
  private sendReject(messageId: string, reason: string): void {
    const response: WebSocketResponseMessage = {
      type: "response",
      payload: {
        messageId,
        type: "reject",
        payload: { reason },
      },
    };

    this.send(response);
    log("INFO", `Sent reject for ${messageId}`, { reason });
  }

  /**
   * Send notification response for a message.
   */
  private sendNotification(messageId: string, originalText: string): void {
    const response: WebSocketResponseMessage = {
      type: "response",
      payload: {
        messageId,
        type: "notification",
        payload: {
          title: `Echo from ${PLUGIN_NAME}`,
          body: `You said: ${originalText}`,
          priority: "normal",
        },
      },
    };

    this.send(response);
    log("INFO", `Sent notification for ${messageId}`);
  }

  /**
   * Send a message over the WebSocket connection.
   */
  private send(message: WebSocketRegistrationMessage | WebSocketResponseMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log("WARN", "Cannot send message: connection not open");
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("ERROR", `Failed to send message: ${errorMessage}`);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log("ERROR", "Max reconnection attempts reached. Exiting.");
      process.exit(1);
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );

    this.reconnectAttempts++;

    log(
      "INFO",
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch((error) => {
        log(
          "ERROR",
          `Reconnection failed: ${error instanceof Error ? error.message : String(error)}`
        );
        this.scheduleReconnect();
      });
    }, delay);
  }

  /**
   * Shutdown the plugin gracefully.
   */
  shutdown(): void {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    log("INFO", "Shutting down...");

    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Close WebSocket connection
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "Plugin shutting down");
      }
      this.ws = null;
    }

    log("INFO", "Shutdown complete");
    process.exit(0);
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

function main(): void {
  const args = parseArgs();

  log("INFO", "Starting test harness plugin", {
    reject: args.reject,
    delay: args.delay,
    silent: args.silent,
  });

  const plugin = new TestHarnessPlugin(args);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    log("INFO", "Received SIGINT");
    plugin.shutdown();
  });

  process.on("SIGTERM", () => {
    log("INFO", "Received SIGTERM");
    plugin.shutdown();
  });

  // Start the plugin
  plugin.connect().catch((error) => {
    log(
      "ERROR",
      `Initial connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
    // scheduleReconnect will be called from the close handler
  });
}

main();
