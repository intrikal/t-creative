import type { Metadata } from "next";
import { StaffPage } from "./StaffPage";

export const metadata: Metadata = {
  title: "Staff — T Creative Studio",
  description: "Manage assistants and shift schedules.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <StaffPage />;
}
