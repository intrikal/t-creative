/**
 * @file error.test.tsx
 * @description Tests for the dashboard error boundary component.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DashboardError from "./error";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [k: string]: unknown;
  }) => (
    <a href={href} {...(props as object)}>
      {children}
    </a>
  ),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("DashboardError", () => {
  const mockReset = vi.fn();
  const mockError = Object.assign(new Error("Failed to load bookings"), {
    digest: "test-digest",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays the error message", () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    expect(screen.getByText("Failed to load bookings")).toBeInTheDocument();
  });

  it("displays the heading", () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls reset when 'Try again' is clicked", () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(mockReset).toHaveBeenCalledOnce();
  });

  it("renders a link to the dashboard home", () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    const link = screen.getByText("Go to dashboard home");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("reports the error to Sentry", async () => {
    const Sentry = await import("@sentry/nextjs");
    render(<DashboardError error={mockError} reset={mockReset} />);
    expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
  });
});
