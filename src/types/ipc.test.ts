import { describe, it, expect } from "vitest";
import {
  // Channel constants and types
  IPC_CHANNELS,
  type IpcChannel,
  // Type guards
  isIpcChannel,
  isNotificationType,
  isNotificationPriority,
  isLogMessagePayload,
  isNotificationAction,
  isNotifyShowPayload,
  isConfigSetPayload,
  isConfigChangedPayload,
  isAppVersionResponse,
  isTextInputSubmitPayload,
  // Payload types
  type LogMessagePayload,
  type NotificationType,
  type NotificationPriority,
  type NotificationAction,
  type NotifyShowPayload,
  type NotificationClickedPayload,
  type ConfigGetResponse,
  type ConfigSetPayload,
  type ConfigChangedPayload,
  type AppVersionResponse,
  type TextInputSubmitPayload,
  type TextInputOpenPayload,
  // Type maps
  type IpcPayloadMap,
  type IpcResponseMap,
} from "./ipc";
import { LogLevel, DEFAULT_CONFIG } from "./config";

describe("IPC_CHANNELS", () => {
  describe("channel values", () => {
    it("should have all expected logging channels", () => {
      expect(IPC_CHANNELS.LOG_MESSAGE).toBe("log:message");
    });

    it("should have all expected notification channels", () => {
      expect(IPC_CHANNELS.NOTIFY_SHOW).toBe("notify:show");
    });

    it("should have all expected configuration channels", () => {
      expect(IPC_CHANNELS.CONFIG_GET).toBe("config:get");
      expect(IPC_CHANNELS.CONFIG_SET).toBe("config:set");
      expect(IPC_CHANNELS.CONFIG_CHANGED).toBe("config:changed");
    });

    it("should have all expected app lifecycle channels", () => {
      expect(IPC_CHANNELS.APP_QUIT).toBe("app:quit");
      expect(IPC_CHANNELS.APP_VERSION).toBe("app:version");
    });

    it("should have all expected websocket channels", () => {
      expect(IPC_CHANNELS.WEBSOCKET_STATUS_GET).toBe("websocket:status:get");
      expect(IPC_CHANNELS.WEBSOCKET_STATUS_CHANGED).toBe("websocket:status:changed");
    });

    it("should have all expected message delivery channels", () => {
      expect(IPC_CHANNELS.MESSAGE_SEND).toBe("message:send");
      expect(IPC_CHANNELS.MESSAGE_SEND_MULTIPLE).toBe("message:sendMultiple");
      expect(IPC_CHANNELS.MESSAGE_GET_STATUS).toBe("message:getStatus");
      expect(IPC_CHANNELS.MESSAGE_GET_RECENT).toBe("message:getRecent");
    });

    it("should have all expected client status channels", () => {
      expect(IPC_CHANNELS.CLIENTS_GET_COUNT).toBe("clients:getCount");
      expect(IPC_CHANNELS.CLIENTS_GET_LIST).toBe("clients:getList");
      expect(IPC_CHANNELS.CLIENTS_GET_DETAILS).toBe("clients:getDetails");
      expect(IPC_CHANNELS.CLIENTS_STATUS_CHANGED).toBe("clients:statusChanged");
    });

    it("should have all expected hotkey channels", () => {
      expect(IPC_CHANNELS.HOTKEY_ACTIVATED).toBe("hotkey:activated");
      expect(IPC_CHANNELS.HOTKEY_RELEASED).toBe("hotkey:released");
    });

    it("should have all expected input state channels", () => {
      expect(IPC_CHANNELS.INPUT_STATE_CHANGED).toBe("input:stateChanged");
      expect(IPC_CHANNELS.INPUT_GET_STATE).toBe("input:getState");
    });

    it("should have all expected text input popup channels", () => {
      expect(IPC_CHANNELS.TEXT_INPUT_OPEN).toBe("textInput:open");
      expect(IPC_CHANNELS.TEXT_INPUT_CLOSE).toBe("textInput:close");
      expect(IPC_CHANNELS.TEXT_INPUT_SUBMIT).toBe("textInput:submit");
      expect(IPC_CHANNELS.TEXT_INPUT_FOCUSED).toBe("textInput:focused");
      expect(IPC_CHANNELS.TEXT_INPUT_DISMISSED).toBe("textInput:dismissed");
    });

    it("should have all expected audio capture channels", () => {
      expect(IPC_CHANNELS.AUDIO_START).toBe("audio:start");
      expect(IPC_CHANNELS.AUDIO_STOP).toBe("audio:stop");
      expect(IPC_CHANNELS.AUDIO_DATA).toBe("audio:data");
      expect(IPC_CHANNELS.AUDIO_PERMISSION_GET).toBe("audio:permission:get");
      expect(IPC_CHANNELS.AUDIO_PERMISSION_CHANGED).toBe("audio:permission:changed");
      expect(IPC_CHANNELS.AUDIO_STATE_CHANGED).toBe("audio:stateChanged");
    });

    it("should have all expected credential channels", () => {
      expect(IPC_CHANNELS.CREDENTIAL_STORE).toBe("credential:store");
      expect(IPC_CHANNELS.CREDENTIAL_DELETE).toBe("credential:delete");
      expect(IPC_CHANNELS.CREDENTIAL_HAS).toBe("credential:has");
      expect(IPC_CHANNELS.DIALOG_OPEN).toBe("dialog:open");
    });

    it("should have all expected STT channels", () => {
      expect(IPC_CHANNELS.STT_TRANSCRIBING).toBe("stt:transcribing");
      expect(IPC_CHANNELS.STT_RESULT).toBe("stt:result");
      expect(IPC_CHANNELS.STT_ERROR).toBe("stt:error");
    });

    it("should have all expected routing channels", () => {
      expect(IPC_CHANNELS.ROUTING_SUBMIT_MESSAGE).toBe("routing:submitMessage");
      expect(IPC_CHANNELS.ROUTING_GET_STATUS).toBe("routing:getStatus");
    });

    it("should have exactly 46 channels", () => {
      expect(Object.keys(IPC_CHANNELS)).toHaveLength(46);
    });

    it("should follow the domain:action naming convention", () => {
      for (const channel of Object.values(IPC_CHANNELS)) {
        // Allows domain:action or domain:action:sub patterns (domain and action can be camelCase)
        expect(channel).toMatch(/^[a-zA-Z]+:[a-zA-Z]+(:[a-zA-Z]+)?$/);
      }
    });
  });
});

