import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardSidebar } from "./DashboardSidebar";

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/components/TCLogo", () => ({
  TCLogo: () => <svg data-testid="tc-logo" />,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("./components/NotificationBell", () => ({
  NotificationBell: () => null,
}));

const baseProps = { userName: "Alex Studio", userAvatarUrl: null };

describe("DashboardSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("admin role", () => {
    it("renders Financial nav link", () => {
      render(<DashboardSidebar role="admin" {...baseProps} />);
      expect(screen.getAllByText("Financial")[0]).toBeInTheDocument();
    });

    it("renders Analytics nav link", () => {
      render(<DashboardSidebar role="admin" {...baseProps} />);
      expect(screen.getAllByText("Analytics")[0]).toBeInTheDocument();
    });

    it("renders Clients nav link", () => {
      render(<DashboardSidebar role="admin" {...baseProps} />);
      expect(screen.getAllByText("Clients")[0]).toBeInTheDocument();
    });

    it("renders Assistants nav link", () => {
      render(<DashboardSidebar role="admin" {...baseProps} />);
      expect(screen.getAllByText("Assistants")[0]).toBeInTheDocument();
    });
  });

  describe("client role", () => {
    it("does not render Financial link", () => {
      render(<DashboardSidebar role="client" {...baseProps} />);
      expect(screen.queryByText("Financial")).not.toBeInTheDocument();
    });

    it("renders My Bookings link", () => {
      render(<DashboardSidebar role="client" {...baseProps} />);
      expect(screen.getAllByText("My Bookings")[0]).toBeInTheDocument();
    });

    it("renders Book a Service link", () => {
      render(<DashboardSidebar role="client" {...baseProps} />);
      expect(screen.getAllByText("Book a Service")[0]).toBeInTheDocument();
    });

    it("does not render Assistants link", () => {
      render(<DashboardSidebar role="client" {...baseProps} />);
      expect(screen.queryByText("Assistants")).not.toBeInTheDocument();
    });
  });

  describe("assistant role", () => {
    it("does not render Financial link", () => {
      render(<DashboardSidebar role="assistant" {...baseProps} />);
      expect(screen.queryByText("Financial")).not.toBeInTheDocument();
    });

    it("renders Earnings link", () => {
      render(<DashboardSidebar role="assistant" {...baseProps} />);
      expect(screen.getAllByText("Earnings")[0]).toBeInTheDocument();
    });

    it("renders Schedule link", () => {
      render(<DashboardSidebar role="assistant" {...baseProps} />);
      expect(screen.getAllByText("Schedule")[0]).toBeInTheDocument();
    });
  });

  it("displays user name in profile trigger", () => {
    render(<DashboardSidebar role="client" {...baseProps} />);
    expect(screen.getAllByText("Alex Studio")[0]).toBeInTheDocument();
  });

  it("opens mobile drawer when Menu button is clicked", () => {
    const { container } = render(<DashboardSidebar role="admin" {...baseProps} />);
    const drawerAside = container.querySelector("aside.lg\\:hidden") as HTMLElement;
    expect(drawerAside.className).toContain("-translate-x-full");

    fireEvent.click(screen.getByText("Menu").closest("button")!);

    expect(drawerAside.className).toContain("translate-x-0");
  });

  it("profile menu shows Profile & Settings after clicking profile trigger", () => {
    render(<DashboardSidebar role="admin" {...baseProps} />);
    const profileTrigger = screen.getAllByText("Alex Studio")[0].closest("button")!;
    fireEvent.click(profileTrigger);
    expect(screen.getAllByText("Profile & Settings")[0]).toBeInTheDocument();
  });

  it("admin profile menu includes Team link", () => {
    render(<DashboardSidebar role="admin" {...baseProps} />);
    const profileTrigger = screen.getAllByText("Alex Studio")[0].closest("button")!;
    fireEvent.click(profileTrigger);
    expect(screen.getAllByText("Team")[0]).toBeInTheDocument();
  });

  it("client profile menu does not include Team link", () => {
    render(<DashboardSidebar role="client" {...baseProps} />);
    const profileTrigger = screen.getAllByText("Alex Studio")[0].closest("button")!;
    fireEvent.click(profileTrigger);
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
  });
});
