import type { Metadata } from "next";
import { DashboardPage } from "./DashboardPage";

export const metadata: Metadata = {
  title: "Dashboard — T Creative Studio",
  description: "Admin overview for T Creative Studio.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DashboardPage />;
}