describe("isIpcChannel type guard", () => {
  it("should return true for all valid IPC channels", () => {
    expect(isIpcChannel("log:message")).toBe(true);
    expect(isIpcChannel("notify:show")).toBe(true);
    expect(isIpcChannel("config:get")).toBe(true);
    expect(isIpcChannel("config:set")).toBe(true);
    expect(isIpcChannel("config:changed")).toBe(true);
    expect(isIpcChannel("app:quit")).toBe(true);
    expect(isIpcChannel("app:version")).toBe(true);
    expect(isIpcChannel("websocket:status:get")).toBe(true);
    expect(isIpcChannel("websocket:status:changed")).toBe(true);
  });

  it("should return false for invalid channels", () => {
    expect(isIpcChannel("invalid:channel")).toBe(false);
    expect(isIpcChannel("log:invalid")).toBe(false);
    expect(isIpcChannel("LOG:MESSAGE")).toBe(false); // Case sensitive
    expect(isIpcChannel("")).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(isIpcChannel(123)).toBe(false);
    expect(isIpcChannel(null)).toBe(false);
    expect(isIpcChannel(undefined)).toBe(false);
    expect(isIpcChannel({})).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = "log:message";
    if (isIpcChannel(value)) {
      const _channel: IpcChannel = value;
      expect(_channel).toBe("log:message");
    }
  });
});

