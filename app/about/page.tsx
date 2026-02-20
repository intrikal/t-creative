/**
 * About — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { AboutPage } from "./AboutPage";

export const metadata: Metadata = {
  title: "About Trini Lam | T Creative Studio",
  description:
    "Meet Trini Lam — founder and creative director of T Creative Studio. A creative entrepreneur passionate about lash artistry, permanent jewelry, crochet, and business consulting in San Jose.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Trini Lam | T Creative Studio",
    description:
      "Meet Trini Lam — founder and creative director of T Creative Studio. A creative entrepreneur passionate about lash artistry, permanent jewelry, crochet, and business consulting in San Jose.",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Trini Lam | T Creative Studio",
    description:
      "Meet Trini Lam — founder and creative director of T Creative Studio. A creative entrepreneur passionate about lash artistry, permanent jewelry, crochet, and business consulting in San Jose.",
  },
};

export default function Page() {
  return <AboutPage />;
}
