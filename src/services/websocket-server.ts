/**
 * WebSocket server service for plugin client connections.
 * Provides a secure local WebSocket server bound to localhost only.
 *
 * @see F-websocket-server-foundation feature specification
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { EventEmitter } from "events";
import { getLogger, Logger } from "./logger";
import { ClientId, createClientId } from "../types";

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
  /** Heartbeat ping interval in milliseconds (default: 30000) */
  heartbeatInterval: number;
  /** Timeout for pong response before considering connection stale (default: 10000) */
  heartbeatTimeout: number;
}

/**
 * Metadata tracked for each active connection.
 */
export interface ConnectionInfo {
  /** Unique identifier for this connection */
  id: ClientId;
  /** Timestamp when the connection was established */
  connectedAt: Date;
  /** Timestamp of last activity (message received or pong response) */
  lastActivity: Date;
  /** Remote address of the client */
  remoteAddress: string;
}

/**
 * Extended WebSocket with connection tracking properties.
 */
interface TrackedWebSocket extends WebSocket {
  /** Whether the connection is alive (has responded to ping) */
  isAlive: boolean;
  /** Unique connection identifier */
  connectionId: ClientId;
}

/**
 * Events emitted by the WebSocket server.
 */
export interface WebSocketServerEvents {
  /** Emitted when a new client connects */
  connection: (info: ConnectionInfo) => void;
  /** Emitted when a client disconnects */
  disconnection: (info: ConnectionInfo, code: number, reason: string) => void;
  /** Emitted when a client connection encounters an error */
  error: (info: ConnectionInfo, error: Error) => void;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: WebSocketServerConfig = {
  port: 9473,
  host: "127.0.0.1",
  maxConnections: 100,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
};

/**
 * Server state for tracking lifecycle.
 */
type ServerState = "stopped" | "starting" | "running" | "stopping";

/**
 * WebSocket server service interface.
 * Provides methods for managing the WebSocket server lifecycle and connections.
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
   * Get information about all active connections.
   *
   * @returns Array of connection info for all active connections
   */
  getActiveConnections(): ConnectionInfo[];

  /**
   * Get information about a specific connection by ID.
   *
   * @param id - The connection ID to look up
   * @returns The connection info, or undefined if not found
   */
  getConnection(id: ClientId): ConnectionInfo | undefined;

  /**
   * Subscribe to connection events.
   *
   * @param event - The event type to listen for
   * @param listener - The callback function
   */
  on<K extends keyof WebSocketServerEvents>(event: K, listener: WebSocketServerEvents[K]): void;

  /**
   * Unsubscribe from connection events.
   *
   * @param event - The event type to stop listening for
   * @param listener - The callback function to remove
   */
  off<K extends keyof WebSocketServerEvents>(event: K, listener: WebSocketServerEvents[K]): void;

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
 * Generates a unique connection ID using crypto.randomUUID().
 */
function generateConnectionId(): ClientId {
  return createClientId(crypto.randomUUID());
}

/**
 * Internal implementation of the WebSocketServerService.
 */
class WebSocketServerImpl implements WebSocketServerService {
  private readonly logger: Logger;
  private readonly config: WebSocketServerConfig;
  private readonly emitter: EventEmitter;
  private server: WebSocketServer | null = null;
  private state: ServerState = "stopped";

  /** Map of connection IDs to their metadata */
  private readonly connections: Map<ClientId, ConnectionInfo> = new Map();

  /** Heartbeat interval timer */
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Create a new WebSocketServerImpl.
   *
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<WebSocketServerConfig> = {}) {
    this.logger = getLogger().child({ component: "WebSocketServer" });
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.emitter = new EventEmitter();
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

          // Start heartbeat monitoring
          this.startHeartbeat();

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
    return this.connections.size;
  }

  /**
   * Get information about all active connections.
   */
  getActiveConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get information about a specific connection by ID.
   */
  getConnection(id: ClientId): ConnectionInfo | undefined {
    return this.connections.get(id);
  }

