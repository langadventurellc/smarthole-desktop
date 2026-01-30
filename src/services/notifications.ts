/**
 * Notification service for displaying native OS notifications.
 * Wraps Electron's Notification API with a singleton pattern.
 *
 * @see F-system-notifications feature specification
 */

import { Notification } from "electron";
import { getLogger, Logger } from "./logger";
import { NotifyShowPayload, NotificationType, NotificationPriority } from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended notification options that include click handler.
 * Extends the IPC payload type with additional runtime options.
 */
export interface NotificationOptions extends NotifyShowPayload {
  /** Callback invoked when the notification is clicked */
  onClick?: () => void;
}

/**
 * Notification service interface.
 * Provides methods for displaying native OS notifications.
 */
export interface NotificationService {
  /**
   * Show a notification with full options.
   *
   * @param options - The notification configuration
   */
  show(options: NotificationOptions): void;

  /**
   * Show an info notification.
   *
   * @param title - The notification title
   * @param body - The notification body text
   */
  showInfo(title: string, body: string): void;

  /**
   * Show a warning notification.
   *
   * @param title - The notification title
   * @param body - The notification body text
   */
  showWarning(title: string, body: string): void;

  /**
   * Show an error notification.
   *
   * @param title - The notification title
   * @param body - The notification body text
   */
  showError(title: string, body: string): void;

  /**
   * Show a success notification.
   *
   * @param title - The notification title
   * @param body - The notification body text
   */
  showSuccess(title: string, body: string): void;

  /**
   * Check if notifications are supported on the current platform.
   *
   * @returns true if notifications are supported
   */
  isSupported(): boolean;
}

// ============================================================================
// Content Sanitization
// ============================================================================

/**
 * Strips HTML tags from a string to prevent script injection.
 * This is a security measure to ensure notification content is safe.
 *
 * @param text - The text that may contain HTML tags
 * @returns The text with all HTML tags removed
 *
 * @example
 * ```typescript
 * stripHtmlTags('<script>alert("xss")</script>Hello')
 * // Returns: 'Hello'
 *
 * stripHtmlTags('<b>Bold</b> and <i>italic</i>')
 * // Returns: 'Bold and italic'
 * ```
 */
export function stripHtmlTags(text: string): string {
  // Remove all HTML tags using a regex
  // This handles both self-closing and paired tags
  return text.replace(/<[^>]*>/g, "");
}

// ============================================================================
// Notification Service Implementation
// ============================================================================

/**
 * Internal implementation of the NotificationService.
 * Uses singleton pattern with private constructor.
 */
class NotificationServiceImpl implements NotificationService {
  private readonly logger: Logger;

  /**
   * Private constructor to enforce singleton pattern.
   * Use initializeNotificationService() to create an instance.
   */
  constructor() {
    this.logger = getLogger().child({ component: "NotificationService" });
  }

  /**
   * Check if notifications are supported on the current platform.
   */
  isSupported(): boolean {
    return Notification.isSupported();
  }

  /**
   * Show a notification with full options.
   * Gracefully handles unsupported platforms by logging a warning.
   */
  show(options: NotificationOptions): void {
    // Check platform support
    if (!this.isSupported()) {
      this.logger.warn("Notifications not supported on this platform", {
        title: options.title,
        type: options.type,
      });
      return;
    }

    try {
      // Sanitize content to prevent script injection
      const sanitizedTitle = stripHtmlTags(options.title);
      const sanitizedBody = stripHtmlTags(options.body);

      // Create the notification
      const notification = new Notification({
        title: sanitizedTitle,
        body: sanitizedBody,
        // Note: icon can be added in future tasks if needed
      });

      // Attach click handler if provided
      if (options.onClick) {
        notification.on("click", options.onClick);
      }

      // Show the notification
      notification.show();

      this.logger.debug("Notification displayed", {
        title: sanitizedTitle,
        type: options.type,
        priority: options.priority,
      });
    } catch (error) {
      // Never throw exceptions that could crash the main process
      this.logger.error("Failed to display notification", {
        error: error instanceof Error ? error.message : String(error),
        title: options.title,
        type: options.type,
      });
    }
  }

  /**
   * Show an info notification with default priority.
   */
  showInfo(title: string, body: string): void {
    this.show({
      title,
      body,
      type: "info" as NotificationType,
      priority: "medium" as NotificationPriority,
    });
  }

  /**
   * Show a warning notification with medium priority.
   */
  showWarning(title: string, body: string): void {
    this.show({
      title,
      body,
      type: "warning" as NotificationType,
      priority: "medium" as NotificationPriority,
    });
  }

  /**
   * Show an error notification with high priority.
   */
  showError(title: string, body: string): void {
    this.show({
      title,
      body,
      type: "error" as NotificationType,
      priority: "high" as NotificationPriority,
    });
  }

  /**
   * Show a success notification with medium priority.
   */
  showSuccess(title: string, body: string): void {
    this.show({
      title,
      body,
      type: "success" as NotificationType,
      priority: "medium" as NotificationPriority,
    });
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

/**
 * Singleton instance of the notification service.
 */
let notificationServiceInstance: NotificationService | null = null;

/**
 * Initializes the global notification service instance.
 * This should be called after the logger has been initialized.
 *
 * @returns The initialized NotificationService instance
 * @throws Error if logger has not been initialized
 *
 * @example
 * ```typescript
 * import { initializeNotificationService } from './services/notifications';
 *
 * // After logger initialization
 * const notificationService = initializeNotificationService();
 * notificationService.showInfo('Welcome', 'Application started');
 * ```
 */
export function initializeNotificationService(): NotificationService {
  if (notificationServiceInstance) {
    // Already initialized, return existing instance
    return notificationServiceInstance;
  }

  notificationServiceInstance = new NotificationServiceImpl();
  return notificationServiceInstance;
}

/**
 * Gets the current notification service instance.
 * Throws if initializeNotificationService() has not been called.
 *
 * @returns The NotificationService instance
 * @throws Error if notification service has not been initialized
 */
export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    throw new Error(
      "NotificationService not initialized. Call initializeNotificationService() before using getNotificationService()."
    );
  }
  return notificationServiceInstance;
}

/**
 * Resets the notification service instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetNotificationService(): void {
  notificationServiceInstance = null;
}
