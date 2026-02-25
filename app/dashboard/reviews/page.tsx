import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getReviews, getReviewStats, getAssistantReviews } from "./actions";
import { AssistantReviewsPage } from "./AssistantReviewsPage";
import { ReviewsPage } from "./ReviewsPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "assistant") {
    const data = await getAssistantReviews();
    return <AssistantReviewsPage data={data} />;
  }

  const [reviews, stats] = await Promise.all([getReviews(), getReviewStats()]);

  return <ReviewsPage initialReviews={reviews} stats={stats} />;
}