describe("NotificationType", () => {
  describe("isNotificationType type guard", () => {
    it("should return true for valid notification types", () => {
      expect(isNotificationType("info")).toBe(true);
      expect(isNotificationType("warning")).toBe(true);
      expect(isNotificationType("error")).toBe(true);
      expect(isNotificationType("success")).toBe(true);
    });

    it("should return false for invalid types", () => {
      expect(isNotificationType("alert")).toBe(false);
      expect(isNotificationType("notice")).toBe(false);
      expect(isNotificationType("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isNotificationType(123)).toBe(false);
      expect(isNotificationType(null)).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "warning";
      if (isNotificationType(value)) {
        const _type: NotificationType = value;
        expect(_type).toBe("warning");
      }
    });
  });
});

describe("NotificationPriority", () => {
  describe("isNotificationPriority type guard", () => {
    it("should return true for valid priorities", () => {
      expect(isNotificationPriority("low")).toBe(true);
      expect(isNotificationPriority("medium")).toBe(true);
      expect(isNotificationPriority("high")).toBe(true);
    });

    it("should return false for invalid priorities", () => {
      expect(isNotificationPriority("critical")).toBe(false);
      expect(isNotificationPriority("urgent")).toBe(false);
      expect(isNotificationPriority("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isNotificationPriority(123)).toBe(false);
      expect(isNotificationPriority(null)).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "high";
      if (isNotificationPriority(value)) {
        const _priority: NotificationPriority = value;
        expect(_priority).toBe("high");
      }
    });
  });
});

describe("LogMessagePayload", () => {
  describe("isLogMessagePayload type guard", () => {
    it("should return true for valid minimal payloads", () => {
      const payload = {
        level: "info",
        message: "Test message",
      };
      expect(isLogMessagePayload(payload)).toBe(true);
    });

    it("should return true for valid payloads with optional fields", () => {
      const payload = {
        level: "debug",
        message: "Debug message",
        context: { userId: 123, action: "test" },
        timestamp: "2024-01-15T10:30:00.000Z",
      };
      expect(isLogMessagePayload(payload)).toBe(true);
    });

    it("should return true for all valid log levels", () => {
      const levels = ["error", "warn", "info", "debug", "trace"];
      for (const level of levels) {
        expect(isLogMessagePayload({ level, message: "test" })).toBe(true);
      }
    });

    it("should return false for invalid log levels", () => {
      expect(isLogMessagePayload({ level: "fatal", message: "test" })).toBe(false);
      expect(isLogMessagePayload({ level: "INFO", message: "test" })).toBe(false);
    });

    it("should return false when required fields are missing", () => {
      expect(isLogMessagePayload({ level: "info" })).toBe(false);
      expect(isLogMessagePayload({ message: "test" })).toBe(false);
      expect(isLogMessagePayload({})).toBe(false);
    });

    it("should return false for invalid context type", () => {
      expect(isLogMessagePayload({ level: "info", message: "test", context: "invalid" })).toBe(
        false
      );
      expect(isLogMessagePayload({ level: "info", message: "test", context: null })).toBe(false);
    });

    it("should return false for invalid timestamp type", () => {
      expect(isLogMessagePayload({ level: "info", message: "test", timestamp: 123 })).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isLogMessagePayload(null)).toBe(false);
      expect(isLogMessagePayload("string")).toBe(false);
      expect(isLogMessagePayload(123)).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = { level: "info", message: "test" };
      if (isLogMessagePayload(value)) {
        const _payload: LogMessagePayload = value;
        expect(_payload.level).toBe("info");
      }
    });
  });

  describe("interface structure", () => {
    it("should allow valid payload structures", () => {
      const payload: LogMessagePayload = {
        level: LogLevel.INFO,
        message: "Test message",
        context: { key: "value" },
        timestamp: "2024-01-15T10:30:00.000Z",
      };
      expect(payload.level).toBe("info");
    });

    it("should allow minimal payload", () => {
      const payload: LogMessagePayload = {
        level: LogLevel.ERROR,
        message: "Error occurred",
      };
      expect(payload.context).toBeUndefined();
    });
  });
});

describe("NotificationAction", () => {
  describe("isNotificationAction type guard", () => {
    it("should return true for valid actions", () => {
      expect(isNotificationAction({ label: "OK", actionId: "ok" })).toBe(true);
      expect(isNotificationAction({ label: "Cancel", actionId: "cancel" })).toBe(true);
    });

    it("should return false when fields are missing", () => {
      expect(isNotificationAction({ label: "OK" })).toBe(false);
      expect(isNotificationAction({ actionId: "ok" })).toBe(false);
      expect(isNotificationAction({})).toBe(false);
    });

    it("should return false for wrong field types", () => {
      expect(isNotificationAction({ label: 123, actionId: "ok" })).toBe(false);
      expect(isNotificationAction({ label: "OK", actionId: 456 })).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isNotificationAction(null)).toBe(false);
      expect(isNotificationAction("string")).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = { label: "Test", actionId: "test" };
      if (isNotificationAction(value)) {
        const _action: NotificationAction = value;
        expect(_action.label).toBe("Test");
      }
    });
  });
});

describe("NotifyShowPayload", () => {
  describe("isNotifyShowPayload type guard", () => {
    it("should return true for valid minimal payloads", () => {
      const payload = {
        title: "Test",
        body: "Test body",
        type: "info",
        priority: "medium",
      };
      expect(isNotifyShowPayload(payload)).toBe(true);
    });

    it("should return true for valid payloads with optional fields", () => {
      const payload = {
        title: "Test",
        body: "Test body",
        type: "warning",
        priority: "high",
        actions: [{ label: "OK", actionId: "ok" }],
        timeout: 5000,
      };
      expect(isNotifyShowPayload(payload)).toBe(true);
    });

    it("should return true for payloads with multiple actions", () => {
      const payload = {
        title: "Confirm",
        body: "Are you sure?",
        type: "warning",
        priority: "high",
        actions: [
          { label: "Yes", actionId: "yes" },
          { label: "No", actionId: "no" },
        ],
      };
      expect(isNotifyShowPayload(payload)).toBe(true);
    });

    it("should return false when required fields are missing", () => {
      expect(isNotifyShowPayload({ body: "test", type: "info", priority: "low" })).toBe(false);
      expect(isNotifyShowPayload({ title: "test", type: "info", priority: "low" })).toBe(false);
      expect(isNotifyShowPayload({ title: "test", body: "test", priority: "low" })).toBe(false);
      expect(isNotifyShowPayload({ title: "test", body: "test", type: "info" })).toBe(false);
    });

    it("should return false for invalid type or priority", () => {
      expect(
        isNotifyShowPayload({ title: "test", body: "test", type: "invalid", priority: "medium" })
      ).toBe(false);
      expect(
        isNotifyShowPayload({ title: "test", body: "test", type: "info", priority: "invalid" })
      ).toBe(false);
    });

    it("should return false for invalid actions", () => {
      expect(
        isNotifyShowPayload({
          title: "test",
          body: "test",
          type: "info",
          priority: "low",
          actions: "invalid",
        })
      ).toBe(false);
      expect(
        isNotifyShowPayload({
          title: "test",
          body: "test",
          type: "info",
          priority: "low",
          actions: [{ invalid: true }],
        })
      ).toBe(false);
    });

    it("should return false for invalid timeout", () => {
      expect(
        isNotifyShowPayload({
          title: "test",
          body: "test",
          type: "info",
          priority: "low",
          timeout: "5000",
        })
      ).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isNotifyShowPayload(null)).toBe(false);
      expect(isNotifyShowPayload("string")).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = { title: "Test", body: "Body", type: "info", priority: "medium" };
      if (isNotifyShowPayload(value)) {
        const _payload: NotifyShowPayload = value;
        expect(_payload.title).toBe("Test");
      }
    });
  });

  describe("interface structure", () => {
    it("should allow valid notification payloads", () => {
      const payload: NotifyShowPayload = {
        title: "Update Available",
        body: "Version 2.0 is now available",
        type: "info",
        priority: "medium",
        actions: [
          { label: "Update Now", actionId: "update" },
          { label: "Later", actionId: "dismiss" },
        ],
        timeout: 10000,
      };
      expect(payload.type).toBe("info");
    });
  });
});

describe("NotificationClickedPayload", () => {
  it("should allow payloads with actionId", () => {
    const payload: NotificationClickedPayload = {
      actionId: "ok",
    };
    expect(payload.actionId).toBe("ok");
  });

  it("should allow payloads without actionId (body clicked)", () => {
    const payload: NotificationClickedPayload = {};
    expect(payload.actionId).toBeUndefined();
  });
});

describe("ConfigSetPayload", () => {
  describe("isConfigSetPayload type guard", () => {
    it("should return true for valid payloads", () => {
      expect(isConfigSetPayload({ updates: { logLevel: "debug" } })).toBe(true);
      expect(isConfigSetPayload({ updates: {} })).toBe(true);
    });

    it("should return false when updates is missing", () => {
      expect(isConfigSetPayload({})).toBe(false);
    });

    it("should return false when updates is not an object", () => {
      expect(isConfigSetPayload({ updates: "invalid" })).toBe(false);
      expect(isConfigSetPayload({ updates: null })).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isConfigSetPayload(null)).toBe(false);
      expect(isConfigSetPayload("string")).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = { updates: { logLevel: "debug" } };
      if (isConfigSetPayload(value)) {
        const _payload: ConfigSetPayload = value;
        expect(_payload.updates).toBeDefined();
      }
    });
  });

  describe("interface structure", () => {
    it("should allow partial config updates", () => {
      const payload: ConfigSetPayload = {
        updates: {
          logLevel: LogLevel.DEBUG,
          stt: { backend: "local" },
        },
      };
      expect(payload.updates.logLevel).toBe("debug");
    });
  });
});

