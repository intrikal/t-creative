import type { Metadata } from "next";
import { getAllFeaturedReviews, getReviewStats } from "@/lib/public-reviews";
import { SITE_URL } from "@/lib/site-config";
import { TestimonialsPage } from "./TestimonialsPage";

export const metadata: Metadata = {
  title: "Client Reviews — T Creative Studio",
  description:
    "Read reviews from real clients about lash extensions, permanent jewelry, and more at T Creative Studio.",
  alternates: { canonical: `${SITE_URL}/testimonials` },
  robots: { index: true, follow: true },
};

export default async function Page() {
  const [reviews, stats] = await Promise.all([getAllFeaturedReviews(), getReviewStats()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "T Creative Studio",
    url: SITE_URL,
    ...(stats.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: stats.avg.toFixed(1),
            reviewCount: stats.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    review: reviews.slice(0, 20).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.client },
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      datePublished: r.createdAt.split("T")[0],
      ...(r.body ? { reviewBody: r.body } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TestimonialsPage reviews={reviews} stats={stats} />
    </>
  );
}
