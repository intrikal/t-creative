import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { getStaffList } from "@/app/dashboard/assistants/actions";
import { CommissionReportPage } from "./CommissionReportPage";

export const metadata: Metadata = {
  title: "Commission Reports — T Creative Studio",
  description: "Generate exportable commission reports for staff pay periods.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  const staff = await getStaffList();

  return <CommissionReportPage staff={staff} />;
}
