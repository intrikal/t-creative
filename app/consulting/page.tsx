/**
 * Consulting — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { ConsultingPage } from "./ConsultingPage";

export const metadata: Metadata = {
  title: "HR & Business Consulting | Remote Consulting | T Creative Studio",
  description:
    "Strategic HR and business consulting for entrepreneurs and growing companies. Remote consulting available. Build better teams and scale your business.",
  alternates: {
    canonical: "/consulting",
  },
  openGraph: {
    title: "HR & Business Consulting | Remote Consulting | T Creative Studio",
    description:
      "Strategic HR and business consulting for entrepreneurs and growing companies. Remote consulting available. Build better teams and scale your business.",
  },
  twitter: {
    card: "summary_large_image",
    title: "HR & Business Consulting | Remote Consulting | T Creative Studio",
    description:
      "Strategic HR and business consulting for entrepreneurs and growing companies. Remote consulting available. Build better teams and scale your business.",
  },
};

export default function Page() {
  return <ConsultingPage />;
}
