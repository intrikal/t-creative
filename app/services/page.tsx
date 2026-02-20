/**
 * Services — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { ServicesPage } from "./ServicesPage";

export const metadata: Metadata = {
  title: "Services | Lash Extensions, Permanent Jewelry & More | T Creative Studio",
  description:
    "Handcrafted services in San Jose. Lash extensions starting at $150, permanent jewelry starting at $65, custom crochet commissions, and business consulting.",
  alternates: {
    canonical: "/services",
  },
  openGraph: {
    title: "Services | Lash Extensions, Permanent Jewelry & More | T Creative Studio",
    description:
      "Handcrafted services in San Jose. Lash extensions starting at $150, permanent jewelry starting at $65, custom crochet commissions, and business consulting.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Services | Lash Extensions, Permanent Jewelry & More | T Creative Studio",
    description:
      "Handcrafted services in San Jose. Lash extensions starting at $150, permanent jewelry starting at $65, custom crochet commissions, and business consulting.",
  },
};

export default function Page() {
  return <ServicesPage />;
}
