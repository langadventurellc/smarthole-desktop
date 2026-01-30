/**
 * Unit tests for the IPC message delivery handlers.
 * Tests handler behavior, error handling, and Map serialization.
 *
 * @see F-message-delivery-to-clients feature specification
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import {
  createMessageSendHandler,
  createMessageSendMultipleHandler,
  createMessageGetStatusHandler,
  createMessageGetRecentHandler,
} from "./message-delivery-handlers";
import type {
  MessageDeliveryService,
  DeliveryResult,
  DeliveryStatus,
} from "../services/message-delivery";
import type { Logger } from "../services/logger";
import type { IpcRoutedMessage, IpcDeliveryStatus } from "../types";
import type { IpcMainInvokeEvent } from "electron";

// ============================================================================
// Mock Factories
// ============================================================================

function createMockLogger(): Logger & {
  error: Mock;
  warn: Mock;
  info: Mock;
  debug: Mock;
  trace: Mock;
  child: Mock;
} {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  } as Logger & {
    error: Mock;
    warn: Mock;
    info: Mock;
    debug: Mock;
    trace: Mock;
    child: Mock;
  };
}

function createMockDeliveryService(
  overrides: Partial<MessageDeliveryService> = {}
): MessageDeliveryService {
  return {
    sendToClient: vi
      .fn()
      .mockReturnValue({ success: true, deliveredAt: "2024-01-15T10:00:00.000Z" }),
    sendToClients: vi.fn().mockReturnValue(new Map()),
    getDeliveryStatus: vi.fn().mockReturnValue(undefined),
    getRecentDeliveries: vi.fn().mockReturnValue([]),
    clearDeliveryHistory: vi.fn(),
    handleResponse: vi.fn().mockReturnValue({ handled: false, reason: "not_response" }),
    on: vi.fn(),
    off: vi.fn(),
    ...overrides,
  };
}

function createTestMessage(overrides: Partial<IpcRoutedMessage> = {}): IpcRoutedMessage {
  return {
    id: "test-msg-123",
    text: "Test message content",
    timestamp: "2024-01-15T10:00:00.000Z",
    metadata: {
      inputMethod: "text",
      directRouted: false,
    },
    ...overrides,
  };
}

function createTestDeliveryStatus(overrides: Partial<DeliveryStatus> = {}): DeliveryStatus {
  return {
    messageId: "test-msg-123" as DeliveryStatus["messageId"],
    clientName: "test-client",
    result: {
      success: true,
      deliveredAt: "2024-01-15T10:00:00.000Z" as DeliveryStatus["attemptedAt"],
    },
    attemptedAt: "2024-01-15T10:00:00.000Z" as DeliveryStatus["attemptedAt"],
    ...overrides,
  };
}

const mockEvent = {} as IpcMainInvokeEvent;

// ============================================================================
// Tests
// ============================================================================

describe("createMessageSendHandler", () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should return failure when delivery service is not initialized", () => {
    const handler = createMessageSendHandler(() => null, logger);
    const result = handler(mockEvent, "test-client", createTestMessage());

    expect(result).toEqual({ success: false, error: "SEND_FAILED" });
    expect(logger.warn).toHaveBeenCalledWith("Message delivery service not initialized");
  });

  it("should call sendToClient and return the result", () => {
    const service = createMockDeliveryService({
      sendToClient: vi
        .fn()
        .mockReturnValue({ success: true, deliveredAt: "2024-01-15T10:00:00.000Z" }),
    });
    const handler = createMessageSendHandler(() => service, logger);
    const message = createTestMessage();

    const result = handler(mockEvent, "notebook", message);

    expect(result).toEqual({ success: true, deliveredAt: "2024-01-15T10:00:00.000Z" });
    expect(service.sendToClient).toHaveBeenCalledWith(
      "notebook",
      expect.objectContaining({
        id: message.id,
        text: message.text,
      })
    );
  });

  it("should return failure when sendToClient throws", () => {
    const service = createMockDeliveryService({
      sendToClient: vi.fn().mockImplementation(() => {
        throw new Error("Connection error");
      }),
    });
    const handler = createMessageSendHandler(() => service, logger);

    const result = handler(mockEvent, "test-client", createTestMessage());

    expect(result).toEqual({ success: false, error: "SEND_FAILED" });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("createMessageSendMultipleHandler", () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should return empty results when delivery service is not initialized", () => {
    const handler = createMessageSendMultipleHandler(() => null, logger);
    const result = handler(mockEvent, ["client1", "client2"], createTestMessage());

    expect(result).toEqual({ results: [] });
  });

  it("should convert Map results to array of entries for IPC serialization", () => {
    const resultsMap = new Map<string, DeliveryResult>([
      [
        "client1",
        { success: true, deliveredAt: "2024-01-15T10:00:00.000Z" as DeliveryStatus["attemptedAt"] },
      ],
      ["client2", { success: false, error: "CLIENT_NOT_FOUND" }],
    ]);
    const service = createMockDeliveryService({
      sendToClients: vi.fn().mockReturnValue(resultsMap),
    });
    const handler = createMessageSendMultipleHandler(() => service, logger);

    const result = handler(mockEvent, ["client1", "client2"], createTestMessage());

    expect(result.results).toHaveLength(2);
    expect(result.results).toContainEqual([
      "client1",
      { success: true, deliveredAt: "2024-01-15T10:00:00.000Z" },
    ]);
    expect(result.results).toContainEqual([
      "client2",
      { success: false, error: "CLIENT_NOT_FOUND" },
    ]);
  });
});

describe("createMessageGetStatusHandler", () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should return null when delivery service is not initialized", () => {
    const handler = createMessageGetStatusHandler(() => null, logger);
    const result = handler(mockEvent, "test-msg-123");

    expect(result).toBeNull();
  });

  it("should return null when message not found", () => {
    const service = createMockDeliveryService({
      getDeliveryStatus: vi.fn().mockReturnValue(undefined),
    });
    const handler = createMessageGetStatusHandler(() => service, logger);

    const result = handler(mockEvent, "unknown-msg");

    expect(result).toBeNull();
  });

  it("should return delivery status as IPC-serializable object", () => {
    const status = createTestDeliveryStatus({
      response: {
        type: "ack",
        receivedAt: "2024-01-15T10:01:00.000Z" as DeliveryStatus["attemptedAt"],
      },
    });
    const service = createMockDeliveryService({
      getDeliveryStatus: vi.fn().mockReturnValue(status),
    });
    const handler = createMessageGetStatusHandler(() => service, logger);

    const result = handler(mockEvent, "test-msg-123") as IpcDeliveryStatus;

    expect(result).not.toBeNull();
    expect(result.messageId).toBe("test-msg-123");
    expect(result.clientName).toBe("test-client");
    expect(result.result.success).toBe(true);
    expect(result.response?.type).toBe("ack");
  });
});

describe("createMessageGetRecentHandler", () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should return empty array when delivery service is not initialized", () => {
    const handler = createMessageGetRecentHandler(() => null, logger);
    const result = handler(mockEvent, 10);

    expect(result).toEqual([]);
  });

  it("should return array of delivery statuses", () => {
    const statuses = [
      createTestDeliveryStatus({ messageId: "msg-1" as DeliveryStatus["messageId"] }),
      createTestDeliveryStatus({ messageId: "msg-2" as DeliveryStatus["messageId"] }),
    ];
    const service = createMockDeliveryService({
      getRecentDeliveries: vi.fn().mockReturnValue(statuses),
    });
    const handler = createMessageGetRecentHandler(() => service, logger);

    const result = handler(mockEvent, 10);

    expect(result).toHaveLength(2);
    expect(result[0].messageId).toBe("msg-1");
    expect(result[1].messageId).toBe("msg-2");
    expect(service.getRecentDeliveries).toHaveBeenCalledWith(10);
  });

  it("should pass undefined limit when not provided", () => {
    const service = createMockDeliveryService();
    const handler = createMessageGetRecentHandler(() => service, logger);

    handler(mockEvent);

    expect(service.getRecentDeliveries).toHaveBeenCalledWith(undefined);
  });
});
