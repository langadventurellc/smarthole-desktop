/**
 * React Error Boundary component for catching rendering errors.
 *
 * Catches JavaScript errors in child component tree and displays
 * a fallback UI instead of crashing the application.
 */

import { Component, ErrorInfo, ReactNode } from "react";
import { wrapError, AppError } from "../utils";
import { ErrorCode } from "../types/errors";

// ============================================================================
// Types
// ============================================================================

/**
 * Render function type for custom fallback UI.
 */
export type FallbackRender = (error: AppError, reset: () => void) => ReactNode;

/**
 * Props for the ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional custom fallback UI (element or render function) */
  fallback?: ReactNode;
  /** Optional custom fallback render function (receives error and reset callback) */
  fallbackRender?: FallbackRender;
  /** Called when an error is caught */
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
}

/**
 * Internal state for the ErrorBoundary component.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
}

/**
 * Props for the default fallback component.
 */
interface DefaultErrorFallbackProps {
  error: AppError;
  onReset: () => void;
}

// ============================================================================
// Default Fallback Component
// ============================================================================

/**
 * Default fallback UI shown when an error occurs.
 * Displays a user-friendly message and a "Try Again" button.
 */
function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps): ReactNode {
  return (
    <div
      style={{
        padding: "20px",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2 style={{ color: "#e53e3e", marginBottom: "10px" }}>Something went wrong</h2>
      <p style={{ color: "#718096", marginBottom: "20px" }}>{error.userMessage}</p>
      <button
        onClick={onReset}
        style={{
          padding: "8px 16px",
          backgroundColor: "#4299e1",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Try Again
      </button>
    </div>
  );
}

// ============================================================================
// Error Boundary Component
// ============================================================================

/**
 * Error Boundary component that catches React rendering errors.
 *
 * Features:
 * - Catches JavaScript errors in child component tree
 * - Wraps caught errors as AppError for consistent handling
 * - Reports errors to main process via IPC
 * - Displays fallback UI instead of crashing
 * - Supports custom fallback UI (ReactNode or render function)
 * - Provides reset functionality to retry rendering
 *
 * Important limitations (these are React Error Boundary limitations):
 * - Does NOT catch errors in event handlers (use try/catch)
 * - Does NOT catch errors in async code (use try/catch)
 * - Does NOT catch errors in server-side rendering
 * - Does NOT catch errors thrown in the error boundary itself
 *
 * @example Basic usage
 * ```tsx
 * <ErrorBoundary onError={(error) => console.error(error)}>
 *   <App />
 * </ErrorBoundary>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <App />
 * </ErrorBoundary>
 * ```
 *
 * @example With fallback render function
 * ```tsx
 * <ErrorBoundary
 *   fallbackRender={(error, reset) => (
 *     <div>
 *       <p>{error.userMessage}</p>
 *       <button onClick={reset}>Retry</button>
 *     </div>
 *   )}
 * >
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Called when an error is thrown during rendering.
   * Updates state to trigger fallback UI on next render.
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const appError = wrapError(error, {
      code: ErrorCode.INTERNAL,
      userMessage: "Something went wrong. Please try reloading.",
      recoverable: true,
    });
    return { hasError: true, error: appError };
  }

  /**
   * Called after an error is caught.
   * Reports error to main process and calls onError callback.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const appError = this.state.error ?? wrapError(error);

    // Report to main process via IPC if available
    if (typeof window !== "undefined" && window.electronAPI?.log) {
      window.electronAPI.log("error", `React Error Boundary: ${appError.message}`, {
        code: appError.code,
        componentStack: errorInfo.componentStack,
      });
    }

    this.props.onError?.(appError, errorInfo);
  }

  /**
   * Resets the error state, allowing children to re-render.
   * Call this from a "Try Again" button or similar.
   */
  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error } = this.state;
      const { fallback, fallbackRender } = this.props;

      // Custom fallback render function (has priority)
      if (fallbackRender && error) {
        return fallbackRender(error, this.handleReset);
      }

      // Custom fallback element
      if (fallback !== undefined) {
        return fallback;
      }

      // Default fallback UI
      return <DefaultErrorFallback error={error!} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}
