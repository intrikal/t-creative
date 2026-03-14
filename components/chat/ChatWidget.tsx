"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { CATEGORY_META } from "@/components/booking/constants";
import { formatPrice, formatLocationType, formatTime } from "@/components/booking/helpers";
import type { Service, Studio } from "@/components/booking/types";
import { TCLogo } from "@/components/TCLogo";

// ── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "home"
  | "services"
  | "service_category"
  | "how_to_book"
  | "cancellation"
  | "prep"
  | "prep_category"
  | "loyalty"
  | "hours"
  | "location"
  | "fallback"
  | "fallback_sent";

type Message = { id: string; from: "bot" | "user"; text: string };

interface Props {
  studio: Studio;
  services: Service[];
  slug: string;
  /** If set, "Book this service" navigates here instead of scrolling to #services on the current page. */
  bookingPageUrl?: string;
}

// ── QueryClient scoped to widget (no root provider needed) ───────────────────
const qc = new QueryClient();

export function ChatWidget(props: Props) {
  return (
    <QueryClientProvider client={qc}>
      <Widget {...props} />
    </QueryClientProvider>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function catLabel(cat: string) {
  return (CATEGORY_META as Record<string, { label: string }>)[cat]?.label ?? cat;
}

// ── Widget (inner) ───────────────────────────────────────────────────────────

function Widget({ studio, services, slug, bookingPageUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("home");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      from: "bot",
      text: `Hey there! 👋 I'm here to answer your questions about ${studio.name}. What can I help you with?`,
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  function addMessages(...msgs: Omit<Message, "id">[]) {
    setMessages((prev) => [...prev, ...msgs.map((m, i) => ({ ...m, id: `${Date.now()}-${i}` }))]);
  }

  /** Adds a user bubble + bot reply bubble, then sets the next step. */
  function go(next: Step, userText: string, botText: string) {
    addMessages({ from: "user", text: userText }, { from: "bot", text: botText });
    setStep(next);
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const categories = Array.from(new Set(services.map((s) => s.category)));
  const prepCategories = categories.filter((c) => !!studio.intake[c]?.prep);

  const { policies } = studio;
  const cancellationText = (() => {
    const lines: string[] = [];
    if (policies.cancellationWindowHours)
      lines.push(
        `Free cancellations up to ${policies.cancellationWindowHours} hours before your appointment.`,
      );
    if (policies.cancellationFeeInCents)
      lines.push(
        `Late cancellations incur a $${(policies.cancellationFeeInCents / 100).toFixed(0)} fee.`,
      );
    if (policies.noShowFeeInCents)
      lines.push(`No-shows are charged $${(policies.noShowFeeInCents / 100).toFixed(0)}.`);
    return lines.length
      ? lines.join(" ")
      : "Please reach out as soon as possible if you need to cancel or reschedule.";
  })();

  const hoursText =
    studio.schedule.startTime && studio.schedule.endTime
      ? `I'm generally available ${formatTime(studio.schedule.startTime)} – ${formatTime(studio.schedule.endTime)}. Exact availability depends on the service — submit a booking request and I'll confirm a time that works!`
      : "Hours vary by availability. Submit a booking request and I'll confirm a time that works for you!";

  const locationText = [
    formatLocationType(studio.locationType),
    studio.locationArea ? `Based in ${studio.locationArea}.` : "",
    "Exact address is shared after your booking is confirmed.",
  ]
    .filter(Boolean)
    .join(" ");

  // ── Fallback form (TanStack Form + TanStack Query) ─────────────────────────

  const { mutate: sendQuestion, isPending } = useMutation({
    mutationFn: async (data: { name: string; email: string; question: string }) => {
      const res = await fetch("/api/chat/fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to send");
    },
    onSuccess: () => {
      addMessages({
        from: "bot",
        text: "Got it! We'll get back to you within 24 hours. You can also DM us on Instagram 🩷",
      });
      setStep("fallback_sent");
      form.reset();
    },
  });

  const form = useForm({
    defaultValues: { name: "", email: "", question: "" },
    onSubmit: ({ value }) => sendQuestion(value),
  });

  // ── Option buttons per step ────────────────────────────────────────────────

  function renderOptions(): { label: string; onClick: () => void }[] {
    switch (step) {
      case "home":
        return [
          {
            label: "Services & pricing",
            onClick: () =>
              go(
                "services",
                "Services & pricing",
                `I offer ${categories.map(catLabel).join(", ")}. Which would you like to know about?`,
              ),
          },
          {
            label: "How do I book?",
            onClick: () =>
              go(
                "how_to_book",
                "How do I book?",
                'Browse the services below, click "Book this service" on the one you want, and fill out a short request form. I\'ll confirm within 24 hours — a deposit may be required to hold your spot.',
              ),
          },
          ...(Object.values(policies).some(Boolean)
            ? [
                {
                  label: "Cancellation policy",
                  onClick: () => go("cancellation", "Cancellation policy", cancellationText),
                },
              ]
            : []),
          ...(prepCategories.length
            ? [
                {
                  label: "Prep & aftercare",
                  onClick: () =>
                    go("prep", "Prep & aftercare", "Which service are you preparing for?"),
                },
              ]
            : []),
          ...(studio.rewardsEnabled
            ? [
                {
                  label: "Loyalty & referrals",
                  onClick: () =>
                    go(
                      "loyalty",
                      "Loyalty & referrals",
                      "I run a loyalty rewards program! Earn points for every booking, referral, and review — then redeem them for discounts and perks. Share your referral link with friends and you both earn bonus points when they book!",
                    ),
                },
              ]
            : []),
          {
            label: "Hours",
            onClick: () => go("hours", "Hours", hoursText),
          },
          {
            label: "Location",
            onClick: () => go("location", "Location", locationText),
          },
          {
            label: "Something else",
            onClick: () =>
              go(
                "fallback",
                "Something else",
                "No problem! Drop your question below and I'll get back to you.",
              ),
          },
        ];

      case "services":
        return [
          ...categories.map((cat) => ({
            label: catLabel(cat),
            onClick: () => {
              const list = services
                .filter((s) => s.category === cat)
                .map(
                  (s) =>
                    `• ${s.name} — ${formatPrice(s.priceInCents)}${s.durationMinutes ? ` (${s.durationMinutes} min)` : ""}`,
                )
                .join("\n");
              go("service_category", catLabel(cat), list);
            },
          })),
          { label: "← Back", onClick: () => setStep("home") },
        ];

      case "service_category":
        return [
          {
            label: "Book this service →",
            onClick: () => {
              setOpen(false);
              if (bookingPageUrl) {
                window.location.href = `${bookingPageUrl}#services`;
              } else {
                document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
              }
            },
          },
          { label: "← Back", onClick: () => setStep("services") },
        ];

      case "how_to_book":
        return [
          {
            label: "View services →",
            onClick: () => {
              setOpen(false);
              if (bookingPageUrl) {
                window.location.href = `${bookingPageUrl}#services`;
              } else {
                document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
              }
            },
          },
          { label: "← Back to menu", onClick: () => setStep("home") },
        ];

      case "cancellation":
      case "loyalty":
      case "hours":
      case "location":
        return [{ label: "← Back to menu", onClick: () => setStep("home") }];

      case "prep":
        return [
          ...prepCategories.map((cat) => ({
            label: catLabel(cat),
            onClick: () => go("prep_category", catLabel(cat), studio.intake[cat].prep),
          })),
          { label: "← Back", onClick: () => setStep("home") },
        ];

      case "prep_category":
        return [{ label: "← Back", onClick: () => setStep("prep") }];

      case "fallback_sent":
        return [{ label: "← Back to menu", onClick: () => setStep("home") }];

      default:
        return [];
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#96604a] shadow-lg transition-transform hover:scale-105 active:scale-95 hover:bg-[#7a4e3a]"
      >
        {open ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <MessageCircle className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[440px] w-[340px] flex-col overflow-hidden rounded-2xl border border-[#e8c4b8] bg-[#faf6f1] shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-[#c4907a]/30 bg-[#96604a] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <TCLogo size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{studio.name}</p>
              <p className="text-[10px] text-white/70">Usually replies quickly</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto shrink-0 text-white/70 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Message thread */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    m.from === "bot"
                      ? "rounded-tl-sm bg-white text-[#2c2420] shadow-sm border border-[#e8c4b8]/50"
                      : "rounded-tr-sm bg-[#96604a] text-white"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Fallback form */}
          {step === "fallback" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
              className="shrink-0 space-y-2 border-t border-[#e8c4b8]/50 bg-white px-4 py-3"
            >
              <form.Field
                name="name"
                validators={{ onChange: ({ value }) => (!value.trim() ? "Required" : undefined) }}
              >
                {(field) => (
                  <input
                    placeholder="Your name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full rounded-lg border border-[#e8c4b8] bg-[#faf6f1] px-3 py-1.5 text-xs text-[#2c2420] outline-none focus:border-[#96604a]"
                  />
                )}
              </form.Field>
              <form.Field
                name="email"
                validators={{
                  onChange: ({ value }) =>
                    !value.trim() || !value.includes("@") ? "Valid email required" : undefined,
                }}
              >
                {(field) => (
                  <input
                    type="email"
                    placeholder="Your email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full rounded-lg border border-[#e8c4b8] bg-[#faf6f1] px-3 py-1.5 text-xs text-[#2c2420] outline-none focus:border-[#96604a]"
                  />
                )}
              </form.Field>
              <form.Field
                name="question"
                validators={{ onChange: ({ value }) => (!value.trim() ? "Required" : undefined) }}
              >
                {(field) => (
                  <textarea
                    rows={2}
                    placeholder="Your question"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full resize-none rounded-lg border border-[#e8c4b8] bg-[#faf6f1] px-3 py-1.5 text-xs text-[#2c2420] outline-none focus:border-[#96604a]"
                  />
                )}
              </form.Field>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep("home")}
                  className="text-xs text-[#96604a]/60 hover:text-[#96604a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-[#96604a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#7a4e3a] disabled:opacity-50"
                >
                  {isPending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          )}

          {/* Option buttons */}
          {step !== "fallback" && (
            <div
              className={`shrink-0 border-t border-[#e8c4b8]/50 bg-white px-3 py-3 ${
                step === "home" ? "grid grid-cols-2 gap-1.5" : "space-y-1.5"
              }`}
            >
              {renderOptions().map((opt, i) => (
                <button
                  key={i}
                  onClick={opt.onClick}
                  className="rounded-xl border border-[#e8c4b8] px-3 py-2 text-left text-xs font-medium text-[#2c2420] transition-colors hover:border-[#c4907a] hover:bg-[#faf6f1] hover:text-[#96604a]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
