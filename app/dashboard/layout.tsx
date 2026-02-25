import type { ReactNode } from "react";
import { redirect } from "next/navigation";
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar role={role} />
      <main
        id="main-content"
        className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:pl-56 pb-16 lg:pb-0"
      >
        {children}
      </main>
    </div>
  );
}
