import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Reviews — T Creative Studio",
  description: "View and manage client reviews and ratings.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role === "client") redirect("/dashboard");

  if (user.profile?.role === "assistant") {
    const [{ getAssistantReviews }, { AssistantReviewsPage }] = await Promise.all([
      import("./actions"),
      import("./AssistantReviewsPage"),
    ]);
    const data = await getAssistantReviews();
    return <AssistantReviewsPage data={data} />;
  }

  const [{ getReviews, getReviewStats }, { ReviewsPage }] = await Promise.all([
    import("./actions"),
    import("./ReviewsPage"),
  ]);

  const [reviews, stats] = await Promise.all([getReviews(), getReviewStats()]);
  return <ReviewsPage initialReviews={reviews} stats={stats} />;
}
