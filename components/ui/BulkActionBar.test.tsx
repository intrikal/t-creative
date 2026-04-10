/**
 * Component tests for BulkActionBar.
 *
 * Verifies visibility based on selectedCount, clear button behavior,
 * and rendering of action button children.
 */
import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BulkActionBar } from "./BulkActionBar";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  m: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as ReactNode}</div>
    ),
  },
}));

describe("BulkActionBar", () => {
  it("renders when selectedCount > 0", () => {
    render(
      <BulkActionBar selectedCount={3} onClear={vi.fn()}>
        <button type="button">Delete</button>
      </BulkActionBar>,
    );

    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("does not render when selectedCount is 0", () => {
    const { container } = render(
      <BulkActionBar selectedCount={0} onClear={vi.fn()}>
        <button type="button">Delete</button>
      </BulkActionBar>,
    );

    expect(container.innerHTML).toBe("");
  });

  it("calls onClear when the clear button is clicked", () => {
    const onClear = vi.fn();

    render(
      <BulkActionBar selectedCount={2} onClear={onClear}>
        <button type="button">Archive</button>
      </BulkActionBar>,
    );

    fireEvent.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("renders action buttons passed as children", () => {
    render(
      <BulkActionBar selectedCount={1} onClear={vi.fn()}>
        <button type="button">Export</button>
        <button type="button">Delete</button>
      </BulkActionBar>,
    );

    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });
});
