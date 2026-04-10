/**
 * Tests for the CommandPalette component.
 *
 * Verifies Cmd+K open/close behaviour, search filtering, navigation on
 * item selection, and Escape-to-close.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  Element.prototype.scrollIntoView = vi.fn();
});
import { CommandPalette } from "./CommandPalette";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
});

function openPalette() {
  fireEvent.keyDown(window, { key: "k", metaKey: true });
}

describe("CommandPalette", () => {
  it("opens when Cmd+K is pressed", () => {
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText("Search pages and actions…")).toBeNull();

    openPalette();
    expect(screen.getByPlaceholderText("Search pages and actions…")).toBeInTheDocument();
  });

  it("closes when Escape is pressed", () => {
    render(<CommandPalette />);
    openPalette();
    expect(screen.getByPlaceholderText("Search pages and actions…")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByPlaceholderText("Search pages and actions…"), { key: "Escape" });
    expect(screen.queryByPlaceholderText("Search pages and actions…")).toBeNull();
  });

  it("closes when clicking the overlay backdrop", () => {
    render(<CommandPalette />);
    openPalette();

    const overlay = screen.getByTestId("command-palette-overlay");
    fireEvent.click(overlay);
    expect(screen.queryByPlaceholderText("Search pages and actions…")).toBeNull();
  });

  it("filters items by search query", () => {
    render(<CommandPalette />);
    openPalette();

    const input = screen.getByPlaceholderText("Search pages and actions…");
    fireEvent.change(input, { target: { value: "Calendar" } });

    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.queryByText("Messages")).toBeNull();
  });

  it("navigates and closes on item selection", () => {
    render(<CommandPalette />);
    openPalette();

    const item = screen.getByText("Bookings");
    fireEvent.click(item);

    expect(pushMock).toHaveBeenCalledWith("/dashboard/bookings");
    expect(screen.queryByPlaceholderText("Search pages and actions…")).toBeNull();
  });

  it("toggles closed with a second Cmd+K press", () => {
    render(<CommandPalette />);
    openPalette();
    expect(screen.getByPlaceholderText("Search pages and actions…")).toBeInTheDocument();

    openPalette();
    expect(screen.queryByPlaceholderText("Search pages and actions…")).toBeNull();
  });
});
