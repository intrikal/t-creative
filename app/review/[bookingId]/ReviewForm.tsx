"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuStar, LuSend } from "react-icons/lu";
import { submitClientReview } from "@/app/dashboard/bookings/client-actions";
import { cn } from "@/lib/utils";

export function ReviewForm({ bookingId, serviceName }: { bookingId: number; serviceName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError("Please select a star rating.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await submitClientReview({ bookingId, rating, comment: comment.trim() });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-[#faf6f1] flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">✨</span>
        </div>
        <h1 className="text-lg font-semibold text-stone-900 mb-2">Thank you!</h1>
        <p className="text-sm text-muted mb-6">
          Your review has been submitted and will be visible once approved.
        </p>
        <button
          onClick={() => router.push("/dashboard/bookings")}
          className="px-6 py-2.5 rounded-xl bg-[#96604a] text-white text-sm font-medium hover:bg-[#7a4e3a] transition-colors"
        >
          Back to Bookings
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-xl font-semibold text-stone-900 mb-1">How was your {serviceName}?</h1>
        <p className="text-sm text-muted">
          Your feedback helps us improve and helps others decide.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
        {/* Star rating */}
        <div className="text-center">
          <p className="text-xs font-medium text-stone-600 mb-3">Tap a star to rate</p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="p-1 transition-transform hover:scale-110"
                aria-label={`${star} star${star !== 1 ? "s" : ""}`}
              >
                <LuStar
                  className={cn(
                    "w-8 h-8 transition-colors",
                    star <= (hovered || rating)
                      ? "fill-[#d4a574] text-[#d4a574]"
                      : "text-stone-300",
                  )}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-xs text-muted mt-2">
              {rating === 5
                ? "Amazing!"
                : rating === 4
                  ? "Great!"
                  : rating === 3
                    ? "Good"
                    : rating === 2
                      ? "Could be better"
                      : "Sorry to hear"}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <label htmlFor="comment" className="text-xs font-medium text-stone-600">
            Tell us more <span className="text-stone-400">(optional)</span>
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you love? What could we improve?"
            rows={3}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition resize-none"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !rating}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors",
            submitting || !rating
              ? "bg-stone-200 text-stone-400 cursor-not-allowed"
              : "bg-[#96604a] text-white hover:bg-[#7a4e3a] active:scale-[0.98]",
          )}
        >
          {submitting ? (
            "Submitting..."
          ) : (
            <>
              <LuSend className="w-4 h-4" />
              Submit Review
            </>
          )}
        </button>
      </div>
    </form>
  );
}
