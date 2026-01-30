/**
 * Unit tests for the IPC notification handler.
 * Tests payload validation, notification enqueuing, and error handling.
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { processNotification } from "./notification-handler";
import { Logger } from "../services/logger";
import { NotificationQueue } from "../services/notification-queue";
import { NotifyShowPayload } from "../types";

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
  };
}

function createMockQueue(): NotificationQueue & {
  enqueue: Mock;
  clear: Mock;
  getQueueLength: Mock;
  destroy: Mock;
} {
  return {
    enqueue: vi.fn(),
    clear: vi.fn(),
    getQueueLength: vi.fn(() => 0),
    destroy: vi.fn(),
  };
}

function createValidPayload(overrides: Partial<NotifyShowPayload> = {}): NotifyShowPayload {
  return {
    title: "Test Title",
    body: "Test body text",
    type: "info",
    priority: "medium",
    ...overrides,
  };
}

describe("processNotification", () => {
  let queue: ReturnType<typeof createMockQueue>;
  let ipcLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    queue = createMockQueue();
    ipcLogger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should reject invalid payloads", () => {
    expect(processNotification(null, queue, ipcLogger)).toBe(false);
    expect(
      processNotification({ body: "Test", type: "info", priority: "medium" }, queue, ipcLogger)
    ).toBe(false); // missing title
    expect(
      processNotification(
        { title: "Test", body: "Body", type: "invalid", priority: "medium" },
        queue,
        ipcLogger
      )
    ).toBe(false);

    expect(ipcLogger.warn).toHaveBeenCalled();
  });

  it("should enqueue valid notification with correct options", () => {
    const payload = createValidPayload({
      title: "Recording Complete",
      body: "Your audio has been processed",
      type: "success",
      priority: "high",
      actions: [{ label: "Retry", actionId: "retry" }],
    });

    processNotification(payload, queue, ipcLogger);

    expect(queue.enqueue).toHaveBeenCalledWith({
      title: "Recording Complete",
      body: "Your audio has been processed",
      type: "success",
      priority: "high",
      actions: [{ label: "Retry", actionId: "retry" }],
      timeout: undefined,
    });
  });

  it("should handle enqueue errors gracefully without throwing", () => {
    const payload = createValidPayload();
    queue.enqueue.mockImplementation(() => {
      throw new Error("Queue full");
    });

    expect(() => processNotification(payload, queue, ipcLogger)).not.toThrow();
    expect(processNotification(payload, queue, ipcLogger)).toBe(false);
    expect(ipcLogger.error).toHaveBeenCalled();
  });
});
