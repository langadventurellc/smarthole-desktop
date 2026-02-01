/**
 * Tool Generator Service
 *
 * Generates Claude tool definitions from registered clients in the ClientRegistry.
 * Tools are cached and automatically invalidated when clients connect/disconnect.
 */

import { getLogger, Logger } from "./logger";
import { getClientRegistry, ClientRegistryService } from "./client-registry";
import {
  RoutingTool,
  ToolGeneratorService,
  RegistryClientInfo,
  ClientRegisteredEvent,
  ClientUnregisteredEvent,
} from "../types";

// ============================================================================
// Constants
// ============================================================================

/** Prefix for generated tool names */
const TOOL_NAME_PREFIX = "route_to_";

// ============================================================================
// Helper Functions
// ============================================================================

export function sanitizeToolName(clientName: string): string {
  // Replace any non-alphanumeric characters with underscores
  let sanitized = clientName.replace(/[^a-zA-Z0-9]/g, "_");

  // Remove leading underscores
  sanitized = sanitized.replace(/^_+/, "");

  // If it doesn't start with a letter after sanitization, prepend "client_"
  if (!/^[a-zA-Z]/.test(sanitized)) {
    sanitized = "client_" + sanitized;
  }

  return TOOL_NAME_PREFIX + sanitized;
}

function createToolFromClient(client: RegistryClientInfo): RoutingTool {
  const toolName = sanitizeToolName(client.name);

  return {
    name: toolName,
    description: client.description,
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to route to this client",
        },
        reason: {
          type: "string",
          description: "Explanation for why this client was chosen",
        },
      },
      required: ["message"],
    },
  };
}

// ============================================================================
// Implementation
// ============================================================================

class ToolGeneratorServiceImpl implements ToolGeneratorService {
  private readonly logger: Logger;
  private readonly registry: ClientRegistryService;

  /** Cached tool definitions */
  private toolCache: RoutingTool[] | null = null;

  /** Reverse mapping: tool name -> client name */
  private toolToClientMap: Map<string, string> = new Map();

  /** Bound event handlers for cleanup */
  private readonly onRegistered: (event: ClientRegisteredEvent) => void;
  private readonly onUnregistered: (event: ClientUnregisteredEvent) => void;

  constructor(registry: ClientRegistryService) {
    this.logger = getLogger().child({ component: "ToolGenerator" });
    this.registry = registry;

    // Bind event handlers
    this.onRegistered = this.handleClientRegistered.bind(this);
    this.onUnregistered = this.handleClientUnregistered.bind(this);

    // Subscribe to registry events
    this.registry.on("registered", this.onRegistered);
    this.registry.on("unregistered", this.onUnregistered);

    this.logger.debug("ToolGenerator initialized");
  }

  generateTools(): RoutingTool[] {
    if (this.toolCache !== null) {
      this.logger.debug("Returning cached tools", { count: this.toolCache.length });
      return this.toolCache;
    }

    return this.rebuildToolCache();
  }

  generateToolsExcluding(clientNames: string[]): RoutingTool[] {
    const excludeSet = new Set(clientNames);
    const allTools = this.generateTools();

    return allTools.filter((tool) => {
      const clientName = this.toolToClientMap.get(tool.name);
      return clientName !== undefined && !excludeSet.has(clientName);
    });
  }

  resolveClientName(toolName: string): string | undefined {
    // Ensure the cache is built so the mapping is populated
    if (this.toolCache === null) {
      this.rebuildToolCache();
    }
    return this.toolToClientMap.get(toolName);
  }

  /**
   * Cleanup resources and unsubscribe from registry events.
   * Called during service reset.
   */
  cleanup(): void {
    this.registry.off("registered", this.onRegistered);
    this.registry.off("unregistered", this.onUnregistered);
    this.invalidateCache();
    this.logger.debug("ToolGenerator cleaned up");
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private handleClientRegistered(event: ClientRegisteredEvent): void {
    this.logger.debug("Client registered, invalidating tool cache", { name: event.client.name });
    this.invalidateCache();
  }

  private handleClientUnregistered(event: ClientUnregisteredEvent): void {
    this.logger.debug("Client unregistered, invalidating tool cache", { name: event.client.name });
    this.invalidateCache();
  }

  private invalidateCache(): void {
    this.toolCache = null;
    // Don't clear the map here - it will be rebuilt on next generateTools() call
  }

  private rebuildToolCache(): RoutingTool[] {
    const clients = this.registry.getAllClients();
    this.toolToClientMap.clear();

    const tools: RoutingTool[] = [];

    for (const client of clients) {
      const tool = createToolFromClient(client);
      tools.push(tool);
      this.toolToClientMap.set(tool.name, client.name);
    }

    this.toolCache = tools;
    this.logger.debug("Tool cache rebuilt", { count: tools.length });

    return tools;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let toolGeneratorInstance: ToolGeneratorServiceImpl | null = null;

/**
 * Initializes the global tool generator instance.
 * Must be called inside `app.whenReady()` after logger and client registry have been initialized.
 *
 * @returns The initialized ToolGeneratorService instance
 * @throws Error if logger or client registry have not been initialized
 */
export function initializeToolGenerator(): ToolGeneratorService {
  if (toolGeneratorInstance) {
    return toolGeneratorInstance;
  }

  const registry = getClientRegistry();
  toolGeneratorInstance = new ToolGeneratorServiceImpl(registry);
  return toolGeneratorInstance;
}

/**
 * Gets the current tool generator service instance.
 * Throws if initializeToolGenerator() has not been called.
 *
 * @returns The ToolGeneratorService instance
 * @throws Error if tool generator has not been initialized
 */
export function getToolGenerator(): ToolGeneratorService {
  if (!toolGeneratorInstance) {
    throw new Error(
      "ToolGenerator not initialized. Call initializeToolGenerator() before using getToolGenerator()."
    );
  }
  return toolGeneratorInstance;
}

/**
 * Resets the tool generator instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetToolGenerator(): void {
  if (toolGeneratorInstance) {
    toolGeneratorInstance.cleanup();
  }
  toolGeneratorInstance = null;
}
