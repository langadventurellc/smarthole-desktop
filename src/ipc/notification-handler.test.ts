/**
 * Unit tests for the IPC notification handler.
 * Tests payload validation, notification enqueuing, and error handling.
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { IpcMainEvent } from "electron";
import { createNotificationHandler, processNotification } from "./notification-handler";
import { Logger } from "../services/logger";
import { NotificationQueue } from "../services/notification-queue";
import { NotifyShowPayload } from "../types";

/**
 * Creates a mock logger for testing.
 */
function createMockLogger(): Logger & {
  error: Mock;
  warn: Mock;
  info: Mock;
  debug: Mock;
  trace: Mock;
  child: Mock;
} {
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
  return mockLogger;
}

/**
 * Creates a mock notification queue for testing.
 */
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

/**
 * Creates a mock IpcMainEvent for testing.
 */
function createMockEvent(): IpcMainEvent {
  return {
    sender: {} as Electron.WebContents,
    frameId: 1,
    processId: 1,
    reply: vi.fn(),
    returnValue: undefined,
    ports: [],
    senderFrame: {} as Electron.WebFrameMain,
  } as unknown as IpcMainEvent;
}

/**
 * Creates a valid notification payload for testing.
 */
function createValidPayload(overrides: Partial<NotifyShowPayload> = {}): NotifyShowPayload {
  return {
    title: "Test Title",
    body: "Test body text",
    type: "info",
    priority: "medium",
    ...overrides,
  };
}

