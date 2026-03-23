/**
 * lib/types/booking.types.ts
 * Shared types for bookings, schedule appointments, and client booking views.
 * Sources: app/dashboard/bookings/actions.ts,
 *          app/dashboard/bookings/client-actions.ts,
 *          app/dashboard/schedule/actions.ts
 */

/* ------------------------------------------------------------------ */
/*  Booking lifecycle                                                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Multi-service bookings                                             */
/* ------------------------------------------------------------------ */

/** One service entry within a multi-service booking. */
export type BookingServiceItem = {
  serviceId: number;
  serviceName: string;
  serviceCategory: string;
  priceInCents: number;
  durationMinutes: number;
  depositInCents: number;
  orderIndex: number;
};

/** Input shape for a single service when creating/updating a multi-service booking. */
export type BookingServiceInput = {
  serviceId: number;
  priceInCents: number;
  durationMinutes: number;
  depositInCents: number;
};

/* ------------------------------------------------------------------ */
/*  Booking lifecycle                                                  */
/* ------------------------------------------------------------------ */

/** Union of valid booking lifecycle states. Mirrors bookingStatusEnum in db/schema/enums. */
export type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";

export type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

/* ------------------------------------------------------------------ */
/*  Admin bookings (BookingsPage)                                      */
/* ------------------------------------------------------------------ */

/**
 * Flat joined row returned by `getBookings`. Consumed by `BookingsPage` and
 * its sub-components (table, calendar, detail drawer).
 */
export type BookingRow = {
  id: number;
  status: string;
  startsAt: Date;
  durationMinutes: number;
  totalInCents: number;
  location: string | null;
  clientNotes: string | null;
  clientId: string;
  clientFirstName: string;
  clientLastName: string | null;
  clientPhone: string | null;
  serviceId: number;
  serviceName: string;
  serviceCategory: string;
  staffId: string | null;
  staffFirstName: string | null;
  recurrenceRule: string | null;
  parentBookingId: number | null;
  tosAcceptedAt: Date | null;
  tosVersion: string | null;
  locationId: number | null;
  /** Itemized services for multi-service bookings. Empty array for legacy single-service. */
  services: BookingServiceItem[];
};

/** Input shape for `createBooking` / `updateBooking`. */
export type BookingInput = {
  clientId: string;
  /** Primary service (backward compat). Must equal services[0].serviceId when services is provided. */
  serviceId: number;
  staffId: string | null;
  startsAt: Date;
  /** Total combined duration across all services. */
  durationMinutes: number;
  /** Total combined price across all services. */
  totalInCents: number;
  location?: string;
  locationId?: number;
  clientNotes?: string;
  recurrenceRule?: string;
  subscriptionId?: number;
  /** Multi-service items. When omitted, a single-service booking is assumed. */
  services?: BookingServiceInput[];
};

export type PaginatedBookings = {
  rows: BookingRow[];
  hasMore: boolean;
};

export type CancellationRefundResult = {
  decision: "full_refund" | "partial_refund" | "no_refund" | "no_deposit";
  refundAmountInCents: number;
  depositAmountInCents: number;
  hoursUntilAppointment: number;
};

/* ------------------------------------------------------------------ */
/*  Assistant bookings view                                            */
/* ------------------------------------------------------------------ */

/** Presentation-ready booking row for the assistant dashboard. */
export type AssistantBookingRow = {
  id: number;
  date: string;
  dayLabel: string;
  time: string;
  startTime24: string;
  endTime: string;
  service: string;
  category: string;
  client: string;
  clientInitials: string;
  clientPhone: string | null;
  status: string;
  durationMin: number;
  price: number;
  notes: string | null;
};

export type AssistantBookingStats = {
  upcomingCount: number;
  completedCount: number;
  completedRevenue: number;
};

/* ------------------------------------------------------------------ */
/*  Schedule / appointment view                                        */
/* ------------------------------------------------------------------ */

export type AppointmentRow = {
  id: number;
  date: string;
  dayLabel: string;
  time: string;
  startTime24: string;
  endTime: string;
  service: string;
  category: ServiceCategory;
  client: string;
  clientInitials: string;
  status: BookingStatus;
  durationMin: number;
  price: number;
  location?: string;
  notes?: string;
  /** Set for corporate events assigned to this assistant. */
  companyName?: string;
  /** Guest count for events assigned to this assistant. */
  guestCount?: number;
  /** Distinguishes regular bookings from assigned events. */
  kind?: "booking" | "event";
};

export type ScheduleStats = {
  todayCount: number;
  todayRevenue: number;
  weekCount: number;
  weekRevenue: number;
};

/* ------------------------------------------------------------------ */
/*  Client-facing bookings page                                        */
/* ------------------------------------------------------------------ */

export type ClientBookingRow = {
  id: number;
  dateISO: string;
  startsAtISO: string;
  date: string;
  time: string;
  service: string;
  category: "lash" | "jewelry" | "crochet" | "consulting";
  assistant: string;
  durationMin: number;
  price: number;
  status: "confirmed" | "pending" | "completed" | "cancelled";
  notes: string | null;
  location: string | null;
  addOns: { name: string; priceInCents: number }[];
  /** Itemized services for multi-service bookings. */
  services: BookingServiceItem[];
  reviewLeft: boolean;
  depositPaid: boolean;
};

export type ClientBookingsData = {
  bookings: ClientBookingRow[];
  calendarUrl: string;
  policy: {
    cancelWindowHours: number;
    lateCancelFeePercent: number;
  };
};
