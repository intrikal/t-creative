"use client";

import { type ReactNode, useState, useCallback } from "react";
import { SidebarContext } from "./sidebar-context";

/** Client shell that owns sidebar + drawer state and provides it
 *  to DashboardSidebar, DashboardMain, and DashboardTopBar via context. */
export function DashboardShell({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <SidebarContext.Provider value={{ expanded, toggle, drawerOpen, openDrawer, closeDrawer }}>
      <div className="flex h-screen overflow-hidden bg-background">
        {children}
      </div>
    </SidebarContext.Provider>
  );
}
