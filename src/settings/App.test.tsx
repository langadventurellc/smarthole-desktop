import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { App } from "./App";
import type { AppConfig } from "../types/config";

// Mock electronAPI
const mockConfig: AppConfig = {
  hotkey: {
    voiceInput: "CommandOrControl+Shift+Space",
    textInput: "CommandOrControl+Shift+T",
  },
  voiceInputMode: "push-to-talk",
  stt: {
    backend: "cloud",
  },
  llm: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
  },
  logLevel: "info",
  logMessageContent: false,
  websocketPort: 9473,
  firstRunCompleted: true,
};

function createMockElectronAPI() {
  return {
    getConfig: vi.fn().mockResolvedValue({ config: mockConfig }),
    setConfig: vi.fn().mockResolvedValue(undefined),
    onConfigChanged: vi.fn().mockReturnValue(() => {}),
    hasCredential: vi.fn().mockResolvedValue(false),
    storeCredential: vi.fn().mockResolvedValue(undefined),
    deleteCredential: vi.fn().mockResolvedValue(undefined),
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
  };
}

describe("Settings App", () => {
  let mockElectronAPI: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    mockElectronAPI = createMockElectronAPI();
    global.window.electronAPI = mockElectronAPI as unknown as typeof window.electronAPI;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Loading state", () => {
    it("shows loading state initially", () => {
      // Make getConfig hang so we can see loading state
      mockElectronAPI.getConfig.mockReturnValue(new Promise(() => {}));
      render(<App />);
      expect(screen.getByText("Loading settings...")).toBeInTheDocument();
    });
  });

  describe("Tab navigation", () => {
    it("renders all navigation tabs", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      // Check navigation buttons specifically
      expect(screen.getByRole("button", { name: "Hotkeys" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Voice Input" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Speech-to-Text" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "AI Routing" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Logging" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Advanced" })).toBeInTheDocument();
    });

    it("starts on Hotkeys tab", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      // Check that hotkeys section title is visible
      expect(screen.getByRole("heading", { name: "Hotkeys" })).toBeInTheDocument();
      expect(screen.getByLabelText("Voice Input Hotkey")).toBeInTheDocument();
    });

    it("switches to Voice Input tab when clicked", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Voice Input" }));

      expect(screen.getByRole("heading", { name: "Voice Input" })).toBeInTheDocument();
      expect(screen.getByLabelText("Recording Mode")).toBeInTheDocument();
    });

    it("switches to Logging tab when clicked", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Logging" }));

      expect(screen.getByRole("heading", { name: "Logging" })).toBeInTheDocument();
      expect(screen.getByLabelText("Log Level")).toBeInTheDocument();
    });

    it("switches to Advanced tab when clicked", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

      expect(screen.getByRole("heading", { name: "Advanced" })).toBeInTheDocument();
      expect(screen.getByLabelText("WebSocket Port")).toBeInTheDocument();
    });
  });

  describe("Save and Cancel", () => {
    it("Save button is disabled when no changes", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      expect(saveButton).toBeDisabled();
    });

    it("Cancel button is disabled when no changes", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      expect(cancelButton).toBeDisabled();
    });

    it("Save button enables when config changes", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      // Go to Advanced tab and change port
      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      fireEvent.change(portInput, { target: { value: "9999" } });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      expect(saveButton).not.toBeDisabled();
    });

    it("shows unsaved changes indicator when config changes", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      fireEvent.change(portInput, { target: { value: "9999" } });

      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    it("calls setConfig when Save is clicked", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      fireEvent.change(portInput, { target: { value: "9999" } });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockElectronAPI.setConfig).toHaveBeenCalled();
      });
    });
  });

  describe("Validation", () => {
    it("shows error for invalid port number", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      fireEvent.change(portInput, { target: { value: "80" } });

      expect(screen.getByText("Port must be between 1024 and 65535")).toBeInTheDocument();
    });

    it("disables Save when validation fails", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      fireEvent.change(portInput, { target: { value: "80" } });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Voice Input settings", () => {
    it("displays current voice input mode", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Voice Input" }));
      const select = screen.getByLabelText("Recording Mode");
      expect(select).toHaveValue("push-to-talk");
    });

    it("allows changing voice input mode", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Voice Input" }));
      const select = screen.getByLabelText("Recording Mode");
      fireEvent.change(select, { target: { value: "toggle" } });

      expect(select).toHaveValue("toggle");
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });
  });

  describe("Logging settings", () => {
    it("displays current log level", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Logging" }));
      const select = screen.getByLabelText("Log Level");
      expect(select).toHaveValue("info");
    });

    it("displays log message content toggle", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Logging" }));
      const toggle = screen.getByRole("switch", { name: "Log Message Content" });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Speech-to-Text settings", () => {
    it("switches to STT tab and shows backend selector", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Speech-to-Text" }));

      expect(screen.getByRole("heading", { name: "Speech-to-Text" })).toBeInTheDocument();
      expect(screen.getByLabelText("Backend")).toBeInTheDocument();
    });

    it("shows STT API Key input when cloud backend is selected", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Speech-to-Text" }));

      // Default is cloud backend
      expect(screen.getByLabelText("Backend")).toHaveValue("cloud");

      // Wait for SecretInput to finish checking hasCredential
      await waitFor(() => {
        expect(screen.getByText("STT API Key")).toBeInTheDocument();
        // The label exists, indicating the SecretInput has loaded
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
    });

    it("shows Local Whisper Path input when local backend is selected", async () => {
      // Create config with local backend
      const localConfig = {
        ...mockConfig,
        stt: { backend: "local" as const, localWhisperPath: "/usr/local/whisper" },
      };
      mockElectronAPI.getConfig.mockResolvedValue({ config: localConfig });

      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Speech-to-Text" }));

      expect(screen.getByLabelText("Backend")).toHaveValue("local");
      expect(screen.getByLabelText("Local Whisper Path")).toBeInTheDocument();
      expect(screen.queryByLabelText("STT API Key")).not.toBeInTheDocument();
    });

    it("switches from cloud to local backend and shows path input", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Speech-to-Text" }));

      // Change backend to local
      const backendSelect = screen.getByLabelText("Backend");
      fireEvent.change(backendSelect, { target: { value: "local" } });

      // API key should disappear, path input should appear
      expect(screen.queryByLabelText("STT API Key")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Local Whisper Path")).toBeInTheDocument();
    });
  });

  describe("AI Routing settings", () => {
    it("switches to AI Routing tab and shows Anthropic API key input", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "AI Routing" }));

      expect(screen.getByRole("heading", { name: "AI Routing" })).toBeInTheDocument();

      // Wait for SecretInput to finish checking hasCredential
      await waitFor(() => {
        expect(screen.getByText("Anthropic API Key")).toBeInTheDocument();
        // Check the loading text is gone, meaning the input is ready
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
    });

    it("shows model selector on AI Routing tab", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "AI Routing" }));

      const modelSelect = screen.getByLabelText("Model");
      expect(modelSelect).toBeInTheDocument();
      expect(modelSelect).toHaveValue("claude-haiku-4-5");
    });
  });

  describe("Credential operations", () => {
    it("calls storeCredential when saving a new API key", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "AI Routing" }));

      // Wait for hasCredential check to complete (shows "Not configured" when no credential)
      await waitFor(() => {
        expect(screen.getByText("Not configured")).toBeInTheDocument();
      });

      // Click the Add button to show input field (button text is "Add" when no credential exists)
      const addButton = screen.getByRole("button", { name: "Add" });
      fireEvent.click(addButton);

      // Enter a new API key
      const input = screen.getByPlaceholderText("Enter API key");
      fireEvent.change(input, { target: { value: "sk-test-key-123" } });

      // Click save on the SecretInput
      const saveButton = screen.getByRole("button", { name: "Save" });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockElectronAPI.storeCredential).toHaveBeenCalledWith(
          "anthropic-api-key",
          "sk-test-key-123"
        );
      });
    });

    it("calls deleteCredential when clearing an existing API key", async () => {
      // Mock that credential already exists
      mockElectronAPI.hasCredential.mockResolvedValue(true);

      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "AI Routing" }));

      // Wait for hasCredential check to complete (shows masked value when credential exists)
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
      });

      // Click the Clear button
      const clearButton = screen.getByRole("button", { name: "Clear" });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(mockElectronAPI.deleteCredential).toHaveBeenCalledWith("anthropic-api-key");
      });
    });
  });

  describe("Keyboard shortcuts", () => {
    it("Cmd/Ctrl+S triggers save when there are unsaved changes", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      // Make a change
      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      fireEvent.change(portInput, { target: { value: "9999" } });

      // Verify dirty state
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

      // Trigger Cmd+S
      fireEvent.keyDown(window, { key: "s", metaKey: true });

      await waitFor(() => {
        expect(mockElectronAPI.setConfig).toHaveBeenCalled();
      });
    });

    it("Ctrl+S triggers save when there are unsaved changes", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      // Make a change
      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      fireEvent.change(portInput, { target: { value: "8888" } });

      // Trigger Ctrl+S
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });

      await waitFor(() => {
        expect(mockElectronAPI.setConfig).toHaveBeenCalled();
      });
    });

    it("Cmd/Ctrl+S does not save when no changes", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      // Trigger Cmd+S without making changes
      fireEvent.keyDown(window, { key: "s", metaKey: true });

      // Give it a moment to potentially call setConfig
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockElectronAPI.setConfig).not.toHaveBeenCalled();
    });

    it("Escape key reverts changes to original config", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      // Make a change
      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      fireEvent.change(portInput, { target: { value: "9999" } });

      // Verify change was made
      expect(portInput).toHaveValue(9999);
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

      // Press Escape to revert
      fireEvent.keyDown(window, { key: "Escape" });

      // Verify config reverted to original
      expect(portInput).toHaveValue(9473);
      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });

    it("Escape key does nothing when no unsaved changes", async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");

      // Press Escape without making changes
      fireEvent.keyDown(window, { key: "Escape" });

      // Value should remain unchanged
      expect(portInput).toHaveValue(9473);
    });
  });

  describe("External config changes", () => {
    it("preserves user changes when external config update arrives", async () => {
      let configChangedCallback: (config: AppConfig) => void = () => {};

      // Capture the callback when onConfigChanged is called
      mockElectronAPI.onConfigChanged.mockImplementation((callback) => {
        configChangedCallback = callback;
        return () => {};
      });

      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      // Make a local change
      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      fireEvent.change(portInput, { target: { value: "9999" } });

      expect(portInput).toHaveValue(9999);

      // Simulate external config change - wrap in act() since it triggers state updates
      const externalConfig = { ...mockConfig, websocketPort: 8000 };
      await act(async () => {
        configChangedCallback(externalConfig);
      });

      // User's change should be preserved
      await waitFor(() => {
        expect(portInput).toHaveValue(9999);
      });

      // Warning should be shown
      expect(
        screen.getByText("Settings changed externally. Your changes are preserved.")
      ).toBeInTheDocument();
    });

    it("updates config when external change arrives with no dirty state", async () => {
      let configChangedCallback: (config: AppConfig) => void = () => {};

      mockElectronAPI.onConfigChanged.mockImplementation((callback) => {
        configChangedCallback = callback;
        return () => {};
      });

      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
      const portInput = screen.getByLabelText("WebSocket Port");
      expect(portInput).toHaveValue(9473);

      // Simulate external config change (no local changes) - wrap in act()
      const externalConfig = { ...mockConfig, websocketPort: 8000 };
      await act(async () => {
        configChangedCallback(externalConfig);
      });

      // Config should be updated
      await waitFor(() => {
        expect(portInput).toHaveValue(8000);
      });

      // No warning should be shown
      expect(
        screen.queryByText("Settings changed externally. Your changes are preserved.")
      ).not.toBeInTheDocument();
    });
  });
});
