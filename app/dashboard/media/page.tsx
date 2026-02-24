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
import { getMediaItems, getMediaStats } from "./actions";
import { MediaPage } from "./MediaPage";

export default async function Page() {
  const [items, stats] = await Promise.all([getMediaItems(), getMediaStats()]);

  return <MediaPage initialItems={items} stats={stats} />;
}
