import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

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

  // ── Admin home ─────────────────────────────────────────────────────
  const [{ getAdminHomeData }, { DashboardPage }] = await Promise.all([
    import("./admin-home-actions"),
    import("./DashboardPage"),
  ]);
  const data = await getAdminHomeData();
  return <DashboardPage {...data} />;
}