describe("IPC Notification Handler", () => {
  let queue: ReturnType<typeof createMockQueue>;
  let ipcLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    queue = createMockQueue();
    ipcLogger = createMockLogger();
    vi.clearAllMocks();
  });

  describe("createNotificationHandler", () => {
    it("should return a function", () => {
      const handler = createNotificationHandler(queue, ipcLogger);
      expect(typeof handler).toBe("function");
    });

    it("should process valid payloads and enqueue notification", () => {
      const handler = createNotificationHandler(queue, ipcLogger);
      const event = createMockEvent();
      const payload = createValidPayload();

      handler(event, payload);

      expect(queue.enqueue).toHaveBeenCalledWith({
        title: "Test Title",
        body: "Test body text",
        type: "info",
        priority: "medium",
        actions: undefined,
        timeout: undefined,
      });
    });

    it("should reject invalid payloads", () => {
      const handler = createNotificationHandler(queue, ipcLogger);
      const event = createMockEvent();
      const invalidPayload = { invalid: "data" };

      handler(event, invalidPayload);

      expect(ipcLogger.warn).toHaveBeenCalledWith("Invalid notification payload received", {
        payload: invalidPayload,
      });
      expect(queue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("processNotification", () => {
    describe("payload validation", () => {
      it("should return false for null payload", () => {
        const result = processNotification(null, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalledWith("Invalid notification payload received", {
          payload: null,
        });
      });

      it("should return false for undefined payload", () => {
        const result = processNotification(undefined, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for non-object payload", () => {
        const result = processNotification("not an object", queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for payload missing title", () => {
        const payload = { body: "Test", type: "info", priority: "medium" };
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalledWith("Invalid notification payload received", {
          payload,
        });
      });

      it("should return false for payload missing body", () => {
        const payload = { title: "Test", type: "info", priority: "medium" };
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalledWith("Invalid notification payload received", {
          payload,
        });
      });

      it("should return false for payload with invalid type", () => {
        const payload = { title: "Test", body: "Body", type: "invalid", priority: "medium" };
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalledWith("Invalid notification payload received", {
          payload,
        });
      });

      it("should return false for payload with invalid priority", () => {
        const payload = { title: "Test", body: "Body", type: "info", priority: "invalid" };
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalledWith("Invalid notification payload received", {
          payload,
        });
      });

      it("should return false for non-string title", () => {
        const payload = { title: 123, body: "Body", type: "info", priority: "medium" };
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for non-string body", () => {
        const payload = { title: "Test", body: 123, type: "info", priority: "medium" };
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for invalid actions (non-array)", () => {
        const payload = {
          title: "Test",
          body: "Body",
          type: "info",
          priority: "medium",
          actions: "invalid",
        };
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for invalid action item", () => {
        const payload = {
          title: "Test",
          body: "Body",
          type: "info",
          priority: "medium",
          actions: [{ invalid: "action" }],
        };
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });

      it("should return false for non-number timeout", () => {
        const payload = {
          title: "Test",
          body: "Body",
          type: "info",
          priority: "medium",
          timeout: "invalid",
        };
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.warn).toHaveBeenCalled();
      });
    });

    describe("valid payload processing", () => {
      it("should return true for valid minimal payload", () => {
        const payload = createValidPayload();
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(true);
        expect(ipcLogger.warn).not.toHaveBeenCalled();
      });

      it("should return true for payload with all optional fields", () => {
        const payload = createValidPayload({
          actions: [{ label: "Click Me", actionId: "action1" }],
          timeout: 5000,
        });

        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(true);
        expect(queue.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            actions: [{ label: "Click Me", actionId: "action1" }],
            timeout: 5000,
          })
        );
      });

      it("should accept all valid notification types", () => {
        const types = ["info", "warning", "error", "success"] as const;

        for (const type of types) {
          vi.clearAllMocks();
          const payload = createValidPayload({ type });
          const result = processNotification(payload, queue, ipcLogger);

          expect(result).toBe(true);
          expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ type }));
        }
      });

      it("should accept all valid priority levels", () => {
        const priorities = ["low", "medium", "high"] as const;

        for (const priority of priorities) {
          vi.clearAllMocks();
          const payload = createValidPayload({ priority });
          const result = processNotification(payload, queue, ipcLogger);

          expect(result).toBe(true);
          expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ priority }));
        }
      });
    });

    describe("notification enqueuing", () => {
      it("should enqueue valid notification with correct options", () => {
        const payload = createValidPayload({
          title: "Recording Complete",
          body: "Your audio has been processed",
          type: "success",
          priority: "high",
        });

        processNotification(payload, queue, ipcLogger);

        expect(queue.enqueue).toHaveBeenCalledWith({
          title: "Recording Complete",
          body: "Your audio has been processed",
          type: "success",
          priority: "high",
          actions: undefined,
          timeout: undefined,
        });
      });

      it("should log debug message on successful enqueue", () => {
        const payload = createValidPayload();

        processNotification(payload, queue, ipcLogger);

        expect(ipcLogger.debug).toHaveBeenCalledWith("Notification enqueued", {
          title: "Test Title",
          type: "info",
          priority: "medium",
        });
      });

      it("should preserve actions array when provided", () => {
        const payload = createValidPayload({
          actions: [
            { label: "Retry", actionId: "retry" },
            { label: "Cancel", actionId: "cancel" },
          ],
        });

        processNotification(payload, queue, ipcLogger);

        expect(queue.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            actions: [
              { label: "Retry", actionId: "retry" },
              { label: "Cancel", actionId: "cancel" },
            ],
          })
        );
      });
    });

    describe("error handling", () => {
      it("should return false and log error when queue.enqueue throws", () => {
        const payload = createValidPayload();
        queue.enqueue.mockImplementation(() => {
          throw new Error("Queue full");
        });

        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.error).toHaveBeenCalledWith("Failed to enqueue notification", {
          error: "Queue full",
          title: "Test Title",
        });
      });

      it("should handle non-Error exceptions gracefully", () => {
        const payload = createValidPayload();
        queue.enqueue.mockImplementation(() => {
          throw "String error";
        });

        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(false);
        expect(ipcLogger.error).toHaveBeenCalledWith("Failed to enqueue notification", {
          error: "String error",
          title: "Test Title",
        });
      });

      it("should never throw exceptions", () => {
        const payload = createValidPayload();
        queue.enqueue.mockImplementation(() => {
          throw new Error("Catastrophic failure");
        });

        // Should not throw
        expect(() => processNotification(payload, queue, ipcLogger)).not.toThrow();
      });
    });

    describe("edge cases", () => {
      it("should handle empty title string", () => {
        const payload = createValidPayload({ title: "" });
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(true);
        expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ title: "" }));
      });

      it("should handle empty body string", () => {
        const payload = createValidPayload({ body: "" });
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(true);
        expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ body: "" }));
      });

      it("should handle very long title and body", () => {
        const longTitle = "a".repeat(1000);
        const longBody = "b".repeat(5000);
        const payload = createValidPayload({ title: longTitle, body: longBody });

        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(true);
        expect(queue.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({ title: longTitle, body: longBody })
        );
      });

      it("should handle special characters in title and body", () => {
        const payload = createValidPayload({
          title: "Special chars: \n\t\"'<>&",
          body: "More special: \u0000\u001F\u007F",
        });

        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(true);
        expect(queue.enqueue).toHaveBeenCalled();
      });

      it("should handle empty actions array", () => {
        const payload = createValidPayload({ actions: [] });
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(true);
        expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ actions: [] }));
      });

      it("should handle zero timeout", () => {
        const payload = createValidPayload({ timeout: 0 });
        const result = processNotification(payload, queue, ipcLogger);

        expect(result).toBe(true);
        expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ timeout: 0 }));
      });
    });
  });
});
