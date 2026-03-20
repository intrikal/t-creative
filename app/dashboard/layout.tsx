import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PostHogIdentify } from "@/components/providers/PostHogIdentify";
import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "./DashboardShell";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardMain } from "./DashboardMain";
import { getAdminSetupData } from "./admin-setup-data";

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

  const setupProgress = role === "admin" ? (await getAdminSetupData(user.id)).setupProgress : undefined;

  return (
    <DashboardShell>
      <PostHogIdentify userId={user.id} email={user.email} role={role} name={userName} />
      <DashboardSidebar
        role={role}
        setupProgress={setupProgress}
      />
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
