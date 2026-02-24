/**
 * Reviews dashboard route — `/dashboard/reviews`.
 *
 * Server Component that fetches reviews and stats from the `reviews` table
 * and passes them to the `<ReviewsPage>` Client Component.
 *
 * @module reviews/page
 * @see {@link ./actions.ts} — server actions
 * @see {@link ./ReviewsPage.tsx} — client component
 */
import { getReviews, getReviewStats } from "./actions";
import { ReviewsPage } from "./ReviewsPage";

export default async function Page() {
  const [reviews, stats] = await Promise.all([getReviews(), getReviewStats()]);

  return <ReviewsPage initialReviews={reviews} stats={stats} />;
}
