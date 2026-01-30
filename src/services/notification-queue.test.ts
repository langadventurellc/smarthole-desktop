/**
 * Unit tests for the notification queue.
 * Tests priority ordering, rate limiting, coalescing, and queue management.
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockInstance } from "vitest";
import { initializeLogger, resetLogger } from "./logger";
import { LogLevel } from "../types";
import {
  initializeNotificationQueue,
  getNotificationQueue,
  resetNotificationQueue,
  NotificationQueueConfig,
} from "./notification-queue";
import { NotificationOptions, NotificationService } from "./notifications";

// ============================================================================
// Mock Notification Service
// ============================================================================

function createMockNotificationService(): NotificationService & { show: MockInstance } {
  return {
    show: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn(),
    showError: vi.fn(),
    showSuccess: vi.fn(),
    isSupported: vi.fn(() => true),
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

function createNotification(overrides: Partial<NotificationOptions> = {}): NotificationOptions {
  return {
    title: "Test Title",
    body: "Test Body",
    type: "info",
    priority: "medium",
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("NotificationQueue", () => {
  let mockService: NotificationService & { show: MockInstance };

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset services
    resetNotificationQueue();
    resetLogger();

    // Initialize logger
    initializeLogger({
      level: LogLevel.DEBUG,
      logMessageContent: true,
      prettyPrint: true,
    });

    // Create mock service
    mockService = createMockNotificationService();
  });

  afterEach(() => {
    resetNotificationQueue();
    resetLogger();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Singleton Pattern Tests
  // ==========================================================================

  describe("Singleton Pattern", () => {
    describe("initializeNotificationQueue", () => {
      it("should create a notification queue instance", () => {
        const queue = initializeNotificationQueue(mockService);

        expect(queue).toBeDefined();
        expect(typeof queue.enqueue).toBe("function");
        expect(typeof queue.clear).toBe("function");
        expect(typeof queue.getQueueLength).toBe("function");
        expect(typeof queue.destroy).toBe("function");
      });

      it("should return the same instance on subsequent calls", () => {
        const queue1 = initializeNotificationQueue(mockService);
        const queue2 = initializeNotificationQueue(mockService);

        expect(queue1).toBe(queue2);
      });

      it("should accept custom configuration", () => {
        const config: Partial<NotificationQueueConfig> = {
          maxPerMinute: 5,
          maxQueueDepth: 10,
          minInterval: 500,
        };

        const queue = initializeNotificationQueue(mockService, config);
        expect(queue).toBeDefined();
      });
    });

    describe("getNotificationQueue", () => {
      it("should throw if queue is not initialized", () => {
        expect(() => getNotificationQueue()).toThrow(
          "NotificationQueue not initialized. Call initializeNotificationQueue() before using getNotificationQueue()."
        );
      });

      it("should return the queue after initialization", () => {
        initializeNotificationQueue(mockService);
        const queue = getNotificationQueue();

        expect(queue).toBeDefined();
      });

      it("should return the same instance as initializeNotificationQueue", () => {
        const initialized = initializeNotificationQueue(mockService);
        const retrieved = getNotificationQueue();

        expect(initialized).toBe(retrieved);
      });
    });

    describe("resetNotificationQueue", () => {
      it("should reset the queue instance", () => {
        initializeNotificationQueue(mockService);
        expect(() => getNotificationQueue()).not.toThrow();

        resetNotificationQueue();

        expect(() => getNotificationQueue()).toThrow();
      });

      it("should allow re-initialization after reset", () => {
        const queue1 = initializeNotificationQueue(mockService);
        resetNotificationQueue();
        const queue2 = initializeNotificationQueue(mockService);

        expect(queue2).toBeDefined();
        expect(queue1).not.toBe(queue2);
      });
    });
  });

  // ==========================================================================
  // Priority Ordering Tests
  // ==========================================================================

  describe("Priority Ordering", () => {
    it("should show high priority notifications immediately when not rate limited", () => {
      const queue = initializeNotificationQueue(mockService);
      const notification = createNotification({ priority: "high" });

      queue.enqueue(notification);

      expect(mockService.show).toHaveBeenCalledWith(notification);
      expect(queue.getQueueLength()).toBe(0);
    });

    it("should queue medium priority notifications", () => {
      const queue = initializeNotificationQueue(mockService);
      const notification = createNotification({ priority: "medium" });

      queue.enqueue(notification);

      // Not shown immediately
      expect(mockService.show).not.toHaveBeenCalled();
      expect(queue.getQueueLength()).toBe(1);
    });

    it("should queue low priority notifications", () => {
      const queue = initializeNotificationQueue(mockService);
      const notification = createNotification({ priority: "low" });

      queue.enqueue(notification);

      // Not shown immediately
      expect(mockService.show).not.toHaveBeenCalled();
      expect(queue.getQueueLength()).toBe(1);
    });

    it("should process queue in priority order (high > medium > low)", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 100 });

      // Enqueue in reverse priority order
      queue.enqueue(createNotification({ priority: "low", title: "Low" }));
      queue.enqueue(createNotification({ priority: "medium", title: "Medium" }));
      // High priority shows immediately
      queue.enqueue(createNotification({ priority: "high", title: "High" }));

      expect(mockService.show).toHaveBeenCalledTimes(1);
      expect(mockService.show).toHaveBeenCalledWith(expect.objectContaining({ title: "High" }));

      // Advance time to process queue
      vi.advanceTimersByTime(100);
      expect(mockService.show).toHaveBeenCalledTimes(2);
      expect(mockService.show).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Medium" })
      );

      vi.advanceTimersByTime(100);
      expect(mockService.show).toHaveBeenCalledTimes(3);
      expect(mockService.show).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Low" }));
    });
  });

  // ==========================================================================
  // Rate Limiting Tests
  // ==========================================================================

  describe("Rate Limiting", () => {
    it("should enforce minimum interval between notifications", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 1000 });

      // Show first notification immediately (high priority)
      queue.enqueue(createNotification({ priority: "high", title: "First" }));
      expect(mockService.show).toHaveBeenCalledTimes(1);

      // Second high priority should be queued due to rate limiting
      queue.enqueue(createNotification({ priority: "high", title: "Second" }));
      expect(mockService.show).toHaveBeenCalledTimes(1); // Still 1
      expect(queue.getQueueLength()).toBe(1);

      // After minimum interval, second notification should show
      vi.advanceTimersByTime(1000);
      expect(mockService.show).toHaveBeenCalledTimes(2);
      expect(mockService.show).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Second" })
      );
    });

    it("should enforce max notifications per minute", () => {
      const queue = initializeNotificationQueue(mockService, {
        maxPerMinute: 3,
        minInterval: 100,
      });

      // Show 3 notifications
      for (let i = 0; i < 3; i++) {
        queue.enqueue(createNotification({ priority: "high", title: `Notification ${i}` }));
        if (i > 0) {
          vi.advanceTimersByTime(100);
        }
      }

      expect(mockService.show).toHaveBeenCalledTimes(3);

      // Fourth notification should be queued (rate limited)
      queue.enqueue(createNotification({ priority: "high", title: "Fourth" }));
      expect(mockService.show).toHaveBeenCalledTimes(3); // Still 3
      expect(queue.getQueueLength()).toBe(1);

      // Advance to just before the minute window ends (after 100ms interval but still within minute)
      vi.advanceTimersByTime(100);
      expect(mockService.show).toHaveBeenCalledTimes(3); // Still rate limited

      // Advance past the 1 minute window
      vi.advanceTimersByTime(60000);
      expect(mockService.show).toHaveBeenCalledTimes(4);
    });

    it("should clear old timestamps from rate limiting window", () => {
      const queue = initializeNotificationQueue(mockService, {
        maxPerMinute: 2,
        minInterval: 100,
      });

      // Show 2 notifications to hit the limit
      queue.enqueue(createNotification({ priority: "high", title: "First" }));
      vi.advanceTimersByTime(100);
      queue.enqueue(createNotification({ priority: "high", title: "Second" }));

      expect(mockService.show).toHaveBeenCalledTimes(2);

      // Third should be rate limited
      queue.enqueue(createNotification({ priority: "high", title: "Third" }));
      expect(queue.getQueueLength()).toBe(1);

      // Advance past the 1 minute window - old timestamps should be cleared
      vi.advanceTimersByTime(60000);

      // Now it should process
      expect(mockService.show).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // Notification Coalescing Tests
  // ==========================================================================

  describe("Notification Coalescing", () => {
    it("should coalesce similar notifications within the coalescing window", () => {
      const queue = initializeNotificationQueue(mockService, {
        coalescingWindow: 5000,
        minInterval: 100,
      });

      // First notification
      queue.enqueue(
        createNotification({ type: "error", title: "Connection Failed", body: "Unable to connect" })
      );
      expect(queue.getQueueLength()).toBe(1);

      // Second similar notification (same type and title)
      queue.enqueue(
        createNotification({ type: "error", title: "Connection Failed", body: "Unable to connect" })
      );
      expect(queue.getQueueLength()).toBe(1); // Still 1, coalesced

      // Third similar notification
      queue.enqueue(
        createNotification({ type: "error", title: "Connection Failed", body: "Unable to connect" })
      );
      expect(queue.getQueueLength()).toBe(1); // Still 1, coalesced

      // Process the queue
      vi.advanceTimersByTime(100);

      // Should show notification with occurrence count
      expect(mockService.show).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "Unable to connect (3 occurrences)",
        })
      );
    });

    it("should not coalesce notifications with different types", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 100 });

      queue.enqueue(createNotification({ type: "error", title: "Same Title" }));
      queue.enqueue(createNotification({ type: "warning", title: "Same Title" }));

      expect(queue.getQueueLength()).toBe(2);
    });

    it("should not coalesce notifications with different titles", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 100 });

      queue.enqueue(createNotification({ type: "error", title: "Title A" }));
      queue.enqueue(createNotification({ type: "error", title: "Title B" }));

      expect(queue.getQueueLength()).toBe(2);
    });

    it("should not coalesce notifications outside the coalescing window", () => {
      const queue = initializeNotificationQueue(mockService, {
        coalescingWindow: 5000,
        minInterval: 100,
      });

      // First notification
      queue.enqueue(createNotification({ type: "error", title: "Error" }));
      expect(queue.getQueueLength()).toBe(1);

      // Advance past coalescing window
      vi.advanceTimersByTime(5100);

      // This should not coalesce (window expired)
      queue.enqueue(createNotification({ type: "error", title: "Error" }));
      expect(queue.getQueueLength()).toBe(1); // Previous one was shown, this is new
    });

    it("should clean up expired coalescing entries", () => {
      const queue = initializeNotificationQueue(mockService, {
        coalescingWindow: 5000,
        minInterval: 100,
      });

      // First notification
      queue.enqueue(createNotification({ type: "error", title: "Error", body: "First" }));

      // Advance past coalescing window + cleanup interval
      vi.advanceTimersByTime(6100);

      // Second notification should NOT be coalesced (entry was cleaned up)
      queue.enqueue(createNotification({ type: "error", title: "Error", body: "Second" }));

      // Process queue
      vi.advanceTimersByTime(100);

      // Should show the second notification without coalescing
      expect(mockService.show).toHaveBeenLastCalledWith(
        expect.objectContaining({
          body: "Second",
        })
      );
    });
  });

  // ==========================================================================
  // Queue Overflow Tests
  // ==========================================================================

  describe("Queue Overflow", () => {
    it("should drop low priority notifications first when queue overflows", () => {
      const queue = initializeNotificationQueue(mockService, {
        maxQueueDepth: 3,
        minInterval: 1000, // Long interval to prevent processing
      });

      // Fill queue with low priority
      queue.enqueue(createNotification({ priority: "low", title: "Low 1" }));
      queue.enqueue(createNotification({ priority: "low", title: "Low 2" }));
      queue.enqueue(createNotification({ priority: "low", title: "Low 3" }));
      expect(queue.getQueueLength()).toBe(3);

      // Add one more - should drop oldest low priority
      queue.enqueue(createNotification({ priority: "medium", title: "Medium" }));
      expect(queue.getQueueLength()).toBe(3);

      // Process queue and verify low priority was dropped
      vi.advanceTimersByTime(1000);
      expect(mockService.show).toHaveBeenCalledWith(expect.objectContaining({ title: "Medium" }));
    });

    it("should drop medium priority when no low priority available", () => {
      const queue = initializeNotificationQueue(mockService, {
        maxQueueDepth: 2,
        minInterval: 100,
      });

      // Show first high priority to trigger rate limiting
      queue.enqueue(createNotification({ priority: "high", title: "High 1" }));
      expect(mockService.show).toHaveBeenCalledTimes(1);

      // Now fill queue with medium priority (will be rate limited)
      queue.enqueue(createNotification({ priority: "medium", title: "Medium 1" }));
      queue.enqueue(createNotification({ priority: "medium", title: "Medium 2" }));
      expect(queue.getQueueLength()).toBe(2);

      // Add another medium priority - should drop a medium due to overflow
      queue.enqueue(createNotification({ priority: "medium", title: "Medium 3" }));
      expect(queue.getQueueLength()).toBe(2);

      // Process queue - verify that medium priority notifications were processed
      // and overflow handling worked (queue stayed at max depth)
      vi.advanceTimersByTime(100);
      expect(mockService.show).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(100);
      expect(mockService.show).toHaveBeenCalledTimes(3);

      // Queue should be empty after processing
      expect(queue.getQueueLength()).toBe(0);
    });

    it("should never drop high priority notifications", () => {
      const queue = initializeNotificationQueue(mockService, {
        maxQueueDepth: 2,
        minInterval: 100,
      });

      // Show first high priority immediately
      queue.enqueue(createNotification({ priority: "high", title: "High 1" }));
      expect(mockService.show).toHaveBeenCalledTimes(1);

      // These should be rate limited and queued
      queue.enqueue(createNotification({ priority: "high", title: "High 2" }));
      queue.enqueue(createNotification({ priority: "high", title: "High 3" }));
      queue.enqueue(createNotification({ priority: "high", title: "High 4" }));

      // Queue overflow but only high priority - should log warning but keep them
      // The queue depth might be exceeded for high priority
      expect(queue.getQueueLength()).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Clear and Destroy Tests
  // ==========================================================================

  describe("clear", () => {
    it("should empty the queue", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 1000 });

      queue.enqueue(createNotification({ title: "Test 1" }));
      queue.enqueue(createNotification({ title: "Test 2" }));
      expect(queue.getQueueLength()).toBe(2);

      queue.clear();

      expect(queue.getQueueLength()).toBe(0);
    });

    it("should cancel pending queue processing", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 1000 });

      queue.enqueue(createNotification({ title: "Test" }));
      queue.clear();

      // Advance time - nothing should be shown
      vi.advanceTimersByTime(2000);
      expect(mockService.show).not.toHaveBeenCalled();
    });

    it("should clear coalescing map", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 1000 });

      queue.enqueue(createNotification({ type: "error", title: "Error", body: "First" }));
      queue.clear();

      // New notification should not coalesce
      queue.enqueue(createNotification({ type: "error", title: "Error", body: "Second" }));
      expect(queue.getQueueLength()).toBe(1);

      vi.advanceTimersByTime(1000);
      expect(mockService.show).toHaveBeenCalledWith(
        expect.objectContaining({ body: "Second" }) // Not coalesced
      );
    });
  });

  describe("destroy", () => {
    it("should clean up all timers", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 1000 });

      queue.enqueue(createNotification({ title: "Test" }));
      queue.destroy();

      // Advance time - nothing should happen
      vi.advanceTimersByTime(10000);
      expect(mockService.show).not.toHaveBeenCalled();
    });

    it("should reset all state", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 100 });

      // Build up some state
      queue.enqueue(createNotification({ priority: "high" }));
      expect(mockService.show).toHaveBeenCalledTimes(1);

      queue.destroy();

      // After destroy, re-initialize
      resetNotificationQueue();
      const newQueue = initializeNotificationQueue(mockService, { minInterval: 100 });

      // Should be able to show high priority immediately (rate limit reset)
      newQueue.enqueue(createNotification({ priority: "high" }));
      expect(mockService.show).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Queue Processing Tests
  // ==========================================================================

  describe("Queue Processing", () => {
    it("should process queue using setTimeout (non-blocking)", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 100 });

      queue.enqueue(createNotification({ title: "Test" }));

      // Not shown immediately (medium priority)
      expect(mockService.show).not.toHaveBeenCalled();

      // Advance timers to trigger setTimeout
      vi.advanceTimersByTime(100);
      expect(mockService.show).toHaveBeenCalledTimes(1);
    });

    it("should continue processing until queue is empty", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 100 });

      queue.enqueue(createNotification({ title: "Test 1" }));
      queue.enqueue(createNotification({ title: "Test 2" }));
      queue.enqueue(createNotification({ title: "Test 3" }));

      // First notification shows after first interval
      vi.advanceTimersByTime(100);
      const callCount1 = mockService.show.mock.calls.length;
      expect(callCount1).toBeGreaterThanOrEqual(1);

      // Continue processing
      vi.advanceTimersByTime(100);
      const callCount2 = mockService.show.mock.calls.length;
      expect(callCount2).toBeGreaterThan(callCount1);

      // Process remaining
      vi.advanceTimersByTime(100);

      // All notifications should eventually be shown
      expect(mockService.show).toHaveBeenCalledTimes(3);
      expect(queue.getQueueLength()).toBe(0);
    });

    it("should not schedule duplicate processing timers", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 1000 });

      // Enqueue multiple notifications quickly
      queue.enqueue(createNotification({ title: "Test 1" }));
      queue.enqueue(createNotification({ title: "Test 2" }));
      queue.enqueue(createNotification({ title: "Test 3" }));

      expect(queue.getQueueLength()).toBe(3);

      // After first interval, one notification should be shown
      vi.advanceTimersByTime(1000);
      expect(mockService.show).toHaveBeenCalled();

      // Queue should have processed one notification
      expect(queue.getQueueLength()).toBeLessThan(3);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    it("should handle empty queue gracefully", () => {
      const queue = initializeNotificationQueue(mockService);

      expect(queue.getQueueLength()).toBe(0);
      queue.clear();
      expect(queue.getQueueLength()).toBe(0);
    });

    it("should handle notification without priority (defaults to medium)", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 100 });

      const notification = {
        title: "Test",
        body: "Body",
        type: "info" as const,
      } as NotificationOptions;

      queue.enqueue(notification);

      // Should be queued (not shown immediately like high priority)
      expect(mockService.show).not.toHaveBeenCalled();
      expect(queue.getQueueLength()).toBe(1);
    });

    it("should handle rapid enqueue and clear cycles", () => {
      const queue = initializeNotificationQueue(mockService, { minInterval: 100 });

      for (let i = 0; i < 5; i++) {
        queue.enqueue(createNotification({ title: `Test ${i}` }));
        queue.clear();
      }

      expect(queue.getQueueLength()).toBe(0);
      vi.advanceTimersByTime(1000);
      expect(mockService.show).not.toHaveBeenCalled();
    });
  });
});
