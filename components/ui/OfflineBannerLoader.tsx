"use client";
/**
 * Client-side dynamic loader for OfflineBanner.
 *
 * `next/dynamic` with `ssr: false` must live in a Client Component (Next.js 16+).
 * This thin wrapper allows the Server Component layout to import it directly.
 */

import dynamic from "next/dynamic";

const OfflineBanner = dynamic(
  () => import("@/components/ui/OfflineBanner").then((m) => m.OfflineBanner),
  { ssr: false },
);

export function OfflineBannerLoader() {
  return <OfflineBanner />;
}