describe("ConfigChangedPayload", () => {
  describe("isConfigChangedPayload type guard", () => {
    it("should return true for valid payloads", () => {
      const payload = {
        config: DEFAULT_CONFIG,
        changedKeys: ["logLevel"],
      };
      expect(isConfigChangedPayload(payload)).toBe(true);
    });

    it("should return true for payloads with multiple changed keys", () => {
      const payload = {
        config: DEFAULT_CONFIG,
        changedKeys: ["logLevel", "stt.backend", "llm.model"],
      };
      expect(isConfigChangedPayload(payload)).toBe(true);
    });

    it("should return true for payloads with empty changedKeys", () => {
      const payload = {
        config: DEFAULT_CONFIG,
        changedKeys: [],
      };
      expect(isConfigChangedPayload(payload)).toBe(true);
    });

    it("should return false when config is missing or invalid", () => {
      expect(isConfigChangedPayload({ changedKeys: [] })).toBe(false);
      expect(isConfigChangedPayload({ config: null, changedKeys: [] })).toBe(false);
      expect(isConfigChangedPayload({ config: "invalid", changedKeys: [] })).toBe(false);
    });

    it("should return false when changedKeys is missing or invalid", () => {
      expect(isConfigChangedPayload({ config: DEFAULT_CONFIG })).toBe(false);
      expect(isConfigChangedPayload({ config: DEFAULT_CONFIG, changedKeys: "invalid" })).toBe(
        false
      );
      expect(isConfigChangedPayload({ config: DEFAULT_CONFIG, changedKeys: [123] })).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isConfigChangedPayload(null)).toBe(false);
      expect(isConfigChangedPayload("string")).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = { config: DEFAULT_CONFIG, changedKeys: ["logLevel"] };
      if (isConfigChangedPayload(value)) {
        const _payload: ConfigChangedPayload = value;
        expect(_payload.changedKeys).toContain("logLevel");
      }
    });
  });
});

