/**
 * Integration tests for the notification system.
 * Tests the full flow from IPC message receipt through queue processing to notification display.
 *
 * These tests verify end-to-end behavior with real services (NotificationService, NotificationQueue)
 * but with mocked Electron Notification API.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initializeLogger, resetLogger } from "./logger";
import { LogLevel, NotifyShowPayload } from "../types";

// ============================================================================
// Mocks - Use vi.hoisted() to ensure variables are available for hoisted vi.mock
// ============================================================================

const { mockNotificationShow, mockNotificationOn, mockNotificationConstructor, mockIsSupported } =
  vi.hoisted(() => ({
    mockNotificationShow: vi.fn(),
    mockNotificationOn: vi.fn(),
    mockNotificationConstructor: vi.fn(),
    mockIsSupported: vi.fn(() => true),
  }));

// Mock Electron's Notification
vi.mock("electron", () => {
  const MockNotification = function (
    this: { show: () => void; on: (event: string, handler: () => void) => void },
    options: { title: string; body: string }
  ) {
    mockNotificationConstructor(options);
    this.show = mockNotificationShow;
    this.on = mockNotificationOn;
  } as unknown as {
    new (options: { title: string; body: string }): {
      show: () => void;
      on: (event: string, handler: () => void) => void;
    };
    isSupported: () => boolean;
  };

  MockNotification.isSupported = mockIsSupported;

  return {
    Notification: MockNotification,
  };
});

// Import after mocks are set up
import {
  initializeNotificationService,
  resetNotificationService,
  NotificationService,
} from "./notifications";
import {
  initializeNotificationQueue,
  resetNotificationQueue,
  NotificationQueue,
} from "./notification-queue";
import { processNotification } from "../ipc/notification-handler";
import { getLogger, Logger } from "./logger";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a valid NotifyShowPayload for testing.
 */
function createValidPayload(overrides: Partial<NotifyShowPayload> = {}): NotifyShowPayload {
  return {
    title: "Test Notification",
    body: "This is a test notification body",
    type: "info",
    priority: "medium",
    ...overrides,
  };
}

// ============================================================================
// Test Suite: Notification System Integration
// ============================================================================

