/**
 * Portfolio — Server Component route wrapper with metadata and ISR.
 */
import type { Metadata } from "next";
import { getPublishedMedia } from "./actions";
import { PortfolioPage } from "./PortfolioPage";

export const revalidate = 3600;

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

export default async function Page() {
  const media = await getPublishedMedia();
  return <PortfolioPage media={media} />;
}
