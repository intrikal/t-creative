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
