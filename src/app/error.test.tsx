import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundaryPage from "./error";

describe("Next.js App Error Page Component", () => {
  const mockReset = vi.fn();
  const mockError = new Error("Failed to load root page layouts!");
  mockError.name = "CustomCriticalError";
  (mockError as any).digest = "digest_abc123";

  let consoleErrorSpy: any;
  let originalWindowLocation: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    // Mock window.location
    if (typeof window !== "undefined") {
      originalWindowLocation = window.location;
      delete (window as any).location;
      window.location = {
        href: "",
      } as any;
    }
  });

  afterEach(() => {
    if (typeof window !== "undefined") {
      window.location = originalWindowLocation;
    }
  });

  it("should render Error Screen structure and content", () => {
    render(<ErrorBoundaryPage error={mockError} reset={mockReset} />);

    expect(screen.getByText("System Consultation Failed")).toBeDefined();
    expect(screen.getByText(/unexpected runtime exception/)).toBeDefined();
    expect(screen.getByText("Try Again")).toBeDefined();
    expect(screen.getByText("Return Home")).toBeDefined();
    expect(screen.getByText("Technical Logs")).toBeDefined();
  });

  it("should execute reset callback when Try Again is clicked", () => {
    render(<ErrorBoundaryPage error={mockError} reset={mockReset} />);

    const tryAgainBtn = screen.getByText("Try Again");
    fireEvent.click(tryAgainBtn);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("should navigate to home page when Return Home is clicked", () => {
    render(<ErrorBoundaryPage error={mockError} reset={mockReset} />);

    const returnHomeBtn = screen.getByText("Return Home");
    fireEvent.click(returnHomeBtn);

    expect(window.location.href).toBe("/");
  });

  it("should toggle error diagnostics details on and off", () => {
    render(<ErrorBoundaryPage error={mockError} reset={mockReset} />);

    const toggleLogsBtn = screen.getByText("Technical Logs");

    // Initially diagnostics logs should not be shown
    expect(screen.queryByText(/\[Error\] CustomCriticalError/)).toBeNull();

    // Click to show details
    fireEvent.click(toggleLogsBtn);
    expect(screen.getByText(/\[Error\] CustomCriticalError/)).toBeDefined();
    expect(screen.getByText("Digest ID: digest_abc123")).toBeDefined();

    // Click again to hide details
    fireEvent.click(toggleLogsBtn);
    expect(screen.queryByText(/\[Error\] CustomCriticalError/)).toBeNull();
  });
});
