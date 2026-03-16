/**
 * Corporate Events — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { CorporateInquiryForm } from "./CorporateInquiryForm";

export const metadata: Metadata = {
  title: "Corporate Events | T Creative Studio",
  description:
    "Elevate your next team event with T Creative Studio. We bring permanent jewelry and lash services directly to your corporate office or offsite — perfect for team bonding, celebrations, and company milestones.",
  alternates: {
    canonical: "/events/corporate",
  },
  openGraph: {
    title: "Corporate Events | T Creative Studio",
    description:
      "Elevate your next team event with T Creative Studio. We bring permanent jewelry and lash services directly to your corporate office or offsite.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Corporate Events | T Creative Studio",
    description:
      "Elevate your next team event with T Creative Studio. We bring permanent jewelry and lash services directly to your corporate office or offsite.",
  },
};

export default function Page() {
  return <CorporateInquiryForm />;
}
