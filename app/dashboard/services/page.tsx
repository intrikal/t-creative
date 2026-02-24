/**
 * app/dashboard/services/page.tsx — Server Component for the Services dashboard.
 *
 * ## Responsibility
 * Fetches the initial data for all three Services tabs in a single `Promise.all`,
 * then delegates rendering to `ServicesPage` (client component). No UI logic here.
 *
 * ## Parallel fetching
 * `getServices`, `getBundles`, and `getForms` run concurrently. Each requires auth
 * (same Supabase session check), but the queries are independent so there's no
 * benefit to sequencing them.
 *
 * ## Data passed to client
 * - `initialServices` — All services ordered by category + sort_order.
 * - `initialBundles`  — All bundles ordered by creation date.
 * - `initialForms`    — All client forms ordered by creation date.
 *
 * ## noindex
 * `robots: { index: false }` prevents admin pages from appearing in search results.
 */
import type { Metadata } from "next";
import { getServices } from "./actions";
import { getBundles } from "./bundle-actions";
import { getForms } from "./form-actions";
import { ServicesPage } from "./ServicesPage";

export const metadata: Metadata = {
  title: "Services — T Creative Studio",
  description: "Manage your service menu, bundles, and client forms.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [initialServices, initialBundles, initialForms] = await Promise.all([
    getServices(),
    getBundles(),
    getForms(),
  ]);

  return (
    <ServicesPage
      initialServices={initialServices}
      initialBundles={initialBundles}
      initialForms={initialForms}
    />
  );
}
