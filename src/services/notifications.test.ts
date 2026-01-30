/**
 * Unit tests for the notification service.
 * Tests singleton pattern, notification display, and content sanitization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initializeLogger, resetLogger } from "./logger";
import { LogLevel } from "../types";

const { mockNotificationShow, mockNotificationOn, mockNotificationConstructor, mockIsSupported } =
  vi.hoisted(() => ({
    mockNotificationShow: vi.fn(),
    mockNotificationOn: vi.fn(),
    mockNotificationConstructor: vi.fn(),
    mockIsSupported: vi.fn(() => true),
  }));

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
  return { Notification: MockNotification };
});

import {
  initializeNotificationService,
  getNotificationService,
  resetNotificationService,
  stripHtmlTags,
  NotificationOptions,
} from "./notifications";

describe("Notification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupported.mockReturnValue(true);
    resetNotificationService();
    resetLogger();
    initializeLogger({ level: LogLevel.DEBUG, logMessageContent: true, prettyPrint: true });
  });

  afterEach(() => {
    resetNotificationService();
    resetLogger();
  });

  it("should throw if getNotificationService called before initialization", () => {
    resetNotificationService();
    expect(() => getNotificationService()).toThrow(
      "NotificationService not initialized. Call initializeNotificationService() before using getNotificationService()."
    );
  });

  it("should return the same singleton instance on subsequent calls", () => {
    const service1 = initializeNotificationService();
    const service2 = initializeNotificationService();
    expect(service1).toBe(service2);
  });

  it("should create and display a notification with sanitized HTML", () => {
    const service = initializeNotificationService();
    const options: NotificationOptions = {
      title: "<b>Important</b> Alert",
      body: "<b>Bold</b> text",
      type: "info",
      priority: "medium",
    };

    service.show(options);

    expect(mockNotificationConstructor).toHaveBeenCalledWith({
      title: "Important Alert",
      body: "Bold text",
    });
    expect(mockNotificationShow).toHaveBeenCalled();
  });

  it("should not display notification when not supported", () => {
    mockIsSupported.mockReturnValue(false);
    const service = initializeNotificationService();

    service.show({ title: "Test", body: "Body", type: "info", priority: "medium" });

    expect(mockNotificationConstructor).not.toHaveBeenCalled();
  });

  it("should handle errors gracefully without throwing", () => {
    mockNotificationConstructor.mockImplementationOnce(() => {
      throw new Error("Notification failed");
    });
    const service = initializeNotificationService();

    expect(() =>
      service.show({ title: "Test", body: "Body", type: "info", priority: "medium" })
    ).not.toThrow();
  });
});

describe("stripHtmlTags", () => {
  it("should remove HTML tags while preserving text content", () => {
    expect(stripHtmlTags("<b>Bold</b> and <i>italic</i> text")).toBe("Bold and italic text");
    expect(stripHtmlTags("Plain text")).toBe("Plain text");
    expect(stripHtmlTags("5 > 3")).toBe("5 > 3");
  });
});
