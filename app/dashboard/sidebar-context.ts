"use client";

import { createContext, useContext } from "react";

export type SidebarState = {
  expanded: boolean;
  toggle: () => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

export const SidebarContext = createContext<SidebarState>({
  expanded: false,
  toggle: () => {},
  drawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}
