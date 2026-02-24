/**
 * app/dashboard/bookings/page.tsx — Server Component for the Bookings dashboard.
 *
 * ## Responsibility
 * Fetches all data required by `BookingsPage` in a single `Promise.all` call, then
 * renders the client component. No UI logic lives here — this file is intentionally
 * thin, following the Next.js App Router "data-down" pattern.
 *
 * ## Parallel fetching
 * `Promise.all` issues all four queries concurrently, which is faster than awaiting
 * them sequentially. The total page latency is determined by the slowest query
 * (typically `getBookings` due to its three-way join), not the sum of all queries.
 *
 * ## Data passed to client
 * - `initialBookings`  — Full joined booking list, newest first.
 * - `clients`          — {id, name, phone} for the client dropdown.
 * - `serviceOptions`   — {id, name, category, durationMinutes, priceInCents} for service picker.
 * - `staffOptions`     — {id, name} for staff assignment dropdown.
 *
 * ## noindex
 * `robots: { index: false }` ensures search engines never index the admin dashboard.
 */
import type { Metadata } from "next";
import {
  getBookings,
  getClientsForSelect,
  getServicesForSelect,
  getStaffForSelect,
} from "./actions";
import { BookingsPage } from "./BookingsPage";

export const metadata: Metadata = {
  title: "Bookings — T Creative Studio",
  description: "Manage all appointments and bookings.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [initialBookings, clients, serviceOptions, staffOptions] = await Promise.all([
    getBookings(),
    getClientsForSelect(),
    getServicesForSelect(),
    getStaffForSelect(),
  ]);

  return (
    <BookingsPage
      initialBookings={initialBookings}
      clients={clients}
      serviceOptions={serviceOptions}
      staffOptions={staffOptions}
    />
  );
}
