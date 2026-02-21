import type { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar />
      {/*
       * lg:pl-56  — clears the fixed sidebar (w-60) on desktop.
       * pb-16 lg:pb-0 — clears the mobile bottom nav.
       * flex flex-col — lets full-height children (Messages, Calendar) use flex-1.
       */}
      <main
        id="main-content"
        className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:pl-56 pb-16 lg:pb-0"
      >
        {children}
      </main>
    </div>
  );
}
