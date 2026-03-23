/**
 * Contact — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { getSiteData } from "@/lib/site-data";
import { ContactPage } from "./ContactPage";

export const metadata: Metadata = {
  title: "Contact | T Creative Studio",
  description:
    "Get in touch with T Creative Studio. Book an appointment, request a consultation, or ask about our services in San Jose and the Bay Area.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact | T Creative Studio",
    description:
      "Get in touch with T Creative Studio. Book an appointment, request a consultation, or ask about our services in San Jose and the Bay Area.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | T Creative Studio",
    description:
      "Get in touch with T Creative Studio. Book an appointment, request a consultation, or ask about our services in San Jose and the Bay Area.",
  },
};

export default async function Page() {
  const { business, content } = await getSiteData();
  return (
    <ContactPage
      businessName={business.businessName}
      location={business.location}
      email={business.email}
      footerTagline={content.footerTagline}
      socialLinks={content.socialLinks}
    />
  );
}
