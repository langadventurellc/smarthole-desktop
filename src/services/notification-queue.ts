/**
 * Notification queue for managing notification delivery.
 * Provides priority ordering, rate limiting, and notification coalescing
 * to prevent spam and ensure important notifications are shown promptly.
 *
 * @see F-system-notifications feature specification
 */

import { getLogger, Logger } from "./logger";
import { NotificationOptions, NotificationService } from "./notifications";
import { NotificationPriority } from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the notification queue.
 */
export interface NotificationQueueConfig {
  /** Maximum notifications per minute (default: 10) */
  maxPerMinute: number;
  /** Maximum queue depth before dropping low priority (default: 20) */
  maxQueueDepth: number;
  /** Minimum interval between notifications in ms (default: 1000) */
  minInterval: number;
  /** Window for coalescing similar notifications in ms (default: 5000) */
  coalescingWindow: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: NotificationQueueConfig = {
  maxPerMinute: 10,
  maxQueueDepth: 20,
  minInterval: 1000,
  coalescingWindow: 5000,
};

/**
 * Internal representation of a queued notification with metadata.
 */
interface QueuedNotification {
  /** The notification options */
  notification: NotificationOptions;
  /** Timestamp when the notification was enqueued */
  enqueuedAt: number;
  /** Priority for queue ordering */
  priority: NotificationPriority;
}

/**
 * Tracks coalesced notifications for grouping similar notifications.
 */
interface CoalescedNotification {
  /** The original notification */
  notification: NotificationOptions;
  /** Number of occurrences */
  count: number;
  /** Timestamp of first occurrence */
  firstOccurrence: number;
  /** Timestamp of last update */
  lastUpdate: number;
}

/**
 * Notification queue interface.
 * Provides methods for managing notification delivery.
 */
export interface NotificationQueue {
  /**
   * Enqueue a notification for display.
   * High priority notifications may be shown immediately if not rate limited.
   *
   * @param notification - The notification to enqueue
   */
  enqueue(notification: NotificationOptions): void;

  /**
   * Clear all pending notifications from the queue.
   */
  clear(): void;

  /**
   * Get the current number of notifications in the queue.
   *
   * @returns The number of queued notifications
   */
  getQueueLength(): number;

  /**
   * Destroy the queue and clean up resources.
   * Clears timers and resets state.
   */
  destroy(): void;
}

// ============================================================================
// Priority Helpers
// ============================================================================

/**
 * Priority order for sorting (higher value = higher priority).
 */
const PRIORITY_ORDER: Record<NotificationPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Get numeric priority value for sorting.
 */
function getPriorityValue(priority: NotificationPriority): number {
  return PRIORITY_ORDER[priority] ?? 1;
}

/**
 * Generate a coalescing key for a notification.
 * Notifications with the same key can be coalesced.
 */
function getCoalescingKey(notification: NotificationOptions): string {
  return `${notification.type}:${notification.title}`;
}

// ============================================================================
// Notification Queue Implementation
// ============================================================================

/**
 * Internal implementation of the NotificationQueue.
 */
class NotificationQueueImpl implements NotificationQueue {
  private readonly logger: Logger;
  private readonly service: NotificationService;
  private readonly config: NotificationQueueConfig;

  /** Queue of pending notifications */
  private queue: QueuedNotification[] = [];

  /** Timestamps of recently shown notifications for rate limiting */
  private recentNotifications: number[] = [];

  /** Timestamp of last shown notification */
  private lastShown: number = 0;

  /** Timer for processing the queue */
  private processTimer: NodeJS.Timeout | null = null;

  /** Map of coalescing keys to coalesced notifications */
  private coalescingMap: Map<string, CoalescedNotification> = new Map();

  /** Timer for cleaning up expired coalescing entries */
  private coalescingCleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Create a new NotificationQueueImpl.
   *
   * @param service - The notification service to use for displaying notifications
   * @param config - Optional configuration overrides
   */
  constructor(service: NotificationService, config: Partial<NotificationQueueConfig> = {}) {
    this.logger = getLogger().child({ component: "NotificationQueue" });
    this.service = service;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start coalescing cleanup timer
    this.startCoalescingCleanup();
  }

