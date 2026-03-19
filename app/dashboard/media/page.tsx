/**
 * Media dashboard route — `/dashboard/media`.
 *
 * Server Component that fetches media items and stats, then passes
 * them to the `<MediaPage>` Client Component.
 *
 * @module media/page
 * @see {@link ./actions.ts} — server actions
 * @see {@link ./MediaPage.tsx} — client component
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getMediaItems, getMediaStats } from "./actions";
import { MediaPage } from "./MediaPage";

export const metadata: Metadata = {
  title: "Media — T Creative Studio",
  description: "Manage studio media files, photos, and videos.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role === "client") redirect("/dashboard");

  const [items, stats] = await Promise.all([getMediaItems(), getMediaStats()]);

  return <MediaPage initialItems={items} stats={stats} />;
}
