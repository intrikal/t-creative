import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getReviews, getReviewStats } from "./actions";
import { AssistantReviewsPage } from "./AssistantReviewsPage";
import { ReviewsPage } from "./ReviewsPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "assistant") {
    return <AssistantReviewsPage />;
  }

  const [reviews, stats] = await Promise.all([getReviews(), getReviewStats()]);

  return <ReviewsPage initialReviews={reviews} stats={stats} />;
}
