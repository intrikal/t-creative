/**
 * Component tests for BookingRequestDialog — the multi-step booking wizard.
 *
 * Tests the step-by-step flow: loading availability → pick date → pick time
 * → confirm request. Uses a mocked Calendar component for deterministic
 * date selection.
 *
 * Related files:
 *   - components/booking/BookingRequestDialog.tsx — the component under test
 *   - app/dashboard/book/actions.ts — getStudioAvailability, checkIsAuthenticated
 *   - app/dashboard/messages/actions.ts — createBookingRequest
 */

// render: mounts a React component into a virtual DOM for testing
// screen: queries to find elements in rendered output (getByText, getByTestId, etc.)
// fireEvent: simulates user interactions (click, change, etc.)
// waitFor: retries assertions until they pass (for async rendering)
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingRequestDialog } from "./BookingRequestDialog";
import type { Service } from "./types";

/* ------------------------------------------------------------------ */
/*  Module mocks                                                        */
/* ------------------------------------------------------------------ */

// vi.mock("@/app/dashboard/book/actions"): replaces the booking actions so
// tests get deterministic studio hours (Mon-Fri 9-5, weekends closed) and
// always-authenticated state without hitting real APIs
vi.mock("@/app/dashboard/book/actions", () => ({
  getStudioAvailability: vi.fn().mockResolvedValue({
    hours: [
      { dayOfWeek: 1, isOpen: true, opensAt: "09:00", closesAt: "17:00" },
      { dayOfWeek: 2, isOpen: true, opensAt: "09:00", closesAt: "17:00" },
      { dayOfWeek: 3, isOpen: true, opensAt: "09:00", closesAt: "17:00" },
      { dayOfWeek: 4, isOpen: true, opensAt: "09:00", closesAt: "17:00" },
      { dayOfWeek: 5, isOpen: true, opensAt: "09:00", closesAt: "17:00" },
      { dayOfWeek: 6, isOpen: false, opensAt: null, closesAt: null },
      { dayOfWeek: 7, isOpen: false, opensAt: null, closesAt: null },
    ],
    timeOff: [],
    lunchBreak: null,
  }),
  checkIsAuthenticated: vi.fn().mockResolvedValue(true),
}));

// vi.mock("@/app/dashboard/messages/actions"): replaces the booking request
// creation so no real messages are sent — returns a fake booking ID
vi.mock("@/app/dashboard/messages/actions", () => ({
  createBookingRequest: vi.fn().mockResolvedValue({ id: 1 }),
}));

// vi.mock("@/components/ui/calendar"): replaces the real calendar with a
// minimal stub that exposes a "Pick Monday Jan 7" button. This makes date
// selection deterministic — no need to navigate a real date picker.
const MOCK_MONDAY = new Date(2030, 0, 7); // Monday January 7, 2030

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
  }: {
    onSelect: (date: Date | undefined) => void;
    [k: string]: unknown;
  }) => (
    <div data-testid="mock-calendar">
      <button data-testid="pick-monday" onClick={() => onSelect(MOCK_MONDAY)}>
        Pick Monday Jan 7
      </button>
    </div>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Test fixture                                                        */
/* ------------------------------------------------------------------ */

// Mock data: a lash extension service at $120 with a $30 deposit and
// 90-minute duration — represents a typical bookable service
const mockService: Service = {
  id: 1,
  category: "lash",
  name: "Lash Extension",
  priceInCents: 12000,
  depositInCents: 3000,
  durationMinutes: 90,
  description: "Full set lash extension service",
};

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

// Tests the BookingRequestDialog multi-step wizard: open/close behavior,
// loading state, date selection → time slot display → confirmation step,
// back navigation between steps, and close button handler
describe("BookingRequestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <BookingRequestDialog service={mockService} open={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows service name in dialog header when open", async () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Lash Extension")).toBeInTheDocument();
  });

  it("shows loading state initially before availability loads", () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Loading availability...")).toBeInTheDocument();
  });

  it("shows Pick a date step after availability loads", async () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Pick a date")).toBeInTheDocument();
    });
  });

  it("renders the calendar component after availability loads", async () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-calendar")).toBeInTheDocument();
    });
  });

  it("advances to time step after selecting a date", async () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByTestId("pick-monday"));

    fireEvent.click(screen.getByTestId("pick-monday"));

    expect(screen.getByText("Pick a time")).toBeInTheDocument();
  });

  it("shows time slots for the selected date", async () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByTestId("pick-monday"));

    fireEvent.click(screen.getByTestId("pick-monday"));

    // Monday Jan 7, 2030 is open 09:00–17:00, so 9:00am slot should appear
    await waitFor(() => {
      expect(screen.getByText("9:00am")).toBeInTheDocument();
    });
  });

  it("shows multiple time slots", async () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByTestId("pick-monday"));

    fireEvent.click(screen.getByTestId("pick-monday"));

    await waitFor(() => {
      // 09:00–17:00 with 30-min slots → 16 slots
      expect(screen.getByText("9:00am")).toBeInTheDocument();
      expect(screen.getByText("9:30am")).toBeInTheDocument();
      expect(screen.getByText("4:30pm")).toBeInTheDocument();
    });
  });

  it("shows selected date label in the time step", async () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByTestId("pick-monday"));

    fireEvent.click(screen.getByTestId("pick-monday"));

    await waitFor(() => {
      // The date label shows fmtDateLabel of Jan 7, 2030: "Tue, Jan 7" … but Jan 7 2030 is Monday
      expect(screen.getByText(/Jan 7/)).toBeInTheDocument();
    });
  });

  it("back button from time step returns to date step", async () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByTestId("pick-monday"));

    fireEvent.click(screen.getByTestId("pick-monday"));
    await waitFor(() => screen.getByText("Pick a time"));

    // The back button (ChevronLeft) is a sibling of the div containing "Pick a time",
    // both inside a flex container — go up to the flex wrapper to find the button.
    const backBtn = screen
      .getByText("Pick a time")
      .closest("div")!
      .parentElement!.querySelector("button")!;
    fireEvent.click(backBtn);

    expect(screen.getByText("Pick a date")).toBeInTheDocument();
    expect(screen.getByTestId("mock-calendar")).toBeInTheDocument();
  });

  it("advances to confirm step after selecting a time", async () => {
    render(<BookingRequestDialog service={mockService} open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByTestId("pick-monday"));

    fireEvent.click(screen.getByTestId("pick-monday"));
    await waitFor(() => screen.getByText("9:00am"));

    fireEvent.click(screen.getByText("9:00am"));

    await waitFor(() => {
      expect(screen.getByText("Confirm your request")).toBeInTheDocument();
    });
  });

  it("close button calls onClose handler", async () => {
    const onClose = vi.fn();
    render(<BookingRequestDialog service={mockService} open={true} onClose={onClose} />);

    // The X close button in the header
    const closeBtn = screen.getByRole("button", { name: "" }); // icon-only button
    // Find it by querying for the button next to the service heading
    const header = screen.getByText("Lash Extension").closest("div[class*='flex']")!;
    const xBtn = header.parentElement!.querySelector(
      'button[class*="hover:bg-stone"]',
    ) as HTMLButtonElement;
    fireEvent.click(xBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
