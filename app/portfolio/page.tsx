/**
 * Portfolio — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { PortfolioPage } from "./PortfolioPage";

export const metadata: Metadata = {
  title: "Portfolio | T Creative Studio",
  description:
    "Explore Trini's portfolio of lash extensions, permanent jewelry, and custom crochet work. Each piece tells a story of intention, care, and transformation.",
  alternates: {
    canonical: "/portfolio",
  },
  openGraph: {
    title: "Portfolio | T Creative Studio",
    description:
      "Explore Trini's portfolio of lash extensions, permanent jewelry, and custom crochet work. Each piece tells a story of intention, care, and transformation.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Portfolio | T Creative Studio",
    description:
      "Explore Trini's portfolio of lash extensions, permanent jewelry, and custom crochet work. Each piece tells a story of intention, care, and transformation.",
  },
};

export default function Page() {
  return <PortfolioPage />;
}