  /**
   * Subscribe to connection events.
   */
  on<K extends keyof WebSocketServerEvents>(event: K, listener: WebSocketServerEvents[K]): void {
    this.emitter.on(event, listener);
  }

  /**
   * Unsubscribe from connection events.
   */
  off<K extends keyof WebSocketServerEvents>(event: K, listener: WebSocketServerEvents[K]): void {
    this.emitter.off(event, listener);
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

      // Stop heartbeat monitoring
      this.stopHeartbeat();

      if (!this.server) {
        this.state = "stopped";
        this.connections.clear();
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
            this.connections.clear();
            this.emitter.removeAllListeners();
            this.logger.info("WebSocket server shutdown complete");
            resolve();
          });
        })
        .catch(() => {
          // Force close on error
          this.server?.close();
          this.state = "stopped";
          this.server = null;
          this.connections.clear();
          this.emitter.removeAllListeners();
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
    const trackedWs = ws as TrackedWebSocket;
    const remoteAddress = request.socket.remoteAddress ?? "unknown";

    // Generate unique connection ID and track the connection
    const connectionId = generateConnectionId();
    trackedWs.connectionId = connectionId;
    trackedWs.isAlive = true;

    const now = new Date();
    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      connectedAt: now,
      lastActivity: now,
      remoteAddress,
    };

    this.connections.set(connectionId, connectionInfo);

    this.logger.info("Client connected", {
      connectionId,
      remoteAddress,
      totalConnections: this.getConnectionCount(),
    });

    // Emit connection event
    this.emitter.emit("connection", connectionInfo);

    // Handle pong responses (heartbeat)
    trackedWs.on("pong", () => {
      trackedWs.isAlive = true;
      const info = this.connections.get(connectionId);
      if (info) {
        info.lastActivity = new Date();
      }
      this.logger.debug("Received pong from client", { connectionId });
    });

    // Handle client errors
    trackedWs.on("error", (error) => {
      this.logger.warn("Client connection error", {
        connectionId,
        remoteAddress,
        error: error.message,
      });

      const info = this.connections.get(connectionId);
      if (info) {
        this.emitter.emit("error", info, error);
      }
    });

    // Handle client disconnect
    trackedWs.on("close", (code, reason) => {
      const info = this.connections.get(connectionId);
      const reasonStr = reason.toString();

      this.logger.info("Client disconnected", {
        connectionId,
        remoteAddress,
        code,
        reason: reasonStr,
        totalConnections: this.getConnectionCount() - 1,
      });

      // Clean up connection tracking
      this.connections.delete(connectionId);

      // Emit disconnection event
      if (info) {
        this.emitter.emit("disconnection", info, code, reasonStr);
      }
    });
  }

  /**
   * Start the heartbeat interval to ping all connected clients.
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return; // Already running
    }

    this.logger.debug("Starting heartbeat monitoring", {
      interval: this.config.heartbeatInterval,
      timeout: this.config.heartbeatTimeout,
    });

    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop the heartbeat interval.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.logger.debug("Stopped heartbeat monitoring");
    }
  }

  /**
   * Perform a heartbeat check on all connected clients.
   * Terminates connections that didn't respond to the previous ping.
   */
  private performHeartbeat(): void {
    if (!this.server) {
      return;
    }

    this.server.clients.forEach((ws) => {
      const trackedWs = ws as TrackedWebSocket;

      if (!trackedWs.isAlive) {
        // Client didn't respond to previous ping - terminate
        const connectionId = trackedWs.connectionId;
        const info = this.connections.get(connectionId);

        this.logger.warn("Terminating stale connection (no heartbeat response)", {
          connectionId,
          remoteAddress: info?.remoteAddress,
        });

        trackedWs.terminate();
        return;
      }

      // Mark as not alive until we receive pong
      trackedWs.isAlive = false;

      // Send ping
      trackedWs.ping((err?: Error) => {
        if (err) {
          this.logger.debug("Failed to send ping", {
            connectionId: trackedWs.connectionId,
            error: err.message,
          });
        }
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
