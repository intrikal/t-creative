"use client";

import type React from "react";
import Link from "next/link";
import {
  UserCircle,
  CalendarRange,
  ShieldCheck,
  Check,
  CalendarCheck,
  MessageSquare,
  GraduationCap,
  Star,
  DollarSign,
  Scissors,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AssistantGetStartedPageProps {
  firstName: string;
  hasProfile: boolean;
  hasAvailability: boolean;
  hasEmergencyAndPolicies: boolean;
}

/* ------------------------------------------------------------------ */
/*  Setup step card (gradient left, content right)                     */
/* ------------------------------------------------------------------ */

function SetupStepCard({
  done,
  title,
  description,
  href,
  icon: Icon,
  gradient,
}: {
  done: boolean;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}) {
  return (
    <Card className="gap-0 overflow-hidden hover:shadow-sm transition-shadow">
      <div className="flex h-full">
        <div className={cn("flex items-center justify-center shrink-0 w-28 sm:w-32", gradient)}>
          <Icon className="w-10 h-10 text-white/80" />
        </div>
        <CardContent className="flex-1 px-4 py-4 flex flex-col justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-snug">{title}</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>
          </div>
          {done ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4e6b51]">
              <Check className="w-4 h-4" /> All set!
            </span>
          ) : (
            <Link
              href={href}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors w-fit"
            >
              Complete
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

export function AssistantGetStartedPage({
  firstName,
  hasProfile,
  hasAvailability,
  hasEmergencyAndPolicies,
}: AssistantGetStartedPageProps) {
  const steps = [
    {
      done: hasProfile,
      title: "Complete your profile",
      description:
        "Add your name, skills, experience level, and a short bio so clients know who you are.",
      href: "/onboarding",
      icon: UserCircle,
      gradient: "bg-gradient-to-br from-[#c4907a] to-[#d4a574]",
    },
    {
      done: hasAvailability,
      title: "Set your availability",
      description: "Select the dates and hours you're available so you can start getting booked.",
      href: "/onboarding",
      icon: CalendarRange,
      gradient: "bg-gradient-to-br from-[#96604a] to-[#c4907a]",
    },
    {
      done: hasEmergencyAndPolicies,
      title: "Emergency contact & policies",
      description: "Add your emergency contact and acknowledge studio policies to complete setup.",
      href: "/onboarding",
      icon: ShieldCheck,
      gradient: "bg-gradient-to-br from-[#5b8a8a] to-[#7ba3a3]",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  const remaining = totalSteps - completedCount;

  const nextSteps = [
    {
      icon: CalendarCheck,
      title: "Check your schedule",
      description: "See your upcoming appointments and make sure your calendar looks right.",
      buttonLabel: "View Schedule",
      href: "/dashboard/schedule",
    },
    {
      icon: Scissors,
      title: "Browse services",
      description: "Review the services you'll be offering to clients.",
      buttonLabel: "View Services",
      href: "/dashboard/services",
    },
    {
      icon: MessageSquare,
      title: "Check your messages",
      description: "See if the studio owner or any clients have messaged you.",
      buttonLabel: "View Messages",
      href: "/dashboard/messages",
    },
    {
      icon: GraduationCap,
      title: "Explore training",
      description: "Check available training programs and certifications.",
      buttonLabel: "View Training",
      href: "/dashboard/training",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          Welcome, {firstName || "there"}!
        </h1>
        <p className="text-sm text-muted mt-1">
          Let&apos;s get you set up so you can start taking appointments.
        </p>
      </div>

      {/* Setup progress */}
      <Card className="gap-0">
        <CardContent className="px-5 py-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Finish setting up</h2>
              <p className="text-sm text-muted mt-0.5">
                {remaining > 0
                  ? `You\u2019re just ${remaining} step${remaining !== 1 ? "s" : ""} away from being ready!`
                  : "You\u2019re all set up and ready to go!"}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 w-8 rounded-full transition-colors",
                      step.done ? "bg-foreground" : "bg-foreground/12",
                    )}
                  />
                ))}
              </div>
              <span className="text-sm text-muted whitespace-nowrap">
                {completedCount}/{totalSteps} completed
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((step) => (
              <SetupStepCard key={step.title} {...step} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next steps */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Your next steps</h2>
        <div className="space-y-2">
          {nextSteps.map((step) => (
            <NextStepRow key={step.title} {...step} />
          ))}
        </div>
      </div>

      {/* Quick tips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="gap-0">
          <CardContent className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#c4907a]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Star className="w-4 h-4 text-[#c4907a]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Build your reputation</p>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  After each appointment, clients can leave reviews. Great reviews help you get more
                  bookings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardContent className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#5b8a8a]/10 flex items-center justify-center shrink-0 mt-0.5">
                <DollarSign className="w-4 h-4 text-[#5b8a8a]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Track your earnings</p>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Visit{" "}
                  <Link href="/dashboard/earnings" className="text-accent hover:underline">
                    Earnings
                  </Link>{" "}
                  to see your commissions, tips, and payout history.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
