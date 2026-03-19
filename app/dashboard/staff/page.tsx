import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { StaffPage } from "./StaffPage";

export const metadata: Metadata = {
  title: "Staff — T Creative Studio",
  description: "Manage assistants and shift schedules.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  return <StaffPage />;
}
