import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "./Button";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children}</a>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...props }: Record<string, unknown>) => (
      <button {...props}>{children}</button>
    ),
    a: ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children}</a>,
    create:
      () =>
      ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children}</a>,
  },
}));

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

  it('renders as link when href="/contact" provided', () => {
    render(<Button href="/contact">Contact</Button>);
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