describe("Notification System Integration", () => {
  let notificationService: NotificationService;
  let notificationQueue: NotificationQueue;
  let ipcLogger: Logger;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset all mocks
    vi.clearAllMocks();
    mockIsSupported.mockReturnValue(true);

    // Reset services
    resetNotificationQueue();
    resetNotificationService();
    resetLogger();

    // Initialize logger (required for notification services)
    initializeLogger({
      level: LogLevel.DEBUG,
      logMessageContent: true,
      prettyPrint: true,
    });

    // Initialize notification service and queue (real instances)
    notificationService = initializeNotificationService();
    notificationQueue = initializeNotificationQueue(notificationService, {
      maxPerMinute: 10,
      minInterval: 1000,
      maxQueueDepth: 20,
      coalescingWindow: 5000,
    });

    // Create IPC logger for notification handler
    ipcLogger = getLogger().child({ component: "IPC" });
  });

  afterEach(() => {
    resetNotificationQueue();
    resetNotificationService();
    resetLogger();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Full Flow Tests: IPC -> Queue -> Service -> Display
  // ==========================================================================

  describe("Full Flow: IPC to Display", () => {
    it("should process valid notification through full flow: IPC -> Queue -> Service", () => {
      const payload = createValidPayload({
        title: "Full Flow Test",
        body: "Testing the complete notification flow",
        type: "info",
        priority: "medium",
      });

      // Process notification via IPC handler
      const result = processNotification(payload, notificationQueue, ipcLogger);
      expect(result).toBe(true);

      // Medium priority notifications are queued, not shown immediately
      expect(mockNotificationShow).not.toHaveBeenCalled();
      expect(notificationQueue.getQueueLength()).toBe(1);

      // Advance time to process queue
      vi.advanceTimersByTime(1000);

      // Notification should now be displayed
      expect(mockNotificationShow).toHaveBeenCalledTimes(1);
      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Full Flow Test",
        body: "Testing the complete notification flow",
      });
      expect(notificationQueue.getQueueLength()).toBe(0);
    });

    it("should handle multiple notifications through full flow in sequence", () => {
      // Send three notifications with unique titles to avoid coalescing
      for (let i = 1; i <= 3; i++) {
        const payload = createValidPayload({
          title: `Notification ${i}`,
          body: `Body ${i}`,
          type: i === 1 ? "info" : i === 2 ? "warning" : "success", // Different types to avoid coalescing
          priority: "medium",
        });
        const result = processNotification(payload, notificationQueue, ipcLogger);
        expect(result).toBe(true);
      }

      expect(notificationQueue.getQueueLength()).toBe(3);

      // Process all notifications - advance enough time for all to be processed
      // With minInterval of 1000ms, we need 3000ms total
      vi.advanceTimersByTime(3000);

      // All three notifications should have been shown
      expect(mockNotificationShow).toHaveBeenCalledTimes(3);
      expect(notificationQueue.getQueueLength()).toBe(0);
    });

    it("should preserve notification content through the full flow", () => {
      const payload = createValidPayload({
        title: "Preserve Content Test",
        body: "Body content should be preserved",
        type: "success",
        priority: "medium",
      });

      processNotification(payload, notificationQueue, ipcLogger);
      vi.advanceTimersByTime(1000);

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Preserve Content Test",
        body: "Body content should be preserved",
      });
    });
  });

  // ==========================================================================
  // High Priority Immediate Display Tests
  // ==========================================================================

  describe("High Priority Notifications", () => {
    it("should display high priority notifications immediately when not rate limited", () => {
      const payload = createValidPayload({
        title: "Urgent Alert",
        body: "This is urgent!",
        type: "error",
        priority: "high",
      });

      const result = processNotification(payload, notificationQueue, ipcLogger);
      expect(result).toBe(true);

      // High priority should show immediately without timer advance
      expect(mockNotificationShow).toHaveBeenCalledTimes(1);
      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Urgent Alert",
        body: "This is urgent!",
      });
      expect(notificationQueue.getQueueLength()).toBe(0);
    });

    it("should queue high priority notifications when rate limited", () => {
      // First high priority shows immediately
      const firstPayload = createValidPayload({
        title: "First High Priority",
        priority: "high",
      });
      processNotification(firstPayload, notificationQueue, ipcLogger);
      expect(mockNotificationShow).toHaveBeenCalledTimes(1);

      // Second high priority is rate limited (within minInterval)
      const secondPayload = createValidPayload({
        title: "Second High Priority",
        priority: "high",
      });
      processNotification(secondPayload, notificationQueue, ipcLogger);
      expect(mockNotificationShow).toHaveBeenCalledTimes(1); // Still 1
      expect(notificationQueue.getQueueLength()).toBe(1);

      // After minInterval, second notification shows
      vi.advanceTimersByTime(1000);
      expect(mockNotificationShow).toHaveBeenCalledTimes(2);
    });

    it("should prioritize high priority over medium/low in queue", () => {
      // Reset to allow first high priority to show
      // First, show a high priority to start rate limiting
      processNotification(
        createValidPayload({ title: "First", priority: "high" }),
        notificationQueue,
        ipcLogger
      );
      expect(mockNotificationShow).toHaveBeenCalledTimes(1);

      // Now queue: low, medium, then high
      processNotification(
        createValidPayload({ title: "Low Priority", priority: "low" }),
        notificationQueue,
        ipcLogger
      );
      processNotification(
        createValidPayload({ title: "Medium Priority", priority: "medium" }),
        notificationQueue,
        ipcLogger
      );
      processNotification(
        createValidPayload({ title: "High Priority", priority: "high" }),
        notificationQueue,
        ipcLogger
      );

      // Queue should have 3 items
      expect(notificationQueue.getQueueLength()).toBe(3);

      // Process next - should be high priority first due to priority ordering
      vi.advanceTimersByTime(1000);
      expect(mockNotificationConstructor).toHaveBeenLastCalledWith({
        title: "High Priority",
        body: expect.any(String),
      });

      // Then medium
      vi.advanceTimersByTime(1000);
      expect(mockNotificationConstructor).toHaveBeenLastCalledWith({
        title: "Medium Priority",
        body: expect.any(String),
      });

      // Then low
      vi.advanceTimersByTime(1000);
      expect(mockNotificationConstructor).toHaveBeenLastCalledWith({
        title: "Low Priority",
        body: expect.any(String),
      });
    });
  });

  // ==========================================================================
  // Rate Limiting Integration Tests
  // ==========================================================================

  describe("Rate Limiting Integration", () => {
    it("should enforce rate limiting across the system", () => {
      // Send 15 notifications with unique titles via IPC handler
      for (let i = 0; i < 15; i++) {
        const payload = createValidPayload({
          title: `Notification ${i + 1}`,
          type: "info",
          priority: "high", // High priority to try immediate display
        });
        processNotification(payload, notificationQueue, ipcLogger);
      }

      // First one shows immediately, rest are rate limited due to minInterval
      expect(mockNotificationShow).toHaveBeenCalledTimes(1);

      // Process 9 more notifications at minInterval (1 second each)
      vi.advanceTimersByTime(9000);

      // Should have shown 10 (maxPerMinute limit reached)
      expect(mockNotificationShow).toHaveBeenCalledTimes(10);

      // 5 notifications still queued
      expect(notificationQueue.getQueueLength()).toBe(5);

      // Advance past the 1 minute window so rate limit resets
      vi.advanceTimersByTime(60000);

      // Now we can process more - all remaining 5 should eventually be shown
      // Advance enough time for remaining notifications
      vi.advanceTimersByTime(5000);

      // All 15 notifications should have been shown
      expect(mockNotificationShow).toHaveBeenCalledTimes(15);
      expect(notificationQueue.getQueueLength()).toBe(0);
    });

    it("should respect minimum interval between notifications", () => {
      // Send two medium priority notifications with different types to avoid coalescing
      processNotification(
        createValidPayload({ title: "First", type: "info", priority: "medium" }),
        notificationQueue,
        ipcLogger
      );
      processNotification(
        createValidPayload({ title: "Second", type: "warning", priority: "medium" }),
        notificationQueue,
        ipcLogger
      );

      // Neither shown yet (medium priority, no time elapsed)
      expect(mockNotificationShow).not.toHaveBeenCalled();
      expect(notificationQueue.getQueueLength()).toBe(2);

      // Process both notifications - need 2 intervals
      vi.advanceTimersByTime(2000);

      // Both should now be shown
      expect(mockNotificationShow).toHaveBeenCalledTimes(2);
      expect(notificationQueue.getQueueLength()).toBe(0);
    });

    it("should clean rate limiting window after 60 seconds", () => {
      // Fill up the rate limit
      for (let i = 0; i < 10; i++) {
        processNotification(
          createValidPayload({ title: `Notification ${i}`, priority: "high" }),
          notificationQueue,
          ipcLogger
        );
        if (i > 0) {
          vi.advanceTimersByTime(1000);
        }
      }

      expect(mockNotificationShow).toHaveBeenCalledTimes(10);

      // Add one more - should be queued (rate limited)
      processNotification(
        createValidPayload({ title: "Extra", priority: "high" }),
        notificationQueue,
        ipcLogger
      );
      expect(notificationQueue.getQueueLength()).toBe(1);

      // Wait for rate limit window to expire
      vi.advanceTimersByTime(60000);

      // Should now process the queued notification
      expect(mockNotificationShow).toHaveBeenCalledTimes(11);
    });
  });

  // ==========================================================================
  // Invalid Payload Rejection Tests
  // ==========================================================================

  describe("Invalid Payload Rejection at IPC Layer", () => {
    it("should reject payload missing title", () => {
      const invalidPayload = {
        body: "Body without title",
        type: "info",
        priority: "medium",
      };

      const result = processNotification(invalidPayload, notificationQueue, ipcLogger);

      expect(result).toBe(false);
      expect(mockNotificationShow).not.toHaveBeenCalled();
      expect(notificationQueue.getQueueLength()).toBe(0);
    });

    it("should reject payload missing body", () => {
      const invalidPayload = {
        title: "Title without body",
        type: "info",
        priority: "medium",
      };

      const result = processNotification(invalidPayload, notificationQueue, ipcLogger);

      expect(result).toBe(false);
      expect(mockNotificationShow).not.toHaveBeenCalled();
      expect(notificationQueue.getQueueLength()).toBe(0);
    });

    it("should reject payload missing type", () => {
      const invalidPayload = {
        title: "Test",
        body: "Body",
        priority: "medium",
      };

      const result = processNotification(invalidPayload, notificationQueue, ipcLogger);

      expect(result).toBe(false);
      expect(mockNotificationShow).not.toHaveBeenCalled();
      expect(notificationQueue.getQueueLength()).toBe(0);
    });

    it("should reject payload missing priority", () => {
      const invalidPayload = {
        title: "Test",
        body: "Body",
        type: "info",
      };

      const result = processNotification(invalidPayload, notificationQueue, ipcLogger);

      expect(result).toBe(false);
      expect(mockNotificationShow).not.toHaveBeenCalled();
      expect(notificationQueue.getQueueLength()).toBe(0);
    });

    it("should reject payload with invalid type", () => {
      const invalidPayload = {
        title: "Test",
        body: "Body",
        type: "invalid-type",
        priority: "medium",
      };

      const result = processNotification(invalidPayload, notificationQueue, ipcLogger);

      expect(result).toBe(false);
      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    it("should reject payload with invalid priority", () => {
      const invalidPayload = {
        title: "Test",
        body: "Body",
        type: "info",
        priority: "invalid-priority",
      };

      const result = processNotification(invalidPayload, notificationQueue, ipcLogger);

      expect(result).toBe(false);
      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    it("should reject null payload", () => {
      const result = processNotification(null, notificationQueue, ipcLogger);

      expect(result).toBe(false);
      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    it("should reject undefined payload", () => {
      const result = processNotification(undefined, notificationQueue, ipcLogger);

      expect(result).toBe(false);
      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    it("should reject non-object payload", () => {
      const result = processNotification("not an object", notificationQueue, ipcLogger);

      expect(result).toBe(false);
      expect(mockNotificationShow).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Graceful Degradation Tests
  // ==========================================================================

  describe("Graceful Degradation When Notifications Not Supported", () => {
    beforeEach(() => {
      // Make notifications unsupported
      mockIsSupported.mockReturnValue(false);

      // Re-initialize services with unsupported notifications
      resetNotificationQueue();
      resetNotificationService();

      notificationService = initializeNotificationService();
      notificationQueue = initializeNotificationQueue(notificationService, {
        maxPerMinute: 10,
        minInterval: 1000,
        maxQueueDepth: 20,
        coalescingWindow: 5000,
      });
    });

    it("should handle notifications gracefully when not supported (no errors)", () => {
      const payload = createValidPayload({
        title: "Test When Unsupported",
        body: "This should not throw",
        priority: "high",
      });

      // Should not throw
      expect(() => {
        processNotification(payload, notificationQueue, ipcLogger);
      }).not.toThrow();

      // IPC handler returns true (payload was valid and processed)
      const result = processNotification(payload, notificationQueue, ipcLogger);
      expect(result).toBe(true);
    });

    it("should not attempt to show notification when not supported", () => {
      const payload = createValidPayload({
        title: "Unsupported Platform",
        priority: "high",
      });

      processNotification(payload, notificationQueue, ipcLogger);

      // Notification constructor and show should not be called
      // The high priority notification is "shown" but the service
      // checks isSupported and logs a warning instead
      // In this case, the notification goes through the queue and service,
      // but the service doesn't create Notification object

      // Actually the notification IS shown via queue, but service.show()
      // returns early without creating Notification when not supported
      // So mockNotificationConstructor should NOT be called
      expect(mockNotificationConstructor).not.toHaveBeenCalled();
      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    it("should process multiple notifications without errors when not supported", () => {
      // Send multiple notifications
      for (let i = 0; i < 5; i++) {
        const payload = createValidPayload({
          title: `Notification ${i}`,
          type: "info",
          priority: "medium",
        });
        expect(() => {
          processNotification(payload, notificationQueue, ipcLogger);
        }).not.toThrow();
      }

      // Process the queue
      vi.advanceTimersByTime(10000);

      // No actual notifications should be created
      expect(mockNotificationConstructor).not.toHaveBeenCalled();
    });

    it("should continue accepting and validating payloads when not supported", () => {
      // Valid payload should return true
      const validPayload = createValidPayload();
      expect(processNotification(validPayload, notificationQueue, ipcLogger)).toBe(true);

      // Invalid payload should still return false (validation still works)
      const invalidPayload = { title: "Missing fields" };
      expect(processNotification(invalidPayload, notificationQueue, ipcLogger)).toBe(false);
    });
  });

  // ==========================================================================
  // Notification Coalescing Integration Tests
  // ==========================================================================

  describe("Notification Coalescing Integration", () => {
    it("should coalesce similar notifications through the full flow", () => {
      // Send three similar notifications
      for (let i = 0; i < 3; i++) {
        const payload = createValidPayload({
          title: "Connection Error",
          body: "Failed to connect to server",
          type: "error",
          priority: "medium",
        });
        processNotification(payload, notificationQueue, ipcLogger);
      }

      // Should be coalesced into one queued notification
      expect(notificationQueue.getQueueLength()).toBe(1);

      // Process queue
      vi.advanceTimersByTime(1000);

      // Only one notification shown, with occurrence count
      expect(mockNotificationShow).toHaveBeenCalledTimes(1);
      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Connection Error",
        body: "Failed to connect to server (3 occurrences)",
      });
    });

    it("should not coalesce notifications with different titles", () => {
      processNotification(
        createValidPayload({ title: "Error A", type: "error", priority: "medium" }),
        notificationQueue,
        ipcLogger
      );
      processNotification(
        createValidPayload({ title: "Error B", type: "error", priority: "medium" }),
        notificationQueue,
        ipcLogger
      );

      expect(notificationQueue.getQueueLength()).toBe(2);
    });

    it("should not coalesce notifications with different types", () => {
      processNotification(
        createValidPayload({ title: "Same Title", type: "error", priority: "medium" }),
        notificationQueue,
        ipcLogger
      );
      processNotification(
        createValidPayload({ title: "Same Title", type: "warning", priority: "medium" }),
        notificationQueue,
        ipcLogger
      );

      expect(notificationQueue.getQueueLength()).toBe(2);
    });
  });

  // ==========================================================================
  // Content Sanitization Integration Tests
  // ==========================================================================

  describe("Content Sanitization Integration", () => {
    it("should sanitize HTML content through the full flow", () => {
      const payload = createValidPayload({
        title: "<b>Bold Title</b>",
        body: "<script>alert('xss')</script>Safe content",
        priority: "high",
      });

      processNotification(payload, notificationQueue, ipcLogger);

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Bold Title",
        body: "alert('xss')Safe content",
      });
    });

    it("should handle special characters in notification content", () => {
      const payload = createValidPayload({
        title: 'Title with "quotes" and \\ backslash',
        body: "Body with unicode: \u00e9\u00e8\u00ea",
        priority: "high",
      });

      processNotification(payload, notificationQueue, ipcLogger);

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: 'Title with "quotes" and \\ backslash',
        body: "Body with unicode: \u00e9\u00e8\u00ea",
      });
    });
  });

  // ==========================================================================
  // Queue Overflow Integration Tests
  // ==========================================================================

  describe("Queue Overflow Integration", () => {
    beforeEach(() => {
      // Re-initialize with smaller queue depth
      resetNotificationQueue();
      notificationQueue = initializeNotificationQueue(notificationService, {
        maxPerMinute: 10,
        minInterval: 1000,
        maxQueueDepth: 3,
        coalescingWindow: 5000,
      });
    });

    it("should handle queue overflow by dropping low priority notifications", () => {
      // Fill queue with low priority (different types to avoid coalescing)
      const types = ["info", "warning", "error"] as const;
      for (let i = 0; i < 3; i++) {
        processNotification(
          createValidPayload({ title: `Low ${i}`, type: types[i], priority: "low" }),
          notificationQueue,
          ipcLogger
        );
      }

      expect(notificationQueue.getQueueLength()).toBe(3);

      // Add medium priority - should drop a low priority to make room
      processNotification(
        createValidPayload({ title: "Medium", type: "success", priority: "medium" }),
        notificationQueue,
        ipcLogger
      );

      // Queue depth maintained at 3
      expect(notificationQueue.getQueueLength()).toBe(3);

      // Process entire queue
      vi.advanceTimersByTime(3000);

      // Medium should be shown first (higher priority)
      // Find the call where "Medium" was shown
      const calls = mockNotificationConstructor.mock.calls;
      const firstCallTitle = calls[0][0].title;
      expect(firstCallTitle).toBe("Medium");

      // All notifications processed
      expect(notificationQueue.getQueueLength()).toBe(0);
    });
  });
});
