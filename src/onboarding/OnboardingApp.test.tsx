import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingApp } from "./OnboardingApp";

// Mock the electronAPI
const mockElectronAPI = {
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  hasCredential: vi.fn(),
  storeCredential: vi.fn(),
  deleteCredential: vi.fn(),
  checkMicrophonePermission: vi.fn(),
  requestMicrophonePermission: vi.fn(),
  checkAccessibilityPermission: vi.fn(),
  openAccessibilitySettings: vi.fn(),
  showOpenDialog: vi.fn(),
};

Object.defineProperty(window, "electronAPI", {
  value: mockElectronAPI,
  writable: true,
});

describe("OnboardingApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default config response
    mockElectronAPI.getConfig.mockResolvedValue({
      config: {
        stt: { backend: "cloud", localWhisperPath: "" },
        llm: { provider: "anthropic", model: "claude-3-haiku-20240307" },
        firstRunCompleted: false,
      },
    });
    mockElectronAPI.setConfig.mockResolvedValue(undefined);
    mockElectronAPI.hasCredential.mockResolvedValue(false);
    mockElectronAPI.checkMicrophonePermission.mockResolvedValue({ status: "granted" });
    mockElectronAPI.checkAccessibilityPermission.mockResolvedValue({ trusted: true });
  });

  it("renders loading state initially", () => {
    render(<OnboardingApp />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders welcome step after loading", async () => {
    render(<OnboardingApp />);

    await waitFor(() => {
      expect(screen.getByText("Welcome to SmartHole")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
  });

  it("loads config on mount", async () => {
    render(<OnboardingApp />);

    await waitFor(() => {
      expect(mockElectronAPI.getConfig).toHaveBeenCalled();
    });
  });

  it("navigates to permissions step when clicking Get Started", async () => {
    render(<OnboardingApp />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));

    await waitFor(() => {
      // Check for permissions step title (h2 element)
      expect(screen.getByRole("heading", { name: "Permissions", level: 2 })).toBeInTheDocument();
    });
  });

  it("shows progress indicator with all steps", async () => {
    render(<OnboardingApp />);

    await waitFor(() => {
      expect(screen.getByText("Welcome")).toBeInTheDocument();
      expect(screen.getByText("Permissions")).toBeInTheDocument();
      expect(screen.getByText("Speech")).toBeInTheDocument();
      expect(screen.getByText("AI")).toBeInTheDocument();
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });
  });

  it("navigates back from permissions step", async () => {
    render(<OnboardingApp />);

    // Go to permissions step
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));

    // Wait for permissions step
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    });

    // Go back
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    // Should be back at welcome
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
    });
  });

  it("skipping goes to complete step", async () => {
    render(<OnboardingApp />);

    // Go to permissions step
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));

    // Wait for permissions step and skip
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    // Should be at complete step
    await waitFor(() => {
      expect(screen.getByText("You're All Set!")).toBeInTheDocument();
    });
  });

  it("saves STT backend change to config", async () => {
    render(<OnboardingApp />);

    // Navigate to STT step
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Now at STT step
    await waitFor(() => {
      expect(screen.getByText("Speech-to-Text")).toBeInTheDocument();
    });

    // Click local option
    fireEvent.click(screen.getByText("Local (Self-hosted Whisper)"));

    await waitFor(() => {
      expect(mockElectronAPI.setConfig).toHaveBeenCalledWith({
        stt: { backend: "local" },
      });
    });
  });

  it("handles config load error gracefully", async () => {
    mockElectronAPI.getConfig.mockRejectedValue(new Error("Config load failed"));

    render(<OnboardingApp />);

    // Should still render after error
    await waitFor(() => {
      expect(screen.getByText("Welcome to SmartHole")).toBeInTheDocument();
    });
  });
});