describe("ConfigGetResponse", () => {
  it("should contain the full AppConfig", () => {
    const response: ConfigGetResponse = {
      config: DEFAULT_CONFIG,
    };
    expect(response.config.logLevel).toBe(LogLevel.INFO);
  });
});

describe("AppVersionResponse", () => {
  describe("isAppVersionResponse type guard", () => {
    it("should return true for valid responses", () => {
      const response = {
        version: "1.0.0",
        electronVersion: "40.0.0",
        nodeVersion: "20.0.0",
      };
      expect(isAppVersionResponse(response)).toBe(true);
    });

    it("should return false when fields are missing", () => {
      expect(isAppVersionResponse({ electronVersion: "40.0.0", nodeVersion: "20.0.0" })).toBe(
        false
      );
      expect(isAppVersionResponse({ version: "1.0.0", nodeVersion: "20.0.0" })).toBe(false);
      expect(isAppVersionResponse({ version: "1.0.0", electronVersion: "40.0.0" })).toBe(false);
    });

    it("should return false when fields have wrong types", () => {
      expect(
        isAppVersionResponse({ version: 1, electronVersion: "40.0.0", nodeVersion: "20.0.0" })
      ).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isAppVersionResponse(null)).toBe(false);
      expect(isAppVersionResponse("string")).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = {
        version: "1.0.0",
        electronVersion: "40.0.0",
        nodeVersion: "20.0.0",
      };
      if (isAppVersionResponse(value)) {
        const _response: AppVersionResponse = value;
        expect(_response.version).toBe("1.0.0");
      }
    });
  });

  describe("interface structure", () => {
    it("should contain all version fields", () => {
      const response: AppVersionResponse = {
        version: "2.1.0",
        electronVersion: "40.2.1",
        nodeVersion: "20.11.0",
      };
      expect(response.version).toBe("2.1.0");
      expect(response.electronVersion).toBe("40.2.1");
      expect(response.nodeVersion).toBe("20.11.0");
    });
  });
});

