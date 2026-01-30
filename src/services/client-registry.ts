/**
 * Client registry service for tracking registered plugin clients.
 * Provides in-memory storage with lookup and listing operations.
 *
 * @see F-client-registration-registry feature specification
 */

import { EventEmitter } from "events";
import { WebSocket } from "ws";
import { getLogger, Logger } from "./logger";
import {
  ClientId,
  createTimestamp,
  ClientRegistration,
  RegistryClient,
  RegistryClientInfo,
  ClientRegistryEvents,
  ClientRegisteredEvent,
  ClientUnregisteredEvent,
} from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a registration attempt.
 */
export type RegisterResult =
  | { success: true; client: RegistryClientInfo }
  | { success: false; error: string };

/**
 * Client registry service interface.
 * Provides methods for managing registered clients.
 */
export interface ClientRegistryService {
  /**
   * Register a new client with the registry.
   *
   * @param clientId - The unique client ID (from WebSocket connection)
   * @param registration - The client's registration data
   * @param connection - The WebSocket connection for this client
   * @returns Result indicating success or failure with error message
   */
  register(
    clientId: ClientId,
    registration: ClientRegistration,
    connection: WebSocket
  ): RegisterResult;

  /**
   * Unregister a client by name.
   *
   * @param name - The client name to unregister
   * @param reason - The reason for unregistration
   * @returns true if the client was unregistered, false if not found
   */
  unregister(name: string, reason: ClientUnregisteredEvent["reason"]): boolean;

  /**
   * Unregister a client by their connection ID.
   *
   * @param clientId - The client ID to unregister
   * @param reason - The reason for unregistration
   * @returns true if the client was unregistered, false if not found
   */
  unregisterById(clientId: ClientId, reason: ClientUnregisteredEvent["reason"]): boolean;

  /**
   * Get a client by name.
   *
   * @param name - The client name to look up
   * @returns The client if found, undefined otherwise
   */
  getClient(name: string): RegistryClient | undefined;

  /**
   * Get a client by their connection ID.
   *
   * @param clientId - The client ID to look up
   * @returns The client if found, undefined otherwise
   */
  getClientById(clientId: ClientId): RegistryClient | undefined;

  /**
   * Get information about all registered clients.
   * Returns public info without WebSocket connections.
   *
   * @returns Array of client info for all registered clients
   */
  getAllClients(): RegistryClientInfo[];

  /**
   * Check if a client with the given name exists.
   *
   * @param name - The client name to check
   * @returns true if a client with this name exists
   */
  hasClient(name: string): boolean;

  /**
   * Get the number of registered clients.
   *
   * @returns The count of registered clients
   */
  getClientCount(): number;

  /**
   * Subscribe to registry events.
   *
   * @param event - The event type to listen for
   * @param listener - The callback function
   */
  on<K extends keyof ClientRegistryEvents>(event: K, listener: ClientRegistryEvents[K]): void;

  /**
   * Unsubscribe from registry events.
   *
   * @param event - The event type to stop listening for
   * @param listener - The callback function to remove
   */
  off<K extends keyof ClientRegistryEvents>(event: K, listener: ClientRegistryEvents[K]): void;

  /**
   * Clear all registered clients.
   * Primarily for testing purposes.
   */
  clear(): void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a RegistryClient to RegistryClientInfo (public view).
 * Strips the WebSocket connection from the client data.
 *
 * @param client - The full client with connection
 * @returns Client info without connection
 */
function toClientInfo(client: RegistryClient): RegistryClientInfo {
  return {
    id: client.id,
    name: client.name,
    description: client.description,
    version: client.version,
    capabilities: client.capabilities,
    registeredAt: client.registeredAt,
  };
}

// ============================================================================
// Client Registry Implementation
// ============================================================================

/**
 * Internal implementation of the ClientRegistryService.
 * Uses Map-based storage with name as the primary key.
 */
class ClientRegistryImpl implements ClientRegistryService {
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;

  /** Map of client names to their full registration data */
  private readonly clientsByName: Map<string, RegistryClient> = new Map();

  /** Map of client IDs to client names for reverse lookup */
  private readonly namesByClientId: Map<ClientId, string> = new Map();

  /**
   * Create a new ClientRegistryImpl.
   */
  constructor() {
    this.logger = getLogger().child({ component: "ClientRegistry" });
    this.emitter = new EventEmitter();
  }

  /**
   * Register a new client with the registry.
   */
  register(
    clientId: ClientId,
    registration: ClientRegistration,
    connection: WebSocket
  ): RegisterResult {
    const { name, description, version, capabilities } = registration;

    // Check for duplicate name
    if (this.clientsByName.has(name)) {
      this.logger.warn("Registration rejected: duplicate client name", {
        name,
        existingClientId: this.clientsByName.get(name)?.id,
        newClientId: clientId,
      });
      return {
        success: false,
        error: `A client named "${name}" is already registered`,
      };
    }

    // Check if this connection ID is already registered (shouldn't happen, but safety check)
    if (this.namesByClientId.has(clientId)) {
      const existingName = this.namesByClientId.get(clientId);
      this.logger.warn("Registration rejected: connection already registered", {
        clientId,
        existingName,
        newName: name,
      });
      return {
        success: false,
        error: `This connection is already registered as "${existingName}"`,
      };
    }

    // Create the registered client
    const client: RegistryClient = {
      id: clientId,
      name,
      description,
      version,
      capabilities,
      connection,
      registeredAt: createTimestamp(),
    };

    // Store in both maps
    this.clientsByName.set(name, client);
    this.namesByClientId.set(clientId, name);

    this.logger.info("Client registered", {
      clientId,
      name,
      version,
      capabilities,
      totalClients: this.getClientCount(),
    });

    // Emit registered event
    const clientInfo = toClientInfo(client);
    const event: ClientRegisteredEvent = { client: clientInfo };
    this.emitter.emit("registered", event);

    return { success: true, client: clientInfo };
  }

