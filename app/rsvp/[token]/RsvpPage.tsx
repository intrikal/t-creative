"use client";

import { useState, useTransition } from "react";
import { CalendarDays, MapPin, Sparkles } from "lucide-react";
import type { RsvpEventInfo } from "@/app/rsvp/actions";
import { submitRsvp } from "@/app/rsvp/actions";

export function RsvpPage({ event, token }: { event: RsvpEventInfo; token: string }) {
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [result, setResult] = useState<
    { success: true } | { success: false; error: string } | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const isFull = event.maxAttendees !== null && event.currentCount >= event.maxAttendees;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitRsvp(token, { name, service });
      setResult(res);
    });
  }

  if (result?.success) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">You&apos;re on the list!</h1>
          <p className="text-[#666] text-sm leading-relaxed">
            Your RSVP for <span className="font-medium text-[#1a1a1a]">{event.title}</span> has been
            received. We&apos;ll be in touch with more details as the event approaches.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-[#a07040]">
            T Creative Studio
          </p>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">{event.title}</h1>
        </div>

        {/* Event details card */}
        <div className="bg-white rounded-2xl border border-[#e8e4de] p-5 space-y-3 shadow-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="w-4 h-4 text-[#a07040] mt-0.5 shrink-0" />
            <span className="text-sm text-[#444]">{event.eventDate}</span>
          </div>
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#a07040] mt-0.5 shrink-0" />
              <span className="text-sm text-[#444]">{event.location}</span>
            </div>
          )}
          {event.services && (
            <div className="text-sm text-[#666] pt-1 border-t border-[#f0ede8]">
              <span className="font-medium text-[#1a1a1a]">Services: </span>
              {event.services}
            </div>
          )}
          {event.maxAttendees !== null && (
            <div className="text-xs text-[#999] pt-1 border-t border-[#f0ede8]">
              {isFull ? (
                <span className="text-red-500 font-medium">This event is full</span>
              ) : (
                <>
                  {event.currentCount} / {event.maxAttendees} spots filled
                </>
              )}
            </div>
          )}
        </div>

        {/* RSVP form */}
        {isFull ? (
          <p className="text-center text-sm text-[#666]">
            Unfortunately this event has reached capacity. Please contact us to be added to a
            waitlist.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#444] uppercase tracking-wide">
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First and last name"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#e8e4de] bg-white placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-[#a07040]/30 focus:border-[#a07040] transition"
              />
            </div>
            {event.services && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#444] uppercase tracking-wide">
                  Service interest
                </label>
                <input
                  type="text"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="Which service are you interested in?"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#e8e4de] bg-white placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-[#a07040]/30 focus:border-[#a07040] transition"
                />
              </div>
            )}
            {result && !result.success && <p className="text-sm text-red-500">{result.error}</p>}
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="w-full py-2.5 rounded-xl bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#333] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Submitting…" : "RSVP"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
