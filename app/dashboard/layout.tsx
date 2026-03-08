import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PostHogIdentify } from "@/components/providers/PostHogIdentify";
import { getCurrentUser } from "@/lib/auth";
import { DashboardSidebar } from "./DashboardSidebar";

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <PostHogIdentify userId={user.id} email={user.email} role={role} name={userName} />
      <DashboardSidebar
        role={role}
        userName={userName}
        userAvatarUrl={user.profile?.avatarUrl ?? null}
      />
      <main
        id="main-content"
        className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:pl-56 pb-16 lg:pb-0"
      >
        {children}
      </main>
    </div>
  );
}
