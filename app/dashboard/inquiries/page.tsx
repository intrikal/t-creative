/**
 * Server component for `/dashboard/inquiries`.
 *
 * Fetches both general and product inquiries in parallel via `Promise.all`,
 * then passes the serialised rows as props to the client-side `InquiriesPage`.
 *
 * @module inquiries/page
 * @see {@link ./actions.ts} — server actions (data fetching + mutations)
 * @see {@link ./InquiriesPage.tsx} — client component rendering the UI
 */
import type { Metadata } from "next";
import { getInquiries, getProductInquiries } from "./actions";
import { InquiriesPage } from "./InquiriesPage";

export const metadata: Metadata = {
  title: "Inquiries — T Creative Studio",
  description: "Manage contact form and product inquiries.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [initialInquiries, initialProductInquiries] = await Promise.all([
    getInquiries(),
    getProductInquiries(),
  ]);

  return (
    <InquiriesPage
      initialInquiries={initialInquiries}
      initialProductInquiries={initialProductInquiries}
    />
  );
}
