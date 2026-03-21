/**
 * StudioOverlays — Studio UI overlays rendered at the page root.
 *
 * Used on the landing page at the top level. StudioNav and ZoneOverlay are fixed-positioned
 * elements that overlay the entire viewport when the studio is active. They are rendered here
 * at the page level (outside any scroll container or transform wrapper) to ensure correct
 * stacking context and fixed positioning behaviour.
 *
 * Both components self-hide internally via the Zustand studio store when mode === "landing".
 * Client Component — wraps two atelier components that consume Zustand state.
 *
 * No props — delegates all state management to child components.
 */
"use client";

import { StudioNav } from "@/components/atelier/StudioNav";
import { ZoneOverlay } from "@/components/atelier/ZoneOverlay";

export function StudioOverlays() {
  return (
    <>
      <StudioNav />
      <ZoneOverlay />
    </>
  );
}