  /**
   * Unregister a client by name.
   */
  unregister(name: string, reason: ClientUnregisteredEvent["reason"]): boolean {
    const client = this.clientsByName.get(name);
    if (!client) {
      this.logger.debug("Unregister failed: client not found by name", { name });
      return false;
    }

    return this.removeClient(client, reason);
  }

  /**
   * Unregister a client by their connection ID.
   */
  unregisterById(clientId: ClientId, reason: ClientUnregisteredEvent["reason"]): boolean {
    const name = this.namesByClientId.get(clientId);
    if (!name) {
      this.logger.debug("Unregister failed: client not found by ID", { clientId });
      return false;
    }

    const client = this.clientsByName.get(name);
    if (!client) {
      // Inconsistent state - clean up the orphaned mapping
      this.namesByClientId.delete(clientId);
      this.logger.warn("Inconsistent registry state: name mapping without client", {
        clientId,
        name,
      });
      return false;
    }

    return this.removeClient(client, reason);
  }

  /**
   * Get a client by name.
   */
  getClient(name: string): RegistryClient | undefined {
    return this.clientsByName.get(name);
  }

  /**
   * Get a client by their connection ID.
   */
  getClientById(clientId: ClientId): RegistryClient | undefined {
    const name = this.namesByClientId.get(clientId);
    if (!name) {
      return undefined;
    }
    return this.clientsByName.get(name);
  }

  /**
   * Get information about all registered clients.
   */
  getAllClients(): RegistryClientInfo[] {
    return Array.from(this.clientsByName.values()).map(toClientInfo);
  }

  /**
   * Check if a client with the given name exists.
   */
  hasClient(name: string): boolean {
    return this.clientsByName.has(name);
  }

  /**
   * Get the number of registered clients.
   */
  getClientCount(): number {
    return this.clientsByName.size;
  }

  /**
   * Subscribe to registry events.
   */
  on<K extends keyof ClientRegistryEvents>(event: K, listener: ClientRegistryEvents[K]): void {
    this.emitter.on(event, listener);
  }

  /**
   * Unsubscribe from registry events.
   */
  off<K extends keyof ClientRegistryEvents>(event: K, listener: ClientRegistryEvents[K]): void {
    this.emitter.off(event, listener);
  }

  /**
   * Clear all registered clients.
   */
  clear(): void {
    const count = this.getClientCount();
    this.clientsByName.clear();
    this.namesByClientId.clear();
    this.emitter.removeAllListeners();
    this.logger.debug("Registry cleared", { previousCount: count });
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Remove a client from the registry and emit the unregistered event.
   */
  private removeClient(client: RegistryClient, reason: ClientUnregisteredEvent["reason"]): boolean {
    // Remove from both maps
    this.clientsByName.delete(client.name);
    this.namesByClientId.delete(client.id);

    this.logger.info("Client unregistered", {
      clientId: client.id,
      name: client.name,
      reason,
      totalClients: this.getClientCount(),
    });

    // Emit unregistered event
    const clientInfo = toClientInfo(client);
    const event: ClientUnregisteredEvent = { client: clientInfo, reason };
    this.emitter.emit("unregistered", event);

    return true;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

/**
 * Singleton instance of the client registry service.
 */
let clientRegistryInstance: ClientRegistryImpl | null = null;

/**
 * Initializes the global client registry instance.
 * This should be called inside `app.whenReady()` after the logger has been initialized.
 *
 * @returns The initialized ClientRegistryService instance
 * @throws Error if logger has not been initialized
 *
 * @example
 * ```typescript
 * import { initializeClientRegistry } from './services/client-registry';
 *
 * // Inside app.whenReady(), after logger initialization
 * const registry = initializeClientRegistry();
 * console.log('Registered clients:', registry.getClientCount());
 * ```
 */
export function initializeClientRegistry(): ClientRegistryService {
  if (clientRegistryInstance) {
    // Already initialized, return existing instance
    return clientRegistryInstance;
  }

  clientRegistryInstance = new ClientRegistryImpl();
  return clientRegistryInstance;
}

/**
 * Gets the current client registry service instance.
 * Throws if initializeClientRegistry() has not been called.
 *
 * @returns The ClientRegistryService instance
 * @throws Error if client registry has not been initialized
 */
export function getClientRegistry(): ClientRegistryService {
  if (!clientRegistryInstance) {
    throw new Error(
      "ClientRegistry not initialized. Call initializeClientRegistry() before using getClientRegistry()."
    );
  }
  return clientRegistryInstance;
}

/**
 * Resets the client registry instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetClientRegistry(): void {
  if (clientRegistryInstance) {
    clientRegistryInstance.clear();
  }
  clientRegistryInstance = null;
}
