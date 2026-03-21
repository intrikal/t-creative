/**
 * Portfolio — Server Component route wrapper with metadata and ISR.
 */
import type { Metadata } from "next";
import { getPublishedMedia } from "./actions";
import { PortfolioPage } from "./PortfolioPage";

const BASE_URL = "https://tcreativestudio.com";

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

function buildPortfolioJsonLd(media: Awaited<ReturnType<typeof getPublishedMedia>>) {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: "T Creative Studio Portfolio",
    url: `${BASE_URL}/portfolio`,
    description:
      "Portfolio of lash extensions, permanent jewelry, and custom crochet work by Trini Lam.",
    author: {
      "@type": "Person",
      name: "Trini Lam",
      worksFor: { "@type": "Organization", name: "T Creative Studio", url: BASE_URL },
    },
    associatedMedia: media.map((item) => ({
      "@type": "ImageObject",
      ...(item.publicUrl && { contentUrl: item.publicUrl }),
      ...(item.caption && { description: item.caption }),
      ...(item.title && { name: item.title }),
      ...(item.category && { keywords: item.category }),
      creator: { "@type": "Person", name: "Trini Lam" },
    })),
  };
}

export default async function Page() {
  const media = await getPublishedMedia();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildPortfolioJsonLd(media)) }}
      />
      <PortfolioPage media={media} />
    </>
  );
}