describe("TextInputSubmitPayload", () => {
  describe("isTextInputSubmitPayload type guard", () => {
    it("should return true for valid payloads", () => {
      const payload = {
        text: "Hello world",
        timestamp: "2024-01-15T10:30:00.000Z",
      };
      expect(isTextInputSubmitPayload(payload)).toBe(true);
    });

    it("should return true for empty text", () => {
      const payload = {
        text: "",
        timestamp: "2024-01-15T10:30:00.000Z",
      };
      expect(isTextInputSubmitPayload(payload)).toBe(true);
    });

    it("should return false when text is missing", () => {
      expect(isTextInputSubmitPayload({ timestamp: "2024-01-15T10:30:00.000Z" })).toBe(false);
    });

    it("should return false when timestamp is missing", () => {
      expect(isTextInputSubmitPayload({ text: "Hello" })).toBe(false);
    });

    it("should return false when text is not a string", () => {
      expect(isTextInputSubmitPayload({ text: 123, timestamp: "2024-01-15T10:30:00.000Z" })).toBe(
        false
      );
    });

    it("should return false when timestamp is not a string", () => {
      expect(isTextInputSubmitPayload({ text: "Hello", timestamp: 123 })).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isTextInputSubmitPayload(null)).toBe(false);
      expect(isTextInputSubmitPayload("string")).toBe(false);
      expect(isTextInputSubmitPayload(123)).toBe(false);
      expect(isTextInputSubmitPayload(undefined)).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = { text: "Test input", timestamp: "2024-01-15T10:30:00.000Z" };
      if (isTextInputSubmitPayload(value)) {
        const _payload: TextInputSubmitPayload = value;
        expect(_payload.text).toBe("Test input");
      }
    });
  });

  describe("interface structure", () => {
    it("should allow valid payload structures", () => {
      const payload: TextInputSubmitPayload = {
        text: "User input text",
        timestamp: "2024-01-15T10:30:00.000Z",
      };
      expect(payload.text).toBe("User input text");
      expect(payload.timestamp).toBe("2024-01-15T10:30:00.000Z");
    });
  });
});

describe("TextInputOpenPayload", () => {
  describe("interface structure", () => {
    it("should allow payload with placeholder", () => {
      const payload: TextInputOpenPayload = {
        placeholder: "Type your command...",
      };
      expect(payload.placeholder).toBe("Type your command...");
    });

    it("should allow empty payload", () => {
      const payload: TextInputOpenPayload = {};
      expect(payload.placeholder).toBeUndefined();
    });
  });
});

