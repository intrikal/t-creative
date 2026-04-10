// Waitlist management lives in waitlist-actions.ts alongside the bookings page.
// Re-export everything here so callers can import from the actions/ barrel.
export {
  getWaitlist,
  addToWaitlist,
  updateWaitlistStatus,
  removeFromWaitlistById,
} from "../waitlist-actions";
export type { WaitlistRow, WaitlistInput } from "../waitlist-actions";
