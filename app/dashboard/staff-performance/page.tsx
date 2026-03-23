import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import type { Range } from "@/lib/types/analytics.types";
import { getStaffPerformanceData } from "./actions";
import { StaffPerformancePage } from "./StaffPerformancePage";

export const metadata: Metadata = {
  title: "Staff Performance — T Creative Studio",
  description: "View staff KPIs, retention, and commission breakdown.",
  robots: { index: false, follow: false },
};

const VALID_RANGES: Range[] = ["7d", "30d", "90d", "12m"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  const { range: rawRange } = await searchParams;
  const range: Range = VALID_RANGES.includes(rawRange as Range) ? (rawRange as Range) : "30d";

  const data = await getStaffPerformanceData(range);

  return <StaffPerformancePage data={data} />;
}
