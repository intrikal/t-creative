/**
 * Component tests for the Button UI primitive.
 *
 * Verifies rendering modes (button vs link via asChild), default variant
 * styling, type attribute, and click handler delegation.
 *
 * Related files:
 *   - components/ui/Button.tsx — the component under test
 */

import Link from "next/link";
import type { ReactNode } from "react";
// render: mounts a React component into a virtual DOM for testing
// screen: queries to find elements in rendered output (getByText, getByRole)
// fireEvent: simulates user interactions (click)
import { render, screen, fireEvent } from "@testing-library/react";
// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions
import { describe, it, expect, vi } from "vitest";
import { Button } from "./Button";

// vi.mock("next/link"): replaces Next.js Link with a plain <a> tag so
// link rendering works in the test DOM without the Next.js router
vi.mock("next/link", () => ({
  default: ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children as ReactNode}</a>,
}));

// vi.mock("framer-motion"): replaces Framer Motion's motion components with
// plain HTML elements so animations don't interfere with test assertions
vi.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...props }: Record<string, unknown>) => (
      <button {...props}>{children as ReactNode}</button>
    ),
    a: ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children as ReactNode}</a>,
    create:
      () =>
      ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children as ReactNode}</a>,
  },
}));

// Tests the Button component: text rendering, button vs link mode (asChild),
// type="button" default, variant CSS classes, and onClick handler
describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("renders as button when no href provided", () => {
    render(<Button>No Link</Button>);
    expect(screen.getByRole("button", { name: "No Link" })).toBeInTheDocument();
  });

  it('has type="button" when rendered as button', () => {
    render(<Button>Typed</Button>);
    const btn = screen.getByRole("button", { name: "Typed" });
    expect(btn).toHaveAttribute("type", "button");
  });

  it("renders as link when used with asChild and Link", () => {
    render(
      <Button asChild>
        <Link href="/contact">Contact</Link>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Contact" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/contact");
  });

  it("applies primary variant classes by default", () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole("button", { name: "Primary" });
    expect(btn.className).toContain("bg-btn-primary");
  });

  it("calls onClick handler when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Clickable</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Clickable" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
