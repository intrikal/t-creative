import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAdminSetupData } from "./admin-setup-data";
import { AdminBottomSection } from "./sections/AdminBottomSection";
import { AdminHeaderSection } from "./sections/AdminHeaderSection";
import { AdminInquiriesSection } from "./sections/AdminInquiriesSection";
import { AdminRevenueChartSection } from "./sections/AdminRevenueChartSection";
import { AdminScheduleSection } from "./sections/AdminScheduleSection";
import {
  StatsSkeletonFallback,
  ScheduleInquiriesSkeletonFallback,
  RevenueChartSkeletonFallback,
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

      {/* Setup banner — streams quickly (cached setup data) */}
      <Suspense fallback={null}>
        <AdminSetupSection />
      </Suspense>

      {/* Stats + alerts — streams as aggregate queries resolve */}
      <Suspense fallback={<StatsSkeletonFallback />}>
        <AdminStatsSection />
      </Suspense>

      {/* Schedule + Inquiries — stream independently */}
      <Suspense fallback={<ScheduleInquiriesSkeletonFallback />}>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
          <Suspense fallback={null}>
            <AdminScheduleSection />
          </Suspense>
          <Suspense fallback={null}>
            <AdminInquiriesSection />
          </Suspense>
        </div>
      </Suspense>

      {/* Time-off approval queue — streams alongside revenue chart */}
      <Suspense fallback={null}>
        <AdminTimeOffSection />
      </Suspense>

      {/* Revenue chart — streams as payment queries resolve */}
      <Suspense fallback={<RevenueChartSkeletonFallback />}>
        <AdminRevenueChartSection />
      </Suspense>

      {/* Team + Recent clients — streams last */}
      <Suspense fallback={<BottomSkeletonFallback />}>
        <AdminBottomSection />
      </Suspense>
    </div>
  );
}
