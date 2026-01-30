/**
 * Unit tests for the notification service.
 * Tests singleton pattern, notification display, and content sanitization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initializeLogger, resetLogger } from "./logger";
import { LogLevel } from "../types";

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
  // Create the mock class inside the factory
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
  getNotificationService,
  resetNotificationService,
  stripHtmlTags,
  NotificationOptions,
} from "./notifications";

// ============================================================================
// Test Setup
// ============================================================================

describe("Notification Service", () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockIsSupported.mockReturnValue(true);

    // Reset services
    resetNotificationService();
    resetLogger();

    // Initialize logger (required for notification service)
    initializeLogger({
      level: LogLevel.DEBUG,
      logMessageContent: true,
      prettyPrint: true,
    });
  });

  afterEach(() => {
    resetNotificationService();
    resetLogger();
  });

  // ==========================================================================
  // Singleton Pattern Tests
  // ==========================================================================

  describe("Singleton Pattern", () => {
    describe("initializeNotificationService", () => {
      it("should create a notification service instance", () => {
        const service = initializeNotificationService();

        expect(service).toBeDefined();
        expect(typeof service.show).toBe("function");
        expect(typeof service.showInfo).toBe("function");
        expect(typeof service.showWarning).toBe("function");
        expect(typeof service.showError).toBe("function");
        expect(typeof service.showSuccess).toBe("function");
        expect(typeof service.isSupported).toBe("function");
      });

      it("should return the same instance on subsequent calls", () => {
        const service1 = initializeNotificationService();
        const service2 = initializeNotificationService();

        expect(service1).toBe(service2);
      });
    });

    describe("getNotificationService", () => {
      it("should throw if service is not initialized", () => {
        expect(() => getNotificationService()).toThrow(
          "NotificationService not initialized. Call initializeNotificationService() before using getNotificationService()."
        );
      });

      it("should return the service after initialization", () => {
        initializeNotificationService();
        const service = getNotificationService();

        expect(service).toBeDefined();
      });

      it("should return the same instance as initializeNotificationService", () => {
        const initialized = initializeNotificationService();
        const retrieved = getNotificationService();

        expect(initialized).toBe(retrieved);
      });
    });

    describe("resetNotificationService", () => {
      it("should reset the service instance", () => {
        initializeNotificationService();
        expect(() => getNotificationService()).not.toThrow();

        resetNotificationService();

        expect(() => getNotificationService()).toThrow();
      });

      it("should allow re-initialization after reset", () => {
        const service1 = initializeNotificationService();
        resetNotificationService();
        const service2 = initializeNotificationService();

        // New instance should be created
        expect(service2).toBeDefined();
        expect(service1).not.toBe(service2);
      });
    });
  });

  // ==========================================================================
  // isSupported Tests
  // ==========================================================================

  describe("isSupported", () => {
    it("should return true when notifications are supported", () => {
      mockIsSupported.mockReturnValue(true);
      const service = initializeNotificationService();

      expect(service.isSupported()).toBe(true);
    });

    it("should return false when notifications are not supported", () => {
      mockIsSupported.mockReturnValue(false);
      const service = initializeNotificationService();

      expect(service.isSupported()).toBe(false);
    });
  });

  // ==========================================================================
  // show() Method Tests
  // ==========================================================================

  describe("show", () => {
    it("should create and display a notification", () => {
      const service = initializeNotificationService();
      const options: NotificationOptions = {
        title: "Test Title",
        body: "Test Body",
        type: "info",
        priority: "medium",
      };

      service.show(options);

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Test Title",
        body: "Test Body",
      });
      expect(mockNotificationShow).toHaveBeenCalled();
    });

    it("should attach click handler when provided", () => {
      const service = initializeNotificationService();
      const onClick = vi.fn();
      const options: NotificationOptions = {
        title: "Test",
        body: "Body",
        type: "info",
        priority: "medium",
        onClick,
      };

      service.show(options);

      expect(mockNotificationOn).toHaveBeenCalledWith("click", onClick);
    });

    it("should not attach click handler when not provided", () => {
      const service = initializeNotificationService();
      const options: NotificationOptions = {
        title: "Test",
        body: "Body",
        type: "info",
        priority: "medium",
      };

      service.show(options);

      expect(mockNotificationOn).not.toHaveBeenCalled();
    });

    it("should sanitize HTML from title and body", () => {
      const service = initializeNotificationService();
      const options: NotificationOptions = {
        title: "<b>Important</b> Alert",
        body: "<b>Bold</b> and <i>italic</i> text",
        type: "info",
        priority: "medium",
      };

      service.show(options);

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Important Alert",
        body: "Bold and italic text",
      });
    });

    it("should not display notification when not supported", () => {
      mockIsSupported.mockReturnValue(false);
      const service = initializeNotificationService();
      const options: NotificationOptions = {
        title: "Test",
        body: "Body",
        type: "info",
        priority: "medium",
      };

      service.show(options);

      expect(mockNotificationConstructor).not.toHaveBeenCalled();
      expect(mockNotificationShow).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully without throwing", () => {
      mockNotificationConstructor.mockImplementationOnce(() => {
        throw new Error("Notification failed");
      });

      const service = initializeNotificationService();
      const options: NotificationOptions = {
        title: "Test",
        body: "Body",
        type: "info",
        priority: "medium",
      };

      // Should not throw
      expect(() => service.show(options)).not.toThrow();
    });
  });

  // ==========================================================================
  // Convenience Method Tests
  // ==========================================================================

  describe("showInfo", () => {
    it("should show notification with info type and medium priority", () => {
      const service = initializeNotificationService();

      service.showInfo("Info Title", "Info body text");

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Info Title",
        body: "Info body text",
      });
      expect(mockNotificationShow).toHaveBeenCalled();
    });

    it("should sanitize HTML content", () => {
      const service = initializeNotificationService();

      service.showInfo("<b>Bold</b> Title", "Body with <span>content</span>");

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Bold Title",
        body: "Body with content",
      });
    });
  });

  describe("showWarning", () => {
    it("should show notification with warning type and medium priority", () => {
      const service = initializeNotificationService();

      service.showWarning("Warning Title", "Warning body text");

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Warning Title",
        body: "Warning body text",
      });
      expect(mockNotificationShow).toHaveBeenCalled();
    });
  });

  describe("showError", () => {
    it("should show notification with error type and high priority", () => {
      const service = initializeNotificationService();

      service.showError("Error Title", "Error body text");

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Error Title",
        body: "Error body text",
      });
      expect(mockNotificationShow).toHaveBeenCalled();
    });
  });

  describe("showSuccess", () => {
    it("should show notification with success type and medium priority", () => {
      const service = initializeNotificationService();

      service.showSuccess("Success Title", "Success body text");

      expect(mockNotificationConstructor).toHaveBeenCalledWith({
        title: "Success Title",
        body: "Success body text",
      });
      expect(mockNotificationShow).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Graceful Degradation Tests
  // ==========================================================================

  describe("Graceful Degradation", () => {
    it("should log warning when notifications not supported", () => {
      mockIsSupported.mockReturnValue(false);
      const service = initializeNotificationService();

      // Should not throw, just log a warning
      expect(() => {
        service.showInfo("Test", "Body");
      }).not.toThrow();

      // Notification should not be created
      expect(mockNotificationConstructor).not.toHaveBeenCalled();
    });

    it("should handle all convenience methods when not supported", () => {
      mockIsSupported.mockReturnValue(false);
      const service = initializeNotificationService();

      // None of these should throw
      expect(() => service.showInfo("Test", "Body")).not.toThrow();
      expect(() => service.showWarning("Test", "Body")).not.toThrow();
      expect(() => service.showError("Test", "Body")).not.toThrow();
      expect(() => service.showSuccess("Test", "Body")).not.toThrow();

      // No notifications should be created
      expect(mockNotificationConstructor).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Content Sanitization Tests
// ============================================================================

describe("stripHtmlTags", () => {
  it("should remove simple HTML tags", () => {
    expect(stripHtmlTags("<b>Bold</b>")).toBe("Bold");
    expect(stripHtmlTags("<i>Italic</i>")).toBe("Italic");
    expect(stripHtmlTags("<u>Underline</u>")).toBe("Underline");
  });

  it("should remove script tags but preserve text content", () => {
    // Note: stripHtmlTags removes the tags themselves, not the content between them.
    // This is fine for notifications since they don't execute JavaScript.
    // The goal is to prevent HTML rendering, not script execution.
    expect(stripHtmlTags('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(stripHtmlTags("Hello<script>evil()</script>World")).toBe("Helloevil()World");
  });

  it("should remove self-closing tags", () => {
    expect(stripHtmlTags("Line1<br/>Line2")).toBe("Line1Line2");
    expect(stripHtmlTags("Image:<img src='x'/>")).toBe("Image:");
  });

  it("should handle nested tags", () => {
    expect(stripHtmlTags("<div><span>Nested</span></div>")).toBe("Nested");
    expect(stripHtmlTags("<p><b><i>Deep</i></b></p>")).toBe("Deep");
  });

  it("should handle tags with attributes", () => {
    expect(stripHtmlTags('<a href="http://example.com">Link</a>')).toBe("Link");
    expect(stripHtmlTags('<div class="container" id="main">Content</div>')).toBe("Content");
  });

  it("should preserve text without tags", () => {
    expect(stripHtmlTags("Plain text")).toBe("Plain text");
    expect(stripHtmlTags("No HTML here")).toBe("No HTML here");
  });

  it("should handle empty strings", () => {
    expect(stripHtmlTags("")).toBe("");
  });

  it("should handle strings with only tags", () => {
    expect(stripHtmlTags("<br/>")).toBe("");
    expect(stripHtmlTags("<div></div>")).toBe("");
  });

  it("should handle multiple tags", () => {
    expect(stripHtmlTags("<b>Bold</b> and <i>italic</i> text")).toBe("Bold and italic text");
  });

  it("should handle malformed tags gracefully", () => {
    // Malformed tags without closing > are preserved since they don't match the pattern
    expect(stripHtmlTags("<unclosed")).toBe("<unclosed");
    expect(stripHtmlTags("text<unclosed")).toBe("text<unclosed");
    // But properly formed tags are still removed
    expect(stripHtmlTags("<unclosed>text")).toBe("text");
  });

  it("should preserve angle brackets that are not tags", () => {
    // Mathematical expressions with spaces
    expect(stripHtmlTags("5 > 3")).toBe("5 > 3");
    expect(stripHtmlTags("3 < 5")).toBe("3 < 5");
  });
});
