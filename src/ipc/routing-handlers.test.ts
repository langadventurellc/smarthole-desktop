/**
 * Tests for the routing IPC handlers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoutingSubmitHandler, createRoutingStatusHandler } from "./routing-handlers";
import type { RoutingAgentService, RoutingOutcome } from "../types";
import type { ClientRegistryService } from "../services/client-registry";
import type { CredentialManagerService } from "../services/credential-manager";
import type { Logger } from "../services/logger";

// Mock RoutingAgentService
function createMockRoutingAgent(overrides: Partial<RoutingAgentService> = {}): RoutingAgentService {
  return {
    routeMessage: vi.fn().mockResolvedValue({
      type: "routed",
      deliveries: [{ clientName: "test-client", messageId: "msg-123", directRouted: false }],
    } as RoutingOutcome),
    on: vi.fn(),
    off: vi.fn(),
    ...overrides,
  };
}

// Mock ClientRegistryService
function createMockClientRegistry(
  overrides: Partial<ClientRegistryService> = {}
): ClientRegistryService {
  return {
    getClientCount: vi.fn().mockReturnValue(2),
    getAllClients: vi.fn().mockReturnValue([]),
    getClient: vi.fn().mockReturnValue(null),
    registerClient: vi.fn().mockReturnValue({ success: true, clientId: "test-id" }),
    unregister: vi.fn().mockReturnValue(true),
    unregisterById: vi.fn().mockReturnValue(true),
    isNameTaken: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
    ...overrides,
  } as unknown as ClientRegistryService;
}

// Mock CredentialManagerService
function createMockCredentialManager(
  overrides: Partial<CredentialManagerService> = {}
): CredentialManagerService {
  return {
    storeCredential: vi.fn().mockResolvedValue(undefined),
    getCredential: vi.fn().mockResolvedValue(null),
    deleteCredential: vi.fn().mockResolvedValue(undefined),
    hasCredential: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// Mock Logger
function createMockLogger(): Logger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: "info",
    silent: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Logger;
}

describe("createRoutingSubmitHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should route message successfully and return routed outcome", async () => {
    const routingAgent = createMockRoutingAgent();
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, {
      message: "Hello, world!",
      source: "text",
    });

    expect(result).toEqual({
      success: true,
      outcomeType: "routed",
      deliveryCount: 1,
    });
    expect(routingAgent.routeMessage).toHaveBeenCalledWith({
      message: "Hello, world!",
      source: "text",
      metadata: undefined,
    });
  });

  it("should include metadata in routing request when provided", async () => {
    const routingAgent = createMockRoutingAgent();
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    await handler(mockEvent, {
      message: "Test message",
      source: "voice",
      metadata: { confidence: 0.95 },
    });

    expect(routingAgent.routeMessage).toHaveBeenCalledWith({
      message: "Test message",
      source: "voice",
      metadata: { confidence: 0.95 },
    });
  });

  it("should return no_clients outcome when no clients available", async () => {
    const routingAgent = createMockRoutingAgent({
      routeMessage: vi.fn().mockResolvedValue({
        type: "no_clients",
        message: "No plugins are currently connected.",
      } as RoutingOutcome),
    });
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, {
      message: "Hello",
      source: "text",
    });

    expect(result).toEqual({
      success: false,
      outcomeType: "no_clients",
      error: "No plugins are currently connected.",
    });
  });

  it("should return routing_failed outcome when routing fails", async () => {
    const routingAgent = createMockRoutingAgent({
      routeMessage: vi.fn().mockResolvedValue({
        type: "routing_failed",
        error: "API key not configured",
        fallbackAttempted: true,
      } as RoutingOutcome),
    });
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, {
      message: "Hello",
      source: "text",
    });

    expect(result).toEqual({
      success: false,
      outcomeType: "routing_failed",
      error: "API key not configured",
    });
  });

  it("should return error for invalid payload with missing message", async () => {
    const routingAgent = createMockRoutingAgent();
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    // Cast to bypass TypeScript for testing invalid input
    const result = await handler(mockEvent, {
      source: "text",
    } as never);

    expect(result).toEqual({
      success: false,
      outcomeType: "routing_failed",
      error: "Invalid payload: message and source are required",
    });
    expect(routingAgent.routeMessage).not.toHaveBeenCalled();
  });

  it("should return error for invalid payload with missing source", async () => {
    const routingAgent = createMockRoutingAgent();
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, {
      message: "Hello",
    } as never);

    expect(result).toEqual({
      success: false,
      outcomeType: "routing_failed",
      error: "Invalid payload: message and source are required",
    });
  });

  it("should return error for invalid payload with empty message", async () => {
    const routingAgent = createMockRoutingAgent();
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, {
      message: "",
      source: "text",
    });

    expect(result).toEqual({
      success: false,
      outcomeType: "routing_failed",
      error: "Invalid payload: message and source are required",
    });
  });

  it("should return error for invalid source value", async () => {
    const routingAgent = createMockRoutingAgent();
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, {
      message: "Hello",
      source: "invalid" as never,
    });

    expect(result).toEqual({
      success: false,
      outcomeType: "routing_failed",
      error: "Invalid payload: message and source are required",
    });
  });

  it("should handle unexpected errors from routing agent", async () => {
    const routingAgent = createMockRoutingAgent({
      routeMessage: vi.fn().mockRejectedValue(new Error("Connection failed")),
    });
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, {
      message: "Hello",
      source: "text",
    });

    expect(result).toEqual({
      success: false,
      outcomeType: "routing_failed",
      error: "Unexpected error: Connection failed",
    });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should log debug message when routing message", async () => {
    const routingAgent = createMockRoutingAgent();
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    await handler(mockEvent, {
      message: "Test",
      source: "voice",
      metadata: { test: true },
    });

    expect(mockLogger.debug).toHaveBeenCalledWith("Routing message via IPC", {
      source: "voice",
      messageLength: 4,
      hasMetadata: true,
    });
  });

  it("should handle multiple deliveries in routed outcome", async () => {
    const routingAgent = createMockRoutingAgent({
      routeMessage: vi.fn().mockResolvedValue({
        type: "routed",
        deliveries: [
          { clientName: "client-1", messageId: "msg-1", directRouted: false },
          { clientName: "client-2", messageId: "msg-2", directRouted: false },
          { clientName: "client-3", messageId: "msg-3", directRouted: true },
        ],
      } as RoutingOutcome),
    });
    const handler = createRoutingSubmitHandler(() => routingAgent, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent, {
      message: "Broadcast message",
      source: "text",
    });

    expect(result).toEqual({
      success: true,
      outcomeType: "routed",
      deliveryCount: 3,
    });
  });
});

describe("createRoutingStatusHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should return available status when API key is configured", async () => {
    const clientRegistry = createMockClientRegistry({
      getClientCount: vi.fn().mockReturnValue(3),
    });
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockResolvedValue(true),
    });
    const handler = createRoutingStatusHandler(
      () => clientRegistry,
      () => credentialManager,
      mockLogger
    );
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({
      available: true,
      clientCount: 3,
    });
    expect(credentialManager.hasCredential).toHaveBeenCalledWith("anthropic-api-key");
  });

  it("should return unavailable status when API key is not configured", async () => {
    const clientRegistry = createMockClientRegistry({
      getClientCount: vi.fn().mockReturnValue(2),
    });
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockResolvedValue(false),
    });
    const handler = createRoutingStatusHandler(
      () => clientRegistry,
      () => credentialManager,
      mockLogger
    );
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({
      available: false,
      clientCount: 2,
    });
  });

  it("should return zero client count when no clients connected", async () => {
    const clientRegistry = createMockClientRegistry({
      getClientCount: vi.fn().mockReturnValue(0),
    });
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockResolvedValue(true),
    });
    const handler = createRoutingStatusHandler(
      () => clientRegistry,
      () => credentialManager,
      mockLogger
    );
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({
      available: true,
      clientCount: 0,
    });
  });

  it("should return safe default when credential check fails", async () => {
    const clientRegistry = createMockClientRegistry();
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockRejectedValue(new Error("Keychain unavailable")),
    });
    const handler = createRoutingStatusHandler(
      () => clientRegistry,
      () => credentialManager,
      mockLogger
    );
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({
      available: false,
      clientCount: 0,
    });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should log debug message when status is requested", async () => {
    const clientRegistry = createMockClientRegistry({
      getClientCount: vi.fn().mockReturnValue(5),
    });
    const credentialManager = createMockCredentialManager({
      hasCredential: vi.fn().mockResolvedValue(true),
    });
    const handler = createRoutingStatusHandler(
      () => clientRegistry,
      () => credentialManager,
      mockLogger
    );
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    await handler(mockEvent);

    expect(mockLogger.debug).toHaveBeenCalledWith("Routing status requested via IPC", {
      available: true,
      clientCount: 5,
    });
  });
});
