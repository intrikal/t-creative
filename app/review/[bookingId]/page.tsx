import { redirect } from "next/navigation";
import { eq, and, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, services, reviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = {
  title: "Leave a Review — T Creative Studio",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ bookingId: string }>;
}

export default async function ReviewPage({ params }: Props) {
  const { bookingId: raw } = await params;
  const bookingId = Number(raw);
  if (!bookingId || Number.isNaN(bookingId)) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=/review/${bookingId}`);

  // Verify booking belongs to this client and is completed
  const [booking] = await db
    .select({
      id: bookings.id,
      clientId: bookings.clientId,
      status: bookings.status,
      serviceName: services.name,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)))
    .limit(1);

  if (!booking || booking.clientId !== user.id) redirect("/dashboard/bookings");

  // Check if review already exists
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.clientId, user.id), eq(reviews.bookingId, bookingId)))
    .limit(1);

  if (existing) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-[#faf6f1] flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h1 className="text-lg font-semibold text-stone-900 mb-2">
            You&apos;ve already reviewed this appointment
          </h1>
          <p className="text-sm text-muted">
            Thank you for your feedback! Your review is being processed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <ReviewForm bookingId={bookingId} serviceName={booking.serviceName} />
    </main>
  );
}
