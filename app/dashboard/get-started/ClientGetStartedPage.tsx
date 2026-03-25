"use client";

import type React from "react";
import Link from "next/link";
import {
  UserCircle,
  Heart,
  ShieldCheck,
  Check,
  CalendarPlus,
  MessageSquare,
  ShoppingBag,
  Star,
  Gift,
  Bell,
  PartyPopper,
  ArrowRight,
  Camera,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ClientGetStartedPageProps {
  firstName: string;
  hasProfile: boolean;
  hasPreferences: boolean;
  hasPolicies: boolean;
}

/* ------------------------------------------------------------------ */
/*  Setup step card                                                    */
/* ------------------------------------------------------------------ */

function SetupStepCard({
  stepNumber,
  done,
  title,
  description,
  href,
  icon: Icon,
  gradient,
}: {
  stepNumber: number;
  done: boolean;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}) {
  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden transition-shadow",
        done ? "opacity-75" : "hover:shadow-md",
      )}
    >
      <div className="flex h-full">
        <div
          className={cn(
            "relative flex items-center justify-center shrink-0 w-28 sm:w-32",
            gradient,
          )}
        >
          {done ? (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-white" />
            </div>
          ) : (
            <Icon className="w-10 h-10 text-white/80" />
          )}
          <span className="absolute top-2 left-2 text-[10px] font-bold text-white/50">
            {stepNumber}
          </span>
        </div>
        <CardContent className="flex-1 px-4 py-4 flex flex-col justify-between gap-3">
          <div>
            <h3
              className={cn(
                "text-sm font-semibold leading-snug",
                done ? "text-muted line-through" : "text-foreground",
              )}
            >
              {title}
            </h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>
          </div>
          {done ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4e6b51]">
              <Check className="w-4 h-4" /> Done
            </span>
          ) : (
            <Link
              href={href}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors w-fit"
            >
              Complete <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Next step row                                                      */
/* ------------------------------------------------------------------ */

function NextStepRow({
  icon: Icon,
  title,
  description,
  buttonLabel,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
}) {
  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted mt-0.5">{description}</p>
          </div>
          <Link
            href={href}
            className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-surface transition-colors shrink-0"
          >
            {buttonLabel}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ClientGetStartedPage({
  firstName,
  hasProfile,
  hasPreferences,
  hasPolicies,
}: ClientGetStartedPageProps) {
  const steps = [
    {
      done: hasProfile,
      title: "Complete your profile",
      description:
        "Tell us your name and what services you\u2019re interested in so we can personalize your experience.",
      href: "/onboarding",
      icon: UserCircle,
      gradient: "bg-gradient-to-br from-[#c4907a] to-[#d4a574]",
    },
    {
      done: hasPreferences,
      title: "Set your preferences",
      description:
        "Let us know about any allergies or sensitivities, and when you\u2019re typically available.",
      href: "/onboarding",
      icon: Heart,
      gradient: "bg-gradient-to-br from-[#96604a] to-[#c4907a]",
    },
    {
      done: hasPolicies,
      title: "Review policies & consent",
      description:
        "Agree to our cancellation policy and liability waiver so you can start booking.",
      href: "/onboarding",
      icon: ShieldCheck,
      gradient: "bg-gradient-to-br from-[#5b8a8a] to-[#7ba3a3]",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  const remaining = totalSteps - completedCount;
  const allDone = remaining === 0;

  const nextSteps = [
    {
      icon: CalendarPlus,
      title: "Book your first appointment",
      description: "Browse available services and pick a time that works for you.",
      buttonLabel: "Book Now",
      href: "/dashboard/book",
    },
    {
      icon: ShoppingBag,
      title: "Browse the shop",
      description: "Check out products, gift cards, and custom orders.",
      buttonLabel: "View Shop",
      href: "/dashboard/shop",
    },
    {
      icon: MessageSquare,
      title: "Send a message",
      description: "Have a question? Reach out to the studio directly.",
      buttonLabel: "Messages",
      href: "/dashboard/messages",
    },
    {
      icon: Camera,
      title: "View the gallery",
      description: "See before & after photos and get inspired for your next visit.",
      buttonLabel: "View Gallery",
      href: "/dashboard/gallery",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          {allDone ? <>Welcome, {firstName || "there"}!</> : <>Hey, {firstName || "there"}!</>}
        </h1>
        <p className="text-sm text-muted mt-1">
          {allDone
            ? "You\u2019re all set. Here\u2019s what you can do next."
            : "Let\u2019s get you set up so you can start booking."}
        </p>
      </div>

      {/* All-done celebration */}
      {allDone && (
        <Card className="gap-0 border-[#4e6b51]/20 bg-[#4e6b51]/[0.04]">
          <CardContent className="px-5 py-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#4e6b51]/12 flex items-center justify-center shrink-0">
                <PartyPopper className="w-6 h-6 text-[#4e6b51]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">You&apos;re all set!</p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  Your profile is complete. You&apos;re ready to book your first appointment.
                </p>
              </div>
              <Link
                href="/dashboard/book"
                className="px-4 py-2 rounded-lg bg-[#4e6b51] text-white text-xs font-semibold hover:bg-[#4e6b51]/90 transition-colors shrink-0 ml-auto"
              >
                Book Now
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup progress */}
      {!allDone && (
        <Card className="gap-0">
          <CardContent className="px-5 py-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Finish setting up</h2>
                <p className="text-sm text-muted mt-0.5">
                  {`You\u2019re just ${remaining} step${remaining !== 1 ? "s" : ""} away from booking!`}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  {steps.map((step, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 w-10 rounded-full transition-colors",
                        step.done ? "bg-[#4e6b51]" : "bg-foreground/10",
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-muted whitespace-nowrap">
                  {completedCount}/{totalSteps}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {steps.map((step, i) => (
                <SetupStepCard key={step.title} stepNumber={i + 1} {...step} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next steps + tips */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Next steps */}
        <div className="xl:col-span-3">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {allDone ? "Explore" : "Your next steps"}
          </h2>
          <div className="space-y-2">
            {nextSteps.map((step) => (
              <NextStepRow key={step.title} {...step} />
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Tips</h2>

          <Card className="gap-0">
            <CardContent className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#d4a574]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Gift className="w-4 h-4 text-[#d4a574]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Earn loyalty points</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    You earn points with every visit, referral, and review. Redeem them for
                    discounts and perks.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardContent className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#c4907a]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Star className="w-4 h-4 text-[#c4907a]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Leave a review</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    After your appointment, leave a review to help others and earn bonus loyalty
                    points.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardContent className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#5b8a8a]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4 text-[#5b8a8a]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Never miss an appointment</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Check{" "}
                    <Link href="/dashboard/notifications" className="text-accent hover:underline">
                      Notifications
                    </Link>{" "}
                    to make sure you&apos;re getting booking reminders.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