  /**
   * Enqueue a notification for display.
   */
  enqueue(notification: NotificationOptions): void {
    const now = Date.now();
    const priority = notification.priority ?? "medium";

    // Check for coalescing opportunity
    const coalescingKey = getCoalescingKey(notification);
    const coalesced = this.coalescingMap.get(coalescingKey);

    if (coalesced && now - coalesced.lastUpdate < this.config.coalescingWindow) {
      // Update the coalesced notification
      coalesced.count++;
      coalesced.lastUpdate = now;
      coalesced.notification = {
        ...notification,
        body: `${notification.body} (${coalesced.count} occurrences)`,
      };

      this.logger.debug("Coalesced notification", {
        key: coalescingKey,
        count: coalesced.count,
      });

      // Update the queued notification if it exists
      const queueIndex = this.queue.findIndex(
        (q) => getCoalescingKey(q.notification) === coalescingKey
      );
      if (queueIndex >= 0) {
        this.queue[queueIndex].notification = coalesced.notification;
      }

      return;
    }

    // Create new coalescing entry
    this.coalescingMap.set(coalescingKey, {
      notification,
      count: 1,
      firstOccurrence: now,
      lastUpdate: now,
    });

    // High priority notifications try to show immediately
    if (priority === "high" && !this.isRateLimited()) {
      this.showNotification(notification);
      return;
    }

    // Add to queue
    const queued: QueuedNotification = {
      notification,
      enqueuedAt: now,
      priority,
    };

    this.queue.push(queued);

    // Sort by priority (high > medium > low)
    this.queue.sort((a, b) => getPriorityValue(b.priority) - getPriorityValue(a.priority));

    // Enforce queue depth limit
    this.enforceQueueDepth();

    // Schedule processing if not already scheduled
    this.scheduleProcessing();
  }

  /**
   * Clear all pending notifications from the queue.
   */
  clear(): void {
    this.queue = [];
    this.coalescingMap.clear();
    this.cancelProcessing();

    this.logger.debug("Notification queue cleared");
  }

  /**
   * Get the current number of notifications in the queue.
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Destroy the queue and clean up resources.
   */
  destroy(): void {
    this.clear();
    this.recentNotifications = [];
    this.lastShown = 0;

    if (this.coalescingCleanupTimer) {
      clearInterval(this.coalescingCleanupTimer);
      this.coalescingCleanupTimer = null;
    }

    this.logger.debug("Notification queue destroyed");
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Check if we're currently rate limited.
   */
  private isRateLimited(): boolean {
    const now = Date.now();

    // Clean up old timestamps (older than 1 minute)
    this.recentNotifications = this.recentNotifications.filter(
      (timestamp) => now - timestamp < 60000
    );

    // Check max per minute
    if (this.recentNotifications.length >= this.config.maxPerMinute) {
      return true;
    }

    // Check minimum interval
    if (now - this.lastShown < this.config.minInterval) {
      return true;
    }

    return false;
  }

  /**
   * Show a notification and update rate limiting counters.
   */
  private showNotification(notification: NotificationOptions): void {
    const now = Date.now();

    this.service.show(notification);

    this.recentNotifications.push(now);
    this.lastShown = now;

    this.logger.debug("Notification shown", {
      title: notification.title,
      priority: notification.priority,
      queueRemaining: this.queue.length,
    });
  }

  /**
   * Process the queue and show the next notification if possible.
   */
  private processQueue(): void {
    this.processTimer = null;

    if (this.queue.length === 0) {
      return;
    }

    if (this.isRateLimited()) {
      // Schedule retry after minimum interval
      this.scheduleProcessing();
      return;
    }

    // Get the highest priority notification (already sorted)
    const queued = this.queue.shift();
    if (queued) {
      this.showNotification(queued.notification);
    }

    // Continue processing if there are more notifications
    if (this.queue.length > 0) {
      this.scheduleProcessing();
    }
  }

  /**
   * Schedule queue processing after the minimum interval.
   */
  private scheduleProcessing(): void {
    if (this.processTimer) {
      return; // Already scheduled
    }

    const now = Date.now();
    const timeSinceLastShown = now - this.lastShown;
    const delay = Math.max(0, this.config.minInterval - timeSinceLastShown);

    this.processTimer = setTimeout(() => this.processQueue(), delay);
  }

  /**
   * Cancel any scheduled queue processing.
   */
  private cancelProcessing(): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
  }

