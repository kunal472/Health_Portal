import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// A component that intentionally throws an error to test the Error Boundary
const CrashyComponent = ({ shouldCrash }: { shouldCrash: boolean }) => {
  if (shouldCrash) {
    throw new Error("Simulated component crash!");
  }
  return <div>Component loaded successfully</div>;
};

describe("ErrorBoundary Component", () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on console.error to prevent test output cluttering while testing expected crashes
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should render children normally if no error occurs", () => {
    render(
      <ErrorBoundary>
        <CrashyComponent shouldCrash={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Component loaded successfully")).toBeDefined();
    expect(screen.queryByText("Section Rendering Failed")).toBeNull();
  });

  it("should render default error fallback UI if a child component throws", () => {
    render(
      <ErrorBoundary>
        <CrashyComponent shouldCrash={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText("Component loaded successfully")).toBeNull();
    expect(screen.getByText("Section Rendering Failed")).toBeDefined();
    expect(screen.getByText("Try Again")).toBeDefined();
    expect(screen.getByText("Show Technical Details")).toBeDefined();
  });

  it("should support custom titles through props", () => {
    render(
      <ErrorBoundary title="Custom Error Title">
        <CrashyComponent shouldCrash={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom Error Title")).toBeDefined();
  });

  it("should support a custom fallback node", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Something completely different</div>}>
        <CrashyComponent shouldCrash={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText("Section Rendering Failed")).toBeNull();
    expect(screen.getByTestId("custom-fallback")).toBeDefined();
    expect(screen.getByText("Something completely different")).toBeDefined();
  });

  it("should toggle technical diagnostics stack details on click", async () => {
    render(
      <ErrorBoundary>
        <CrashyComponent shouldCrash={true} />
      </ErrorBoundary>
    );

    const toggleButton = screen.getByRole("button", { name: /Show Technical Details/i });
    
    // Tech logs should not be visible initially
    expect(screen.queryByText(/Simulated component crash!/)).toBeNull();

    // Click to show details
    fireEvent.click(toggleButton);
    const hideButton = await screen.findByRole("button", { name: /Hide Details/i });
    expect(hideButton).toBeDefined();
    expect(screen.getByText(/Simulated component crash!/)).toBeDefined();

    // Click to hide details
    fireEvent.click(hideButton);
    const showButton = await screen.findByRole("button", { name: /Show Technical Details/i });
    expect(showButton).toBeDefined();
    expect(screen.queryByText(/Simulated component crash!/)).toBeNull();
  });

  it("should call onReset and clear error state when Try Again is clicked", () => {
    const handleReset = vi.fn();
    
    // We render a wrapper to dynamically control when CrashyComponent throws
    const TestWrapper = () => {
      const [shouldCrash, setShouldCrash] = React.useState(true);
      return (
        <ErrorBoundary onReset={() => { handleReset(); setShouldCrash(false); }}>
          <CrashyComponent shouldCrash={shouldCrash} />
        </ErrorBoundary>
      );
    };

    render(<TestWrapper />);

    // Assert error state is active
    expect(screen.getByText("Section Rendering Failed")).toBeDefined();

    // Click try again
    const tryAgainButton = screen.getByText("Try Again");
    fireEvent.click(tryAgainButton);

    // Verify recovery callback is run
    expect(handleReset).toHaveBeenCalledTimes(1);

    // Verify UI has recovered and renders successful children
    expect(screen.getByText("Component loaded successfully")).toBeDefined();
    expect(screen.queryByText("Section Rendering Failed")).toBeNull();
  });
});