describe("IpcPayloadMap", () => {
  it("should map LOG_MESSAGE to LogMessagePayload", () => {
    const _test: IpcPayloadMap["log:message"] = {
      level: LogLevel.INFO,
      message: "test",
    };
    expect(_test.level).toBe("info");
  });

  it("should map NOTIFY_SHOW to NotifyShowPayload", () => {
    const _test: IpcPayloadMap["notify:show"] = {
      title: "Test",
      body: "Body",
      type: "info",
      priority: "medium",
    };
    expect(_test.title).toBe("Test");
  });

  it("should map CONFIG_GET to void", () => {
    const _test: IpcPayloadMap["config:get"] = undefined;
    expect(_test).toBeUndefined();
  });

  it("should map CONFIG_SET to ConfigSetPayload", () => {
    const _test: IpcPayloadMap["config:set"] = {
      updates: { logLevel: LogLevel.DEBUG },
    };
    expect(_test.updates.logLevel).toBe("debug");
  });

  it("should map CONFIG_CHANGED to ConfigChangedPayload", () => {
    const _test: IpcPayloadMap["config:changed"] = {
      config: DEFAULT_CONFIG,
      changedKeys: ["logLevel"],
    };
    expect(_test.changedKeys).toHaveLength(1);
  });

  it("should map APP_QUIT to void", () => {
    const _test: IpcPayloadMap["app:quit"] = undefined;
    expect(_test).toBeUndefined();
  });

  it("should map APP_VERSION to void", () => {
    const _test: IpcPayloadMap["app:version"] = undefined;
    expect(_test).toBeUndefined();
  });
});

describe("IpcResponseMap", () => {
  it("should map CONFIG_GET to ConfigGetResponse", () => {
    const _test: IpcResponseMap["config:get"] = {
      config: DEFAULT_CONFIG,
    };
    expect(_test.config).toBe(DEFAULT_CONFIG);
  });

  it("should map APP_VERSION to AppVersionResponse", () => {
    const _test: IpcResponseMap["app:version"] = {
      version: "1.0.0",
      electronVersion: "40.0.0",
      nodeVersion: "20.0.0",
    };
    expect(_test.version).toBe("1.0.0");
  });
});

describe("Type-level constraints", () => {
  it("should not allow invalid IPC channels", () => {
    // @ts-expect-error - invalid channel
    const _invalidChannel: IpcChannel = "invalid:channel";
    expect(_invalidChannel).toBe("invalid:channel");
  });

  it("should not allow invalid notification types", () => {
    // @ts-expect-error - invalid notification type
    const _invalidType: NotificationType = "alert";
    expect(_invalidType).toBe("alert");
  });

  it("should not allow invalid notification priorities", () => {
    // @ts-expect-error - invalid notification priority
    const _invalidPriority: NotificationPriority = "critical";
    expect(_invalidPriority).toBe("critical");
  });

  it("should require all mandatory fields in LogMessagePayload", () => {
    // @ts-expect-error - missing message
    const _invalid: LogMessagePayload = {
      level: LogLevel.INFO,
    };
    expect(_invalid).toBeDefined();
  });

  it("should require all mandatory fields in NotifyShowPayload", () => {
    // @ts-expect-error - missing body, type, priority
    const _invalid: NotifyShowPayload = {
      title: "Test",
    };
    expect(_invalid).toBeDefined();
  });

  it("should require all mandatory fields in NotificationAction", () => {
    // @ts-expect-error - missing actionId
    const _invalid: NotificationAction = {
      label: "OK",
    };
    expect(_invalid).toBeDefined();
  });

  it("should require updates in ConfigSetPayload", () => {
    // @ts-expect-error - missing updates
    const _invalid: ConfigSetPayload = {};
    expect(_invalid).toBeDefined();
  });

  it("should require all fields in ConfigChangedPayload", () => {
    // @ts-expect-error - missing changedKeys
    const _invalid: ConfigChangedPayload = {
      config: DEFAULT_CONFIG,
    };
    expect(_invalid).toBeDefined();
  });

  it("should require all fields in AppVersionResponse", () => {
    // @ts-expect-error - missing electronVersion and nodeVersion
    const _invalid: AppVersionResponse = {
      version: "1.0.0",
    };
    expect(_invalid).toBeDefined();
  });

  it("should not allow accessing non-existent channels in IpcPayloadMap", () => {
    // @ts-expect-error - invalid channel key
    const _invalid: IpcPayloadMap["invalid:channel"] = {};
    expect(_invalid).toBeDefined();
  });

  it("should not allow accessing non-existent channels in IpcResponseMap", () => {
    // @ts-expect-error - invalid channel key
    const _invalid: IpcResponseMap["invalid:channel"] = {};
    expect(_invalid).toBeDefined();
  });
});
