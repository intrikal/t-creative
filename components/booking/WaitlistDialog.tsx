"use client";

import { useState, useEffect } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { X, Clock, Sparkles, Send } from "lucide-react";
import { checkIsAuthenticated } from "@/app/dashboard/book/actions";
import { cn } from "@/lib/utils";
import type { Service } from "./types";

export function WaitlistDialog({
  service,
  open,
  onClose,
}: {
  service: Service;
  open: boolean;
  onClose: () => void;
}) {
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [datePreference, setDatePreference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    if (!open) return;
    checkIsAuthenticated().then((authed) => setIsGuest(!authed));
  }, [open]);

  function handleClose() {
    setSubmitted(false);
    setName("");
    setEmail("");
    setDatePreference("");
    setNotes("");
    setError("");
    setTurnstileToken("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (isGuest && (!name.trim() || !email.trim())) {
      setError("Please enter your name and email.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/book/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          serviceId: service.id,
          datePreference: datePreference.trim(),
          notes: notes.trim(),
          turnstileToken,
        }),
      });
      if (!res.ok) throw new Error("Failed to join waitlist");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900">Join waitlist</h2>
                <p className="text-xs text-stone-500 mt-0.5">{service.name}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {submitted ? (
            <div className="py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-base font-semibold text-stone-900 mb-1">
                You&apos;re on the list!
              </h3>
              <p className="text-sm text-stone-500 leading-relaxed">
                We&apos;ll reach out as soon as a spot opens up for {service.name}.
              </p>
              <button
                onClick={handleClose}
                className="mt-5 px-6 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
              >
                Got it
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs text-stone-500 leading-relaxed">
                We&apos;ll notify you as soon as a spot opens. No commitment required.
              </p>

              {isGuest && (
                <>
                  <input
                    type="text"
                    placeholder="Full name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition"
                  />
                  <input
                    type="email"
                    placeholder="Email address *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition"
                  />
                </>
              )}

              <input
                type="text"
                placeholder="Date preference (optional) — e.g. weekends, after 3pm"
                value={datePreference}
                onChange={(e) => setDatePreference(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition"
              />

              <textarea
                placeholder="Anything else we should know? (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition resize-none"
              />

              {isGuest && (
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                  onSuccess={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                  options={{ theme: "light", size: "flexible" }}
                />
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || (isGuest === true && !turnstileToken)}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors",
                  submitting
                    ? "bg-stone-300 text-stone-500 cursor-wait"
                    : "bg-stone-900 text-white hover:bg-amber-500 active:scale-[0.98]",
                )}
              >
                {submitting ? (
                  "Joining..."
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Join waitlist
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
