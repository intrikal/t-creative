import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAdminSetupData } from "./admin-setup-data";
import { AdminBottomSection } from "./sections/AdminBottomSection";
import { AdminCronHealthSection } from "./sections/AdminCronHealthSection";
import { AdminHeaderSection } from "./sections/AdminHeaderSection";
import { AdminInquiriesSection } from "./sections/AdminInquiriesSection";
import { AdminRevenueChartSection } from "./sections/AdminRevenueChartSection";
import { AdminScheduleSection } from "./sections/AdminScheduleSection";
import {
  StatsSkeletonFallback,
  ScheduleInquiriesSkeletonFallback,
  BottomSkeletonFallback,
} from "./sections/AdminSectionSkeletons";
import { AdminSetupSection } from "./sections/AdminSetupSection";
import { AdminStatsSection } from "./sections/AdminStatsSection";
import { AdminTimeOffSection } from "./sections/AdminTimeOffSection";

export const metadata: Metadata = {
  title: "Dashboard — T Creative Studio",
  description: "Admin overview for T Creative Studio.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  // ── Client home ────────────────────────────────────────────────────
  if (currentUser.profile?.role === "client") {
    const [{ getClientHomeData }, { ClientHomePage }] = await Promise.all([
      import("./client-home-actions"),
      import("./ClientHomePage"),
    ]);
    const data = await getClientHomeData();
    return <ClientHomePage {...data} />;
  }

  // ── Assistant home ─────────────────────────────────────────────────
  if (currentUser.profile?.role === "assistant") {
    const [{ getAssistantHomeData }, { AssistantHomePage }] = await Promise.all([
      import("./assistant-home-actions"),
      import("./AssistantHomePage"),
    ]);
    const data = await getAssistantHomeData();
    return <AssistantHomePage {...data} />;
  }

  // ── Admin home — Suspense streaming ───────────────────────────────
  // Header data is fast (cached getCurrentUser + getAdminSetupData).
  // Each data section streams independently as its queries resolve.
  const setupData = await getAdminSetupData(currentUser.id);

  function toSlug(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, "") || "tcreativestudio";
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Static — renders instantly */}
      <AdminHeaderSection
        firstName={setupData.firstName || currentUser.profile?.firstName || "Trini"}
        bookingSlug={toSlug(setupData.studioName ?? "")}
      />

      {/* Setup banner + Stats + alerts (1 boundary — fast cached data + aggregate queries) */}
      <Suspense fallback={<StatsSkeletonFallback />}>
        <AdminSetupSection />
        <AdminStatsSection />
      </Suspense>

      {/* Schedule, Inquiries, Time-off, Revenue (1 boundary — mid-page data) */}
      <Suspense fallback={<ScheduleInquiriesSkeletonFallback />}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
            <AdminScheduleSection />
            <AdminInquiriesSection />
          </div>
          <AdminTimeOffSection />
          <AdminRevenueChartSection />
        </div>
      </Suspense>

      {/* Cron health + Team + Recent clients (1 boundary — bottom) */}
      <Suspense fallback={<BottomSkeletonFallback />}>
        <div className="space-y-4">
          <AdminCronHealthSection />
          <AdminBottomSection />
        </div>
      </Suspense>
    </div>
  );
}
