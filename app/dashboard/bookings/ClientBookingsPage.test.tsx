// render: mounts a React component into a virtual DOM for testing
// screen: provides queries to find elements in the rendered output
// fireEvent: simulates user interactions (click, type, etc.) on DOM elements
// act: wraps state updates so React processes them before assertions
import { render, screen, fireEvent, act } from "@testing-library/react";
// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClientBookingRow, ClientBookingsData } from "./client-actions";
import { ClientBookingsPage } from "./ClientBookingsPage";

// vi.mock() replaces the client-actions module so tests never call
// real server actions (which would hit the DB and auth layer).
// All three actions resolve immediately with no side effects.
vi.mock("./client-actions", () => ({
  submitClientReview: vi.fn().mockResolvedValue(undefined),
  cancelClientBooking: vi.fn().mockResolvedValue(undefined),
  rescheduleClientBooking: vi.fn().mockResolvedValue(undefined),
}));

/* ------------------------------------------------------------------ */
/*  Test fixtures                                                       */
/* ------------------------------------------------------------------ */

// Generates ISO date strings relative to "now" so booking status logic
// (upcoming vs past) works regardless of when tests run.
function futureISO(hoursFromNow = 48): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function makeDateISO(iso: string): string {
  return iso.split("T")[0];
}

// Use 96 h so the booking is comfortably inside the 48 h cancellable window —
// using exactly 48 h causes flakiness because a few ms of test execution can
// push hoursUntil just below the cancelWindowHours threshold.
const FUTURE_ISO = futureISO(96);
const FUTURE_DATE_ISO = makeDateISO(FUTURE_ISO);

// Mock data: a confirmed future booking used to test upcoming-booking UI
// (cancel button, reschedule button, status badge)
const confirmedBooking: ClientBookingRow = {
  id: 1,
  dateISO: FUTURE_DATE_ISO,
  startsAtISO: FUTURE_ISO,
  date: "Mon, Mar 16",
  time: "10:00 AM",
  service: "Lash Extension",
  category: "lash",
  assistant: "Taylor",
  durationMin: 90,
  price: 150,
  status: "confirmed",
  notes: null,
  location: null,
  addOns: [],
  reviewLeft: false,
  depositPaid: false,
};

// Mock data: a completed past booking used to test review flow and stats
const completedBooking: ClientBookingRow = {
  id: 2,
  dateISO: "2024-01-10",
  startsAtISO: "2024-01-10T10:00:00.000Z",
  date: "Wed, Jan 10",
  time: "10:00 AM",
  service: "Jewelry Consultation",
  category: "jewelry",
  assistant: "Jordan",
  durationMin: 60,
  price: 80,
  status: "completed",
  notes: null,
  location: null,
  addOns: [],
  reviewLeft: false,
  depositPaid: false,
};

// Mock data: a cancelled booking used to verify cancelled badge and exclusion from stats
const cancelledBooking: ClientBookingRow = {
  id: 3,
  dateISO: "2024-02-05",
  startsAtISO: "2024-02-05T14:00:00.000Z",
  date: "Mon, Feb 5",
  time: "2:00 PM",
  service: "Crochet Braids",
  category: "crochet",
  assistant: "Morgan",
  durationMin: 120,
  price: 200,
  status: "cancelled",
  notes: null,
  location: null,
  addOns: [],
  reviewLeft: false,
  depositPaid: false,
};

function makeData(bookings: ClientBookingRow[]): ClientBookingsData {
  return {
    bookings,
    calendarUrl: "https://example.com/calendar.ics",
    policy: { cancelWindowHours: 48, lateCancelFeePercent: 50 },
  };
}

