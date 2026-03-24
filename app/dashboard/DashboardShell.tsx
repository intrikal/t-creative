"use client";

import { type ReactNode, useState, useCallback } from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import type { LocationRow } from "./location-actions";
import { LocationContext } from "./location-context";
import { SidebarContext } from "./sidebar-context";

const LOCATION_STORAGE_KEY = "tc-selected-location";

/** Client shell that owns sidebar + drawer + location state and provides it
 *  to DashboardSidebar, DashboardMain, and DashboardTopBar via context. */
export function DashboardShell({
  children,
  initialLocations,
}: {
  children: ReactNode;
  initialLocations: LocationRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Location state — default to first location, hydrate from localStorage
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (initialLocations.some((l) => l.id === parsed)) return parsed;
      }
    }
    return initialLocations[0]?.id ?? null;
  });

  const setLocationId = useCallback((id: number | null) => {
    setSelectedLocationId(id);
    if (id !== null) {
      localStorage.setItem(LOCATION_STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    }
  }, []);

  return (
    <SidebarContext.Provider value={{ expanded, toggle, drawerOpen, openDrawer, closeDrawer }}>
      <LocationContext.Provider
        value={{
          locations: initialLocations,
          selectedLocationId,
          setLocationId,
        }}
      >
        <QueryProvider>
          <div className="flex h-screen overflow-hidden bg-background">{children}</div>
        </QueryProvider>
      </LocationContext.Provider>
    </SidebarContext.Provider>
  );
}
