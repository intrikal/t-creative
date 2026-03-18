import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getReviews, getReviewStats, getAssistantReviews } from "./actions";
import { AssistantReviewsPage } from "./AssistantReviewsPage";
import { ReviewsPage } from "./ReviewsPage";

export const metadata: Metadata = {
  title: "Reviews — T Creative Studio",
  description: "View and manage client reviews and ratings.",
  robots: { index: false, follow: false },
};

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
