import type { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DashboardSidebar />
      {/*
       * pt-16  — clears the fixed marketing Navbar (h-16).
       * lg:pl-60 — clears the fixed sidebar (w-60) on desktop.
       * pb-20 lg:pb-0 — clears the mobile bottom nav (h-16 + safe area).
       */}
      <main id="main-content" className="min-h-screen pt-16 pb-20 lg:pb-0 lg:pl-60">
        {children}
      </main>
    </>
  );
}