// Tests the client-facing bookings page: rendering, stats cards, status badges,
// card expand/collapse, cancel/reschedule/review modals, and calendar subscribe.
describe("ClientBookingsPage", () => {
  // Reset all mock call counts between tests to prevent cross-contamination
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading", () => {
    render(<ClientBookingsPage data={makeData([])} />);
    expect(screen.getByText("My Bookings")).toBeInTheDocument();
  });

  it("shows empty state when there are no bookings", () => {
    render(<ClientBookingsPage data={makeData([])} />);
    expect(screen.getByText("No bookings yet.")).toBeInTheDocument();
  });

  describe("stats cards", () => {
    it("shows Total Visits count", () => {
      render(<ClientBookingsPage data={makeData([completedBooking])} />);
      expect(screen.getByText("Total Visits")).toBeInTheDocument();
    });

    it("shows Upcoming count", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      // "Upcoming" appears in the stat card and in the section header
      expect(screen.getAllByText("Upcoming")[0]).toBeInTheDocument();
    });

    it("shows Total Spent", () => {
      render(<ClientBookingsPage data={makeData([completedBooking])} />);
      expect(screen.getByText("Total Spent")).toBeInTheDocument();
    });

    it("counts completed bookings in Total Visits", () => {
      render(<ClientBookingsPage data={makeData([completedBooking, cancelledBooking])} />);
      // 1 completed booking
      const card = screen.getByText("Total Visits").closest("[data-slot='card-content']")!;
      expect(card.textContent).toContain("1");
    });
  });

  describe("status badges", () => {
    it("shows Confirmed badge for confirmed bookings", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      expect(screen.getByText("Confirmed")).toBeInTheDocument();
    });

    it("shows Cancelled badge for cancelled bookings", () => {
      render(<ClientBookingsPage data={makeData([cancelledBooking])} />);
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });

    it("shows Completed badge for completed bookings", () => {
      render(<ClientBookingsPage data={makeData([completedBooking])} />);
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });

  describe("booking card expansion", () => {
    it("expands booking card to show details on click", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      expect(screen.getByText("Assistant")).toBeInTheDocument();
      expect(screen.getByText("Taylor")).toBeInTheDocument();
    });

    it("collapses expanded card on second click", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      // First click expands the card
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      expect(screen.getByText("Taylor")).toBeInTheDocument();
      // Re-query trigger — BookingCard is an inner component, so the DOM node
      // may be replaced after the parent re-renders. "Lash Extension" now
      // appears twice (trigger + expanded details); [0] is inside the trigger button.
      fireEvent.click(screen.getAllByText("Lash Extension")[0].closest("button")!);
      expect(screen.queryByText("Taylor")).not.toBeInTheDocument();
    });
  });

  describe("cancel action", () => {
    it("shows cancel button for cancellable upcoming bookings", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      expect(screen.getByText("Cancel appointment")).toBeInTheDocument();
    });

    it("opens cancel modal when cancel button is clicked", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      fireEvent.click(screen.getByText("Cancel appointment"));
      expect(screen.getByText("Cancel Booking")).toBeInTheDocument();
      expect(
        screen.getByText("Are you sure you want to cancel this appointment?"),
      ).toBeInTheDocument();
    });

    it("closes cancel modal when Keep Booking is clicked", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      fireEvent.click(screen.getByText("Cancel appointment"));
      fireEvent.click(screen.getByText("Keep Booking"));
      expect(screen.queryByText("Cancel Booking")).not.toBeInTheDocument();
    });

    it("shows deposit warning when booking has deposit paid", () => {
      const withDeposit = { ...confirmedBooking, depositPaid: true };
      render(<ClientBookingsPage data={makeData([withDeposit])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      fireEvent.click(screen.getByText("Cancel appointment"));
      expect(screen.getByText(/deposit was collected/)).toBeInTheDocument();
    });

    it("confirms cancellation and closes modal", async () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      fireEvent.click(screen.getByText("Cancel appointment"));
      await act(async () => {
        fireEvent.click(screen.getByText("Cancel Appointment"));
      });
      expect(screen.queryByText("Cancel Booking")).not.toBeInTheDocument();
    });
  });

  describe("reschedule action", () => {
    it("shows reschedule button for cancellable upcoming bookings", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      expect(screen.getByText("Reschedule")).toBeInTheDocument();
    });

    it("opens reschedule modal when reschedule button is clicked", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      fireEvent.click(screen.getByText("Reschedule"));
      expect(screen.getByText("Reschedule Appointment")).toBeInTheDocument();
      expect(screen.getByText(/currently/)).toBeInTheDocument();
    });

    it("Reschedule button disabled when no date-time selected", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      fireEvent.click(screen.getByText("Reschedule"));
      const rescheduleBtn = screen
        .getAllByText("Reschedule")
        .find((el) => el.closest("button")?.className.includes("bg-accent"));
      expect(rescheduleBtn?.closest("button")).toBeDisabled();
    });

    it("closes reschedule modal when Keep Current is clicked", () => {
      render(<ClientBookingsPage data={makeData([confirmedBooking])} />);
      fireEvent.click(screen.getByText("Lash Extension").closest("button")!);
      fireEvent.click(screen.getByText("Reschedule"));
      fireEvent.click(screen.getByText("Keep Current"));
      expect(screen.queryByText("Reschedule Appointment")).not.toBeInTheDocument();
    });
  });

  describe("review action", () => {
    it("shows Leave a review button for completed bookings", () => {
      render(<ClientBookingsPage data={makeData([completedBooking])} />);
      fireEvent.click(screen.getByText("Jewelry Consultation").closest("button")!);
      expect(screen.getByText("Leave a review")).toBeInTheDocument();
    });

    it("opens review modal when Leave a review is clicked", () => {
      render(<ClientBookingsPage data={makeData([completedBooking])} />);
      fireEvent.click(screen.getByText("Jewelry Consultation").closest("button")!);
      fireEvent.click(screen.getByText("Leave a review"));
      expect(screen.getByText("Leave a Review")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Share your experience...")).toBeInTheDocument();
    });

    it("closes review modal when Cancel is clicked", () => {
      render(<ClientBookingsPage data={makeData([completedBooking])} />);
      fireEvent.click(screen.getByText("Jewelry Consultation").closest("button")!);
      fireEvent.click(screen.getByText("Leave a review"));
      // The modal has a "Cancel" button in the footer
      const cancelBtn = screen.getAllByText("Cancel").find((el) => el.closest("button") !== null);
      fireEvent.click(cancelBtn!.closest("button")!);
      expect(screen.queryByText("Leave a Review")).not.toBeInTheDocument();
    });

    it("shows review submitted message after review is already left", () => {
      const reviewed = { ...completedBooking, reviewLeft: true };
      render(<ClientBookingsPage data={makeData([reviewed])} />);
      fireEvent.click(screen.getByText("Jewelry Consultation").closest("button")!);
      expect(screen.getByText("Review submitted — thank you!")).toBeInTheDocument();
    });
  });

  describe("calendar subscribe modal", () => {
    it("opens calendar subscribe modal when Subscribe button is clicked", () => {
      render(<ClientBookingsPage data={makeData([])} />);
      fireEvent.click(screen.getByText("Subscribe").closest("button")!);
      expect(screen.getByText("Subscribe to My Bookings")).toBeInTheDocument();
    });

    it("displays the calendar URL in the subscribe modal", () => {
      render(<ClientBookingsPage data={makeData([])} />);
      fireEvent.click(screen.getByText("Subscribe").closest("button")!);
      expect(screen.getByDisplayValue("https://example.com/calendar.ics")).toBeInTheDocument();
    });
  });
});
