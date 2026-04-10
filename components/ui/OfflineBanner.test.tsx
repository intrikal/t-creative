/**
 * Tests for the OfflineBanner component.
 *
 * Verifies offline/online states, pending mutation count display,
 * syncing/synced status messages, and dismiss behavior.
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfflineBanner } from "./OfflineBanner";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const filteredProps = Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => !["initial", "animate", "exit", "transition"].includes(key),
        ),
      );
      return <div {...filteredProps}>{children as ReactNode}</div>;
    },
  },
}));

vi.mock("lucide-react", () => ({
  X: () => <svg data-testid="x-icon" />,
}));

const mockUseOfflineQueue = vi.fn();

vi.mock("@/lib/hooks/useOfflineQueue", () => ({
  useOfflineQueue: () => mockUseOfflineQueue(),
}));

beforeEach(() => {
  mockUseOfflineQueue.mockReturnValue({
    pendingCount: 0,
    isOnline: true,
    syncStatus: "idle",
  });
});

describe("OfflineBanner", () => {
  it("does not show banner when online with no pending changes", () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows offline message when browser is offline", () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 0,
      isOnline: false,
      syncStatus: "idle",
    });
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/you\u2019re offline/i)).toBeInTheDocument();
  });

  it("shows pending count when offline with queued mutations", () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 3,
      isOnline: false,
      syncStatus: "idle",
    });
    render(<OfflineBanner />);
    expect(screen.getByText(/3 changes will sync when you reconnect/)).toBeInTheDocument();
  });

  it("uses singular 'change' for count of 1", () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 1,
      isOnline: false,
      syncStatus: "idle",
    });
    render(<OfflineBanner />);
    expect(screen.getByText(/1 change will sync when you reconnect\./)).toBeInTheDocument();
  });

  it("shows syncing message when online and syncing", () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 3,
      isOnline: true,
      syncStatus: "syncing",
    });
    render(<OfflineBanner />);
    expect(screen.getByText(/syncing 3 changes/i)).toBeInTheDocument();
  });

  it("shows synced message with green background", () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 0,
      isOnline: true,
      syncStatus: "synced",
    });
    render(<OfflineBanner />);
    const banner = screen.getByRole("status");
    expect(screen.getByText(/all changes synced/i)).toBeInTheDocument();
    expect(banner.className).toContain("bg-green-500");
  });

  it("uses amber background when offline", () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 0,
      isOnline: false,
      syncStatus: "idle",
    });
    render(<OfflineBanner />);
    expect(screen.getByRole("status").className).toContain("bg-amber-500");
  });

  it("hides banner when dismiss button is clicked", () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 0,
      isOnline: false,
      syncStatus: "idle",
    });
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Dismiss offline banner"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
