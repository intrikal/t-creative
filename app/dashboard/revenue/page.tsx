import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import {
  getPayments,
  getRevenueStats,
  getCategoryRevenue,
  getWeeklyRevenue,
} from "@/app/dashboard/financial/actions";
import { RevenuePage } from "./RevenuePage";

export const metadata: Metadata = {
  title: "Revenue — T Creative Studio",
  description: "Revenue analytics and payment history.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  const [payments, stats, categoryRevenue, weeklyRevenue] = await Promise.all([
    getPayments(),
    getRevenueStats(),
    getCategoryRevenue(),
    getWeeklyRevenue(),
  ]);

  return (
    <RevenuePage
      payments={payments}
      stats={stats}
      categoryRevenue={categoryRevenue}
      weeklyRevenue={weeklyRevenue}
    />
  );
}
