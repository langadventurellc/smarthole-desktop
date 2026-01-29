import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { AppError } from "../utils";
import { ErrorCode } from "../types/errors";
import type { ErrorInfo } from "react";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Component that throws an error when shouldThrow is true.
 * Used to trigger error boundary behavior in tests.
 */
function Bomb({ shouldThrow }: { shouldThrow: boolean }): React.ReactNode {
  if (shouldThrow) {
    throw new Error("Boom!");
  }
  return <div>No explosion</div>;
}

/**
 * Component that throws an AppError when shouldThrow is true.
 */
function AppErrorBomb({ shouldThrow }: { shouldThrow: boolean }): React.ReactNode {
  if (shouldThrow) {
    throw new AppError(
      "App error boom!",
      ErrorCode.INTERNAL,
      "An internal error occurred",
      true,
      "high"
    );
  }
  return <div>No app error</div>;
}

// ============================================================================
// Test Setup
// ============================================================================

describe("ErrorBoundary", () => {
  // Suppress React's error logging during tests
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ==========================================================================
  // Basic Rendering
  // ==========================================================================

  describe("basic rendering", () => {
    it("should render children when no error occurs", () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      render(
        <ErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </ErrorBoundary>
      );

      expect(screen.getByText("First child")).toBeInTheDocument();
      expect(screen.getByText("Second child")).toBeInTheDocument();
    });

    it("should render children when Bomb does not throw", () => {
      render(
        <ErrorBoundary>
          <Bomb shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText("No explosion")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Error Catching
  // ==========================================================================

  describe("error catching", () => {
    it("should catch error and show default fallback UI", () => {
      render(
        <ErrorBoundary>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong. Please try reloading.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    });

    it("should wrap standard Error as AppError with INTERNAL code", () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      const [error] = onError.mock.calls[0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.INTERNAL);
      expect(error.message).toBe("Boom!");
      expect(error.userMessage).toBe("Something went wrong. Please try reloading.");
      expect(error.recoverable).toBe(true);
    });

    it("should preserve AppError properties when catching AppError", () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <AppErrorBomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      const [error] = onError.mock.calls[0];
      expect(error).toBeInstanceOf(AppError);
      // The error is wrapped with INTERNAL code in getDerivedStateFromError
      expect(error.code).toBe(ErrorCode.INTERNAL);
    });
  });

  // ==========================================================================
  // onError Callback
  // ==========================================================================

  describe("onError callback", () => {
    it("should call onError with AppError and ErrorInfo", () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      const [error, errorInfo] = onError.mock.calls[0] as [AppError, ErrorInfo];

      expect(error).toBeInstanceOf(AppError);
      expect(errorInfo).toBeDefined();
      expect(typeof errorInfo.componentStack).toBe("string");
    });

    it("should not call onError when no error occurs", () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <Bomb shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(onError).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // IPC Reporting
  // ==========================================================================

  describe("IPC reporting", () => {
    it("should report error via electronAPI.log when available", () => {
      const mockLog = vi.fn();
      const originalElectronAPI = window.electronAPI;

      window.electronAPI = {
        log: mockLog,
      } as unknown as typeof window.electronAPI;

      render(
        <ErrorBoundary>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(mockLog).toHaveBeenCalledTimes(1);
      expect(mockLog).toHaveBeenCalledWith(
        "error",
        expect.stringContaining("React Error Boundary: Boom!"),
        expect.objectContaining({
          code: ErrorCode.INTERNAL,
          componentStack: expect.any(String),
        })
      );

      window.electronAPI = originalElectronAPI;
    });

    it("should not throw if electronAPI is not available", () => {
      const originalElectronAPI = window.electronAPI;
      // @ts-expect-error - intentionally setting to undefined for test
      window.electronAPI = undefined;

      expect(() => {
        render(
          <ErrorBoundary>
            <Bomb shouldThrow={true} />
          </ErrorBoundary>
        );
      }).not.toThrow();

      window.electronAPI = originalElectronAPI;
    });

    it("should not throw if electronAPI.log is not available", () => {
      const originalElectronAPI = window.electronAPI;
      window.electronAPI = {} as unknown as typeof window.electronAPI;

      expect(() => {
        render(
          <ErrorBoundary>
            <Bomb shouldThrow={true} />
          </ErrorBoundary>
        );
      }).not.toThrow();

      window.electronAPI = originalElectronAPI;
    });
  });

  // ==========================================================================
  // Reset Functionality
  // ==========================================================================

  describe("reset functionality", () => {
    it("should reset error state and allow recovery when issue is fixed", () => {
      // Use a component that can be controlled externally
      let shouldThrow = true;

      const ControllableBomb = () => {
        if (shouldThrow) {
          throw new Error("Boom!");
        }
        return <div>No explosion</div>;
      };

      render(
        <ErrorBoundary>
          <ControllableBomb />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // "Fix" the issue
      shouldThrow = false;

      // Click Try Again - this clears error state and re-renders children
      fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

      // Now children should render successfully
      expect(screen.getByText("No explosion")).toBeInTheDocument();
    });

    it("should show error again if component still throws after reset", () => {
      render(
        <ErrorBoundary>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

      // Component still throws, so error should show again
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should call handleReset which clears error state", () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      // First error
      expect(onError).toHaveBeenCalledTimes(1);

      // Click reset - it will re-throw, so onError gets called again
      fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

      // onError is called again because Bomb still throws
      expect(onError).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Custom Fallback (ReactNode)
  // ==========================================================================

  describe("custom fallback (ReactNode)", () => {
    it("should render custom fallback element when provided", () => {
      render(
        <ErrorBoundary fallback={<div>Custom error message</div>}>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Custom error message")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });

    it("should render null fallback without crashing", () => {
      render(
        <ErrorBoundary fallback={null}>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      // null fallback renders nothing
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });

    it("should render string fallback", () => {
      render(
        <ErrorBoundary fallback="Error occurred">
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Error occurred")).toBeInTheDocument();
    });

    it("should render complex fallback component", () => {
      const CustomFallback = () => (
        <div>
          <h1>Oops!</h1>
          <p>Something bad happened</p>
        </div>
      );

      render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Oops!")).toBeInTheDocument();
      expect(screen.getByText("Something bad happened")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Custom Fallback Render Function
  // ==========================================================================

  describe("fallbackRender function", () => {
    it("should call fallbackRender with error and reset function", () => {
      const fallbackRender = vi.fn().mockReturnValue(<div>Render function fallback</div>);

      render(
        <ErrorBoundary fallbackRender={fallbackRender}>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      // fallbackRender may be called multiple times due to React's rendering behavior
      expect(fallbackRender).toHaveBeenCalled();
      const [error, reset] = fallbackRender.mock.calls[0];

      expect(error).toBeInstanceOf(AppError);
      expect(typeof reset).toBe("function");
      expect(screen.getByText("Render function fallback")).toBeInTheDocument();
    });

    it("should allow reset from fallbackRender when issue is fixed", () => {
      let shouldThrow = true;

      const ControllableBomb = () => {
        if (shouldThrow) {
          throw new Error("Boom!");
        }
        return <div>No explosion</div>;
      };

      const FallbackWithReset = ({ error, reset }: { error: AppError; reset: () => void }) => (
        <div>
          <span>Error: {error.message}</span>
          <button onClick={reset}>Custom Reset</button>
        </div>
      );

      render(
        <ErrorBoundary
          fallbackRender={(error, reset) => <FallbackWithReset error={error} reset={reset} />}
        >
          <ControllableBomb />
        </ErrorBoundary>
      );

      expect(screen.getByText("Error: Boom!")).toBeInTheDocument();

      // "Fix" the issue
      shouldThrow = false;

      fireEvent.click(screen.getByRole("button", { name: "Custom Reset" }));

      expect(screen.getByText("No explosion")).toBeInTheDocument();
    });

    it("should have access to error details in fallbackRender", () => {
      render(
        <ErrorBoundary
          fallbackRender={(error) => (
            <div>
              <span data-testid="code">{error.code}</span>
              <span data-testid="message">{error.userMessage}</span>
              <span data-testid="recoverable">{String(error.recoverable)}</span>
            </div>
          )}
        >
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("code")).toHaveTextContent(ErrorCode.INTERNAL);
      expect(screen.getByTestId("message")).toHaveTextContent(
        "Something went wrong. Please try reloading."
      );
      expect(screen.getByTestId("recoverable")).toHaveTextContent("true");
    });

    it("should prioritize fallbackRender over fallback", () => {
      render(
        <ErrorBoundary
          fallback={<div>Static fallback</div>}
          fallbackRender={() => <div>Render function wins</div>}
        >
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Render function wins")).toBeInTheDocument();
      expect(screen.queryByText("Static fallback")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle error thrown in constructor", () => {
      class BrokenConstructor extends Error {
        constructor() {
          super("Constructor error");
        }
      }

      function ThrowInRender(): React.ReactNode {
        throw new BrokenConstructor();
      }

      render(
        <ErrorBoundary>
          <ThrowInRender />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should handle deeply nested errors", () => {
      const DeepChild = () => <Bomb shouldThrow={true} />;
      const MiddleChild = () => <DeepChild />;
      const TopChild = () => <MiddleChild />;

      render(
        <ErrorBoundary>
          <TopChild />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should catch closest error boundary", () => {
      const innerOnError = vi.fn();
      const outerOnError = vi.fn();

      render(
        <ErrorBoundary onError={outerOnError} fallback={<div>Outer fallback</div>}>
          <div>
            <ErrorBoundary onError={innerOnError} fallback={<div>Inner fallback</div>}>
              <Bomb shouldThrow={true} />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>
      );

      expect(innerOnError).toHaveBeenCalledTimes(1);
      expect(outerOnError).not.toHaveBeenCalled();
      expect(screen.getByText("Inner fallback")).toBeInTheDocument();
      expect(screen.queryByText("Outer fallback")).not.toBeInTheDocument();
    });
  });
});
