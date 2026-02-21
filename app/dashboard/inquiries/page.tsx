import type { Metadata } from "next";
import { InquiriesPage } from "./InquiriesPage";

export const metadata: Metadata = {
  title: "Inquiries — T Creative Studio",
  description: "Manage contact form and product inquiries.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <InquiriesPage />;
}