  /**
   * Enforce the maximum queue depth by dropping low priority notifications.
   */
  private enforceQueueDepth(): void {
    while (this.queue.length > this.config.maxQueueDepth) {
      // Find the last low priority notification
      const lowPriorityIndex = this.findLastIndexByPriority("low");

      if (lowPriorityIndex >= 0) {
        const dropped = this.queue.splice(lowPriorityIndex, 1)[0];
        this.logger.debug("Dropped low priority notification due to queue overflow", {
          title: dropped.notification.title,
        });
        continue;
      }

      // No low priority to drop, try medium
      const mediumPriorityIndex = this.findLastIndexByPriority("medium");

      if (mediumPriorityIndex >= 0) {
        const dropped = this.queue.splice(mediumPriorityIndex, 1)[0];
        this.logger.warn("Dropped medium priority notification due to queue overflow", {
          title: dropped.notification.title,
        });
        continue;
      }

      // Only high priority left - don't drop
      this.logger.warn("Queue overflow but only high priority notifications remain", {
        queueLength: this.queue.length,
      });
      break;
    }
  }

  /**
   * Find the last index of a notification with the given priority.
   */
  private findLastIndexByPriority(priority: NotificationPriority): number {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].priority === priority) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Start the timer for cleaning up expired coalescing entries.
   */
  private startCoalescingCleanup(): void {
    // Clean up every second
    this.coalescingCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, coalesced] of this.coalescingMap.entries()) {
        if (now - coalesced.lastUpdate > this.config.coalescingWindow) {
          this.coalescingMap.delete(key);
        }
      }
    }, 1000);
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

/**
 * Singleton instance of the notification queue.
 */
let notificationQueueInstance: NotificationQueue | null = null;

/**
 * Initializes the global notification queue instance.
 * This should be called after the NotificationService has been initialized.
 *
 * @param service - The NotificationService to use for displaying notifications
 * @param config - Optional configuration overrides
 * @returns The initialized NotificationQueue instance
 *
 * @example
 * ```typescript
 * import { initializeNotificationQueue } from './services/notification-queue';
 * import { getNotificationService } from './services/notifications';
 *
 * const queue = initializeNotificationQueue(getNotificationService());
 * queue.enqueue({
 *   title: 'Hello',
 *   body: 'World',
 *   type: 'info',
 *   priority: 'medium',
 * });
 * ```
 */
export function initializeNotificationQueue(
  service: NotificationService,
  config?: Partial<NotificationQueueConfig>
): NotificationQueue {
  if (notificationQueueInstance) {
    // Already initialized, return existing instance
    return notificationQueueInstance;
  }

  notificationQueueInstance = new NotificationQueueImpl(service, config);
  return notificationQueueInstance;
}

/**
 * Gets the current notification queue instance.
 * Throws if initializeNotificationQueue() has not been called.
 *
 * @returns The NotificationQueue instance
 * @throws Error if notification queue has not been initialized
 */
export function getNotificationQueue(): NotificationQueue {
  if (!notificationQueueInstance) {
    throw new Error(
      "NotificationQueue not initialized. Call initializeNotificationQueue() before using getNotificationQueue()."
    );
  }
  return notificationQueueInstance;
}

/**
 * Resets the notification queue instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetNotificationQueue(): void {
  if (notificationQueueInstance) {
    notificationQueueInstance.destroy();
  }
  notificationQueueInstance = null;
}
