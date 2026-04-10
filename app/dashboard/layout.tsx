import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CommandPalette } from "@/components/CommandPalette";
import { PostHogIdentify } from "@/components/providers/PostHogIdentify";
import { getCurrentUser } from "@/lib/auth";
import { getAdminSetupData } from "./admin-setup-data";
import { getAssistantSetupData } from "./assistant-setup-data";
import { getClientSetupData } from "./client-setup-data";
import { DashboardMain } from "./DashboardMain";
import { DashboardShell } from "./DashboardShell";
import { DashboardSidebar } from "./DashboardSidebar";
import { getActiveLocations } from "./location-actions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = (
    user.profile?.role === "assistant"
      ? "assistant"
      : user.profile?.role === "client"
        ? "client"
        : "admin"
  ) as "admin" | "assistant" | "client";

  const userName = user.profile?.firstName
    ? `${user.profile.firstName} ${user.profile.lastName ?? ""}`.trim()
    : user.profile?.displayName
      ? user.profile.displayName
      : user.email.split("@")[0];

  const [setupProgress, activeLocations] = await Promise.all([
    role === "admin"
      ? getAdminSetupData(user.id).then((d) => d.setupProgress)
      : role === "assistant"
        ? getAssistantSetupData(user.id).then((d) => d.setupProgress)
        : getClientSetupData(user.id).then((d) => d.setupProgress),
    getActiveLocations(),
  ]);

  return (
    <DashboardShell initialLocations={activeLocations}>
      <PostHogIdentify userId={user.id} email={user.email} role={role} name={userName} />
      <CommandPalette />
      <DashboardSidebar role={role} setupProgress={setupProgress} />
      <DashboardMain
        role={role}
        userName={userName}
        userAvatarUrl={user.profile?.avatarUrl ?? null}
      >
        {children}
      </DashboardMain>
    </DashboardShell>
  );
}
