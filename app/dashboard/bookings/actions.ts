// This file is intentionally thin. The implementation has been split into
// focused modules under actions/. Re-export everything so any existing
// import that resolves to this file continues to work unchanged.
export {
  hasOverlappingBooking,
  hasApprovedTimeOffConflict,
  getBookings,
  getBookingById,
  bookingInputSchema,
  updateBookingInputSchema,
  createBooking,
  updateBooking,
  deleteBooking,
  getAssistantBookings,
  tryCreateSquareOrder,
  tryAutoSendDepositLink,
  tryFireInternalNotification,
  tryCreditReferrer,
  trySendBookingConfirmation,
  trySendBookingStatusEmail,
  trySendBookingReschedule,
} from "./actions/booking-crud";
export type { BookingRow } from "./actions/booking-crud";
export { updateBookingStatus } from "./actions/status-transitions";
export {
  createRecurringBooking,
  generateNextRecurringBooking,
  cancelBookingSeries,
} from "./actions/recurring";
export type { RecurringBookingResult } from "./actions/recurring";
export {
  getWaitlist,
  addToWaitlist,
  updateWaitlistStatus,
  removeFromWaitlistById,
} from "./actions/waitlist";
export type { WaitlistRow, WaitlistInput } from "./actions/waitlist";
