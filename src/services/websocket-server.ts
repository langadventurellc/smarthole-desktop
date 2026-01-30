/**
 * WebSocket server service for plugin client connections.
 * Provides a secure local WebSocket server bound to localhost only.
 *
 * @see F-websocket-server-foundation feature specification
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { getLogger, Logger } from "./logger";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the WebSocket server.
 */
export interface WebSocketServerConfig {
  /** Port to listen on (default: 9473) */
  port: number;
  /** Host to bind to (default: 127.0.0.1) */
  host: string;
  /** Maximum number of connections (default: 100) */
  maxConnections: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: WebSocketServerConfig = {
  port: 9473,
  host: "127.0.0.1",
  maxConnections: 100,
};

/**
 * Server state for tracking lifecycle.
 */
type ServerState = "stopped" | "starting" | "running" | "stopping";

/**
 * WebSocket server service interface.
 * Provides methods for managing the WebSocket server lifecycle.
 */
export interface WebSocketServerService {
  /**
   * Check if the server is currently running.
   *
   * @returns true if the server is running
   */
  isRunning(): boolean;

  /**
   * Get the current server state.
   *
   * @returns The current server state
   */
  getState(): ServerState;

  /**
   * Get the port the server is listening on.
   *
   * @returns The server port
   */
  getPort(): number;

  /**
   * Get the current number of connected clients.
   *
   * @returns The number of connected clients
   */
  getConnectionCount(): number;

  /**
   * Shut down the server gracefully.
   *
   * @returns A promise that resolves when the server is stopped
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// Origin Validation
// ============================================================================

/**
 * Validates that a connection originates from localhost.
 * Rejects connections from non-localhost origins for security.
 *
 * @param request - The incoming HTTP request
 * @returns true if the connection is from localhost
 */
function isLocalhostConnection(request: IncomingMessage): boolean {
  // Check the remote address
  const remoteAddress = request.socket.remoteAddress;

  // Accept IPv4 localhost
  if (remoteAddress === "127.0.0.1") {
    return true;
  }

  // Accept IPv6 localhost
  if (remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1") {
    return true;
  }

  return false;
}

// ============================================================================
// WebSocket Server Implementation
// ============================================================================

/**
 * Internal implementation of the WebSocketServerService.
 */
class WebSocketServerImpl implements WebSocketServerService {
  private readonly logger: Logger;
  private readonly config: WebSocketServerConfig;
  private server: WebSocketServer | null = null;
  private state: ServerState = "stopped";

  /**
   * Create a new WebSocketServerImpl.
   *
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<WebSocketServerConfig> = {}) {
    this.logger = getLogger().child({ component: "WebSocketServer" });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the WebSocket server.
   *
   * @returns A promise that resolves when the server is listening
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== "stopped") {
        const msg = `Cannot start server: already ${this.state}`;
        this.logger.warn(msg);
        reject(new Error(msg));
        return;
      }

      this.state = "starting";
      this.logger.info("Starting WebSocket server", {
        port: this.config.port,
        host: this.config.host,
      });

      try {
        this.server = new WebSocketServer({
          port: this.config.port,
          host: this.config.host,
          maxPayload: 1024 * 1024, // 1MB max payload
          verifyClient: (info, callback) => {
            // Verify connection is from localhost
            if (!isLocalhostConnection(info.req)) {
              const remoteAddress = info.req.socket.remoteAddress;
              this.logger.warn("Rejected non-localhost connection attempt", {
                remoteAddress,
              });
              callback(false, 403, "Forbidden: Non-localhost connections not allowed");
              return;
            }

            // Check max connections
            if (this.server && this.server.clients.size >= this.config.maxConnections) {
              this.logger.warn("Rejected connection: max connections reached", {
                current: this.server.clients.size,
                max: this.config.maxConnections,
              });
              callback(false, 503, "Service Unavailable: Max connections reached");
              return;
            }

            callback(true);
          },
        });

        // Handle server listening
        this.server.on("listening", () => {
          this.state = "running";
          this.logger.info("WebSocket server listening", {
            port: this.config.port,
            host: this.config.host,
          });
          resolve();
        });

        // Handle server errors
        this.server.on("error", (error: NodeJS.ErrnoException) => {
          this.handleServerError(error);

          // If we're still starting, reject the promise
          if (this.state === "starting") {
            this.state = "stopped";
            reject(error);
          }
        });

        // Handle new connections
        this.server.on("connection", (ws: WebSocket, request: IncomingMessage) => {
          this.handleConnection(ws, request);
        });

        // Handle server close
        this.server.on("close", () => {
          this.state = "stopped";
          this.logger.info("WebSocket server closed");
        });
      } catch (error) {
        this.state = "stopped";
        this.logger.error("Failed to create WebSocket server", {
          error: error instanceof Error ? error.message : String(error),
        });
        reject(error);
      }
    });
  }

  /**
   * Check if the server is currently running.
   */
  isRunning(): boolean {
    return this.state === "running";
  }

  /**
   * Get the current server state.
   */
  getState(): ServerState {
    return this.state;
  }

  /**
   * Get the port the server is listening on.
   */
  getPort(): number {
    return this.config.port;
  }

