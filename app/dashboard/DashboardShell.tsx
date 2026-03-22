"use client";

import { type ReactNode, useState, useCallback, useEffect } from "react";
import { SidebarContext } from "./sidebar-context";
import { LocationContext } from "./location-context";
import type { LocationRow } from "./location-actions";

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

  // Location state — default to first location, persist selection in localStorage
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(() => {
    // SSR-safe: default to first location
    return initialLocations[0]?.id ?? null;
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      // Validate that the stored location still exists
      if (initialLocations.some((l) => l.id === parsed)) {
        setSelectedLocationId(parsed);
      }
    }
  }, [initialLocations]);

  const setLocationId = useCallback(
    (id: number | null) => {
      setSelectedLocationId(id);
      if (id !== null) {
        localStorage.setItem(LOCATION_STORAGE_KEY, String(id));
      } else {
        localStorage.removeItem(LOCATION_STORAGE_KEY);
      }
    },
    [],
  );

  return (
    <SidebarContext.Provider value={{ expanded, toggle, drawerOpen, openDrawer, closeDrawer }}>
      <LocationContext.Provider
        value={{
          locations: initialLocations,
          selectedLocationId,
          setLocationId,
        }}
      >
        <div className="flex h-screen overflow-hidden bg-background">
          {children}
        </div>
      </LocationContext.Provider>
    </SidebarContext.Provider>
  );
}
