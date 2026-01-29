---
id: T-create-react-error-boundary
title: Create React Error Boundary Component
status: open
priority: medium
parent: F-error-handling-framework
prerequisites:
  - T-create-error-wrapping-utility
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T04:32:25.164Z
updated: 2026-01-29T04:32:25.164Z
---

# Create React Error Boundary Component

## Context

This task is part of the **F-error-handling-framework** feature. It creates a React Error Boundary component to catch rendering errors in the renderer process and display a user-friendly fallback UI.

Reference: [F-error-handling-framework](trellis://F-error-handling-framework)  
Prerequisite: [T-create-error-wrapping-utility](trellis://T-create-error-wrapping-utility)

## Overview

Create a React Error Boundary component that:

- Catches JavaScript errors in child component tree
- Displays a fallback UI instead of crashing
- Reports errors to main process via IPC
- Provides a way to recover (retry/reload)

## Files to Create

- `src/components/ErrorBoundary.tsx` - Error boundary component
- `src/components/ErrorBoundary.test.tsx` - Unit tests
- `src/components/index.ts` - Barrel export

## Implementation Requirements

### Error Boundary Component

````typescript
import React, { Component, ErrorInfo, ReactNode } from "react";
import { wrapError, AppError } from "../utils/errors";
import { ErrorCode } from "../types/errors";

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode | ((error: AppError, reset: () => void) => ReactNode);
  /** Called when an error is caught */
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
}

/**
 * Error Boundary component that catches React rendering errors.
 *
 * @example
 * ```tsx
 * <ErrorBoundary onError={(error) => console.error(error)}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const appError = wrapError(error, {
      code: ErrorCode.INTERNAL,
      userMessage: "Something went wrong. Please try reloading.",
      recoverable: true,
    });
    return { hasError: true, error: appError };
  }

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

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error } = this.state;
      const { fallback } = this.props;

      // Custom fallback renderer
      if (typeof fallback === "function" && error) {
        return fallback(error, this.handleReset);
      }

      // Custom fallback element
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={error!}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}
````

### Default Fallback Component

```typescript
interface DefaultErrorFallbackProps {
  error: AppError;
  onReset: () => void;
}

/**
 * Default fallback UI shown when an error occurs.
 */
function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps): JSX.Element {
  return (
    <div style={{
      padding: "20px",
      textAlign: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <h2 style={{ color: "#e53e3e", marginBottom: "10px" }}>
        Something went wrong
      </h2>
      <p style={{ color: "#718096", marginBottom: "20px" }}>
        {error.userMessage}
      </p>
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
```

### Barrel Export

Create `src/components/index.ts`:

```typescript
export { ErrorBoundary } from "./ErrorBoundary";
```

## Acceptance Criteria

1. [ ] `ErrorBoundary` catches errors in child components
2. [ ] `getDerivedStateFromError` wraps error as AppError
3. [ ] `componentDidCatch` reports error to main process via IPC
4. [ ] `componentDidCatch` calls `onError` prop if provided
5. [ ] Default fallback UI displays user-friendly message
6. [ ] Default fallback includes "Try Again" button
7. [ ] Reset functionality clears error state and re-renders children
8. [ ] Custom fallback prop (ReactNode) is rendered if provided
9. [ ] Custom fallback function receives error and reset callback
10. [ ] Barrel export created in `src/components/index.ts`

## Testing Requirements

Create `src/components/ErrorBoundary.test.tsx` with tests for:

- Renders children when no error
- Catches error and shows fallback UI
- Calls onError prop with AppError and ErrorInfo
- Reports error via IPC (mock electronAPI)
- Reset button clears error state
- Custom fallback ReactNode is rendered
- Custom fallback function receives error and reset

Use a "Bomb" component that throws to trigger errors:

```typescript
const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Boom!");
  }
  return <div>No explosion</div>;
};
```

## Notes

- Error boundaries only catch errors during rendering, in lifecycle methods, and in constructors
- They do NOT catch errors in event handlers (use try/catch there)
- They do NOT catch errors in async code (use try/catch)
- Use `console.error` spy to suppress React's error logging in tests
