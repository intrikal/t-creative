"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Renders its children only when NOT on a dashboard route.
 * Keeps the Navbar out of the admin shell without restructuring route groups.
 */
export function ConditionalNavbar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard")) return null;
  return <>{children}</>;
}
