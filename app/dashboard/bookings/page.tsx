import type { Metadata } from "next";
import { BookingsPage } from "./BookingsPage";

export const metadata: Metadata = {
  title: "Bookings — T Creative Studio",
  description: "Manage all appointments and bookings.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <BookingsPage />;
}
