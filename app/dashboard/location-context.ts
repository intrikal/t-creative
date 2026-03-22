"use client";

import { createContext, useContext } from "react";
import type { LocationRow } from "./location-actions";

export type LocationState = {
  /** All active locations available to the user. */
  locations: LocationRow[];
  /** Currently selected location ID. Null = all locations (admin only). */
  selectedLocationId: number | null;
  /** Set the selected location. Persists to localStorage. */
  setLocationId: (id: number | null) => void;
};

export const LocationContext = createContext<LocationState>({
  locations: [],
  selectedLocationId: null,
  setLocationId: () => {},
});

export function useLocation() {
  return useContext(LocationContext);
}
