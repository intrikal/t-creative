"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { DashboardTopBar } from "./DashboardTopBar";

/** Client wrapper for the main content area. Transitions padding-left
 *  when the desktop sidebar expands/collapses so the content pushes.
 *  Renders the top bar with profile dropdown above the page content. */
export function DashboardMain({
  children,
  role,
  userName,
  userAvatarUrl,
}: {
  children: ReactNode;
  role: "admin" | "assistant" | "client";
  userName: string;
  userAvatarUrl: string | null;
}) {
  const { expanded } = useSidebar();

  return (
    <main
      id="main-content"
      className={cn(
        "flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden transition-[padding-left] duration-200 ease-out",
        expanded ? "lg:pl-56" : "lg:pl-14",
      )}
    >
      <DashboardTopBar
        role={role}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </main>
  );
}
