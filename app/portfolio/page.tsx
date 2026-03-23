/**
 * Portfolio — Server Component route wrapper with metadata and ISR.
 */
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";
import { getPublishedMedia } from "./actions";
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

function buildPortfolioJsonLd(
  media: Awaited<ReturnType<typeof getPublishedMedia>>,
  bizName: string,
  ownerName: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: `${bizName} Portfolio`,
    url: `${SITE_URL}/portfolio`,
    description:
      "Portfolio of lash extensions, permanent jewelry, and custom crochet work by Trini Lam.",
    author: {
      "@type": "Person",
      name: ownerName,
      worksFor: { "@type": "Organization", name: bizName, url: SITE_URL },
    },
    associatedMedia: media.map((item) => ({
      "@type": "ImageObject",
      ...(item.publicUrl && { contentUrl: item.publicUrl }),
      ...(item.caption && { description: item.caption }),
      ...(item.title && { name: item.title }),
      ...(item.category && { keywords: item.category }),
      creator: { "@type": "Person", name: ownerName },
    })),
  };
}

export default async function Page() {
  const [media, { business, content }] = await Promise.all([getPublishedMedia(), getSiteData()]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildPortfolioJsonLd(media, business.businessName, business.owner),
          ),
        }}
      />
      <PortfolioPage
        media={media}
        businessName={business.businessName}
        location={business.location}
        email={business.email}
        footerTagline={content.footerTagline}
        socialLinks={content.socialLinks}
      />
    </>
  );
}