  /**
   * Get the current number of connected clients.
   */
  getConnectionCount(): number {
    return this.server?.clients.size ?? 0;
  }

  /**
   * Shut down the server gracefully.
   */
  shutdown(): Promise<void> {
    return new Promise((resolve) => {
      if (this.state === "stopped" || this.state === "stopping") {
        this.logger.debug("Server already stopped or stopping");
        resolve();
        return;
      }

      this.state = "stopping";
      this.logger.info("Shutting down WebSocket server");

      if (!this.server) {
        this.state = "stopped";
        resolve();
        return;
      }

      // Close all client connections
      const closePromises: Promise<void>[] = [];
      this.server.clients.forEach((client) => {
        closePromises.push(
          new Promise<void>((resolveClose) => {
            if (client.readyState === WebSocket.OPEN) {
              client.close(1001, "Server shutting down");
              // Set a timeout in case the close doesn't complete
              const timeout = setTimeout(() => {
                client.terminate();
                resolveClose();
              }, 1000);
              client.on("close", () => {
                clearTimeout(timeout);
                resolveClose();
              });
            } else {
              resolveClose();
            }
          })
        );
      });

      // Wait for all clients to close, then close the server
      Promise.all(closePromises)
        .then(() => {
          this.server?.close((err) => {
            if (err) {
              this.logger.warn("Error closing server", {
                error: err.message,
              });
            }
            this.state = "stopped";
            this.server = null;
            this.logger.info("WebSocket server shutdown complete");
            resolve();
          });
        })
        .catch(() => {
          // Force close on error
          this.server?.close();
          this.state = "stopped";
          this.server = null;
          resolve();
        });
    });
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Handle server errors with specific error type handling.
   */
  private handleServerError(error: NodeJS.ErrnoException): void {
    switch (error.code) {
      case "EADDRINUSE":
        this.logger.error("Port already in use", {
          port: this.config.port,
          error: error.message,
        });
        break;

      case "EACCES":
        this.logger.error("Permission denied: cannot bind to port", {
          port: this.config.port,
          error: error.message,
        });
        break;

      case "EADDRNOTAVAIL":
        this.logger.error("Address not available: cannot bind to host", {
          host: this.config.host,
          error: error.message,
        });
        break;

      default:
        this.logger.error("WebSocket server error", {
          code: error.code,
          error: error.message,
        });
    }
  }

  /**
   * Handle a new WebSocket connection.
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const remoteAddress = request.socket.remoteAddress;

    this.logger.info("Client connected", {
      remoteAddress,
      totalConnections: this.getConnectionCount(),
    });

    // Handle client errors
    ws.on("error", (error) => {
      this.logger.warn("Client connection error", {
        remoteAddress,
        error: error.message,
      });
    });

    // Handle client disconnect
    ws.on("close", (code, reason) => {
      this.logger.info("Client disconnected", {
        remoteAddress,
        code,
        reason: reason.toString(),
        totalConnections: this.getConnectionCount() - 1, // -1 because event fires before removal
      });
    });
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

/**
 * Singleton instance of the WebSocket server service.
 */
let webSocketServerInstance: WebSocketServerImpl | null = null;

/**
 * Initializes and starts the global WebSocket server instance.
 * This should be called inside `app.whenReady()` after the logger has been initialized.
 *
 * @param config - Optional configuration overrides
 * @returns A promise that resolves to the initialized WebSocketServerService
 * @throws Error if logger has not been initialized or server fails to start
 *
 * @example
 * ```typescript
 * import { initializeWebSocketServer } from './services/websocket-server';
 *
 * // Inside app.whenReady(), after logger initialization
 * const wsServer = await initializeWebSocketServer({ port: 9473 });
 * console.log('WebSocket server running:', wsServer.isRunning());
 * ```
 */
export async function initializeWebSocketServer(
  config?: Partial<WebSocketServerConfig>
): Promise<WebSocketServerService> {
  if (webSocketServerInstance) {
    // Already initialized, return existing instance
    return webSocketServerInstance;
  }

  webSocketServerInstance = new WebSocketServerImpl(config);
  await webSocketServerInstance.start();
  return webSocketServerInstance;
}

/**
 * Gets the current WebSocket server service instance.
 * Throws if initializeWebSocketServer() has not been called.
 *
 * @returns The WebSocketServerService instance
 * @throws Error if WebSocket server has not been initialized
 */
export function getWebSocketServer(): WebSocketServerService {
  if (!webSocketServerInstance) {
    throw new Error(
      "WebSocketServer not initialized. Call initializeWebSocketServer() before using getWebSocketServer()."
    );
  }
  return webSocketServerInstance;
}

/**
 * Shuts down the WebSocket server gracefully.
 * Safe to call even if the server is not initialized.
 *
 * @returns A promise that resolves when the server is stopped
 */
export async function shutdownWebSocketServer(): Promise<void> {
  if (!webSocketServerInstance) {
    return;
  }

  await webSocketServerInstance.shutdown();
  webSocketServerInstance = null;
}

/**
 * Resets the WebSocket server instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetWebSocketServer(): void {
  if (webSocketServerInstance) {
    // Force close without waiting
    webSocketServerInstance.shutdown().catch(() => {
      // Ignore errors during reset
    });
  }
  webSocketServerInstance = null;
}
