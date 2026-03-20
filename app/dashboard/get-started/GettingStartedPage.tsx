"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Palette,
  Scissors,
  CreditCard,
  Check,
  UserPlus,
  CalendarPlus,
  Image,
  Copy,
  Link as LinkIcon,
  Settings,
  ArrowRight,
  CalendarRange,
  CalendarCheck,
  MessageSquare,
  BarChart2,
  Users,
  UserCheck,
  Inbox,
  DollarSign,
  Receipt,
  Star,
  ShoppingBag,
  CalendarDays,
  GraduationCap,
  Scale,
  PackageCheck,
  ShieldCheck,
  Bell,
  ListOrdered,
  Gift,
  Heart,
  Tag,
  Package,
  HeartHandshake,
  ClipboardList,
  Clock,
  Plug,
  Briefcase,
  Percent,
  Truck,
  FileText,
  UserCog,
  Share2,
  Wallet,
  TrendingUp,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GettingStartedPageProps {
  firstName: string;
  studioName: string | null;
  locationArea: string | null;
  socialCount: number;
  hasPolicies: boolean;
  hasDeposits: boolean;
}

function toSlug(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "") || "tcreativestudio";
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
        <div
          className={cn(
            "flex items-center justify-center shrink-0 w-28 sm:w-32",
            gradient,
          )}
        >
          <Icon className="w-10 h-10 text-white/80" />
        </div>
        <CardContent className="flex-1 px-4 py-4 flex flex-col justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-snug">{title}</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>
          </div>
          {done ? (
            <span className="text-sm font-semibold text-[#4e6b51]">All set!</span>
          ) : (
            <Link
              href={href}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors w-fit"
            >
              Start
            </Link>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Next step row (icon | title + desc | button)                       */
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
/*  Feature card (solid color bg, icon top-left, text bottom)          */
/* ------------------------------------------------------------------ */

function FeatureCard({
  icon: Icon,
  title,
  description,
  href,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  bg: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl p-4 min-h-[150px] transition-shadow hover:shadow-md",
        bg,
      )}
    >
      <Icon className="w-7 h-7 text-foreground/70" />
      <div className="mt-auto">
        <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
        <div className="flex items-end justify-between gap-2 mt-1">
          <p className="text-xs text-foreground/60 leading-relaxed flex-1">{description}</p>
          <ArrowRight className="w-4 h-4 text-foreground/40 group-hover:text-foreground/60 transition-colors shrink-0" />
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function GettingStartedPage({
  firstName,
  studioName,
  locationArea,
  socialCount,
  hasPolicies,
  hasDeposits,
}: GettingStartedPageProps) {
  const [copied, setCopied] = useState(false);
  const slug = toSlug(studioName ?? "");
  const bookingUrl = `tcreative.studio/book/${slug}`;

  // 3 main setup steps
  const studioDone = !!studioName && !!locationArea && socialCount > 0;
  const servicesDone = hasPolicies;
  const paymentsDone = hasDeposits;

  const steps = [
    {
      done: studioDone,
      title: "Set up your studio",
      description: "Add your studio name, location, and social links so clients can find you.",
      href: "/dashboard/settings",
      icon: Palette,
      gradient: "bg-gradient-to-br from-[#c4907a] to-[#d4a574]",
    },
    {
      done: servicesDone,
      title: "Set up services & policies",
      description: "Create services and configure booking policies like cancellation and no-show fees.",
      href: "/dashboard/services",
      icon: Scissors,
      gradient: "bg-gradient-to-br from-[#96604a] to-[#c4907a]",
    },
    {
      done: paymentsDone,
      title: "Set up payments",
      description: "Start accepting payments, collect deposits, and protect your time.",
      href: "/dashboard/settings",
      icon: CreditCard,
      gradient: "bg-gradient-to-br from-[#5b8a8a] to-[#7ba3a3]",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  const remaining = totalSteps - completedCount;

  const nextSteps = [
    {
      icon: Scissors,
      title: "Review your services",
      description: "Check your services, adjust pricing, and set durations so clients can book.",
      buttonLabel: "View Services",
      href: "/dashboard/services",
    },
    {
      icon: CalendarPlus,
      title: "Create your first appointment",
      description: "Block out your availability and add an appointment to get started.",
      buttonLabel: "View Calendar",
      href: "/dashboard/calendar",
    },
    {
      icon: UserPlus,
      title: "Invite your team",
      description: "Add assistants so they can manage their own schedules and clients.",
      buttonLabel: "Invite members",
      href: "/dashboard/team",
    },
    {
      icon: Image,
      title: "Upload your portfolio",
      description: "Add photos of your work so clients can see what you do before booking.",
      buttonLabel: "Upload Media",
      href: "/dashboard/media",
    },
  ];

  function handleCopy() {
    navigator.clipboard.writeText(`https://${bookingUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          Welcome, {firstName || "there"}!
        </h1>
        <Link
          href={`https://${bookingUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-surface transition-colors shrink-0"
        >
          My booking site <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── Finish setting up ──────────────────────────────────────── */}
      <Card className="gap-0">
        <CardContent className="px-5 py-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Finish setting up</h2>
              <p className="text-sm text-muted mt-0.5">
                {remaining > 0
                  ? `You\u2019re just ${remaining} step${remaining !== 1 ? "s" : ""} away from your first booking!`
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

      {/* ── Next steps (left) + Booking link (right) ───────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Next steps — left column */}
        <div className="xl:col-span-3">
          <h2 className="text-lg font-semibold text-foreground mb-3">Your next steps</h2>
          <div className="space-y-2">
            {nextSteps.map((step) => (
              <NextStepRow key={step.title} {...step} />
            ))}
          </div>
        </div>

        {/* Booking link + tips — right column */}
        <div className="xl:col-span-2 space-y-4">
          {/* Booking link card */}
          <Card className="gap-0 border-accent/20 bg-accent/[0.03]">
            <CardContent className="px-5 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/12 flex items-center justify-center shrink-0">
                  <LinkIcon className="w-4 h-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Your booking link</p>
                  <p className="text-xs text-muted mt-0.5">
                    Share this with clients so they can book with you.
                  </p>
                </div>
              </div>

              <div className="bg-surface rounded-lg border border-foreground/8 px-3 py-2.5">
                <p className="text-sm font-mono text-foreground/80 truncate">
                  tcreative.studio/book/<span className="text-accent font-semibold">{slug}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-accent hover:bg-accent/90 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy booking link"}
              </button>

              <p className="text-[11px] text-muted/60 leading-relaxed">
                Add this to your Instagram bio, text it to clients, or put it on your website.
              </p>
            </CardContent>
          </Card>

          {/* Quick tip card */}
          <Card className="gap-0">
            <CardContent className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#4e6b51]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Settings className="w-4 h-4 text-[#4e6b51]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Quick tip</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Head to{" "}
                    <Link href="/dashboard/settings" className="text-accent hover:underline">
                      Settings
                    </Link>{" "}
                    to connect Square for payments, manage your team, and adjust your booking policies anytime.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Everything in your studio ──────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Everything in your studio</h2>
        <p className="text-sm text-muted mt-0.5 mb-5">
          No more spreadsheets, no more chasing DMs. Here&apos;s everything you have.
        </p>

        {/* Scheduling & Bookings */}
        <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-3">Scheduling & Bookings</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <FeatureCard icon={CalendarRange} title="Calendar" description="Your full schedule at a glance — daily, weekly, or monthly." href="/dashboard/calendar" bg="bg-[#d4c5a0]/40" />
          <FeatureCard icon={CalendarCheck} title="Bookings" description="Clients book online through your link. Recurring appointments with iCal support." href="/dashboard/bookings" bg="bg-[#c9c0a0]/40" />
          <FeatureCard icon={ListOrdered} title="Waitlist" description="Clients join the waitlist when you're booked out. Auto-notify when a spot opens." href="/dashboard/bookings" bg="bg-[#c0bca0]/40" />
          <FeatureCard icon={Clock} title="Scheduling Rules" description="Business hours, time off, buffers, lead times, and cancellation policies." href="/dashboard/settings" bg="bg-[#b8b8a0]/40" />
          <FeatureCard icon={PackageCheck} title="Subscriptions" description="Pre-paid session packages — clients buy a bundle and book as they go." href="/dashboard/bookings" bg="bg-[#b8c0a8]/40" />
          <FeatureCard icon={ShieldCheck} title="Memberships" description="Membership tiers like Lash Club with perks, fills, and exclusive pricing." href="/dashboard/bookings" bg="bg-[#a8bca8]/40" />
        </div>

        {/* Services & Products */}
        <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-3">Services & Products</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <FeatureCard icon={Scissors} title="Services" description="Your full service menu — pricing, durations, add-ons, bundles, and deposits." href="/dashboard/services" bg="bg-[#d4a88a]/40" />
          <FeatureCard icon={ShoppingBag} title="Marketplace" description="Sell products, take custom orders with shipping, and manage inventory." href="/dashboard/marketplace" bg="bg-[#c8a890]/40" />
          <FeatureCard icon={Package} title="Supplies" description="Track your supply inventory — lash glue, chains, tools — with reorder alerts." href="/dashboard/marketplace" bg="bg-[#c0a898]/40" />
          <FeatureCard icon={CalendarDays} title="Events" description="Host workshops, pop-ups, private parties, bridal, corporate, and group sessions." href="/dashboard/events" bg="bg-[#c0a0a0]/40" />
          <FeatureCard icon={FileText} title="Service Records" description="Document every appointment — products used, lash mapping, reactions, before/after photos." href="/dashboard/services" bg="bg-[#c8a0a0]/40" />
          <FeatureCard icon={Truck} title="Custom Orders & Shipping" description="Accept custom commissions with quotes, EasyPost labels, and delivery tracking." href="/dashboard/marketplace" bg="bg-[#b8a098]/40" />
        </div>

        {/* Clients & Communication */}
        <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-3">Clients & Communication</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <FeatureCard icon={Users} title="Client CRM" description="Track history, preferences, allergies, VIP status, lifecycle stage, and tags — no more spreadsheets." href="/dashboard/clients" bg="bg-[#c5b8d4]/40" />
          <FeatureCard icon={MessageSquare} title="Messages" description="Unified inbox for every client conversation — no more scattered DMs." href="/dashboard/messages" bg="bg-[#b8b0d4]/40" />
          <FeatureCard icon={Inbox} title="Inquiries" description="New leads from your website and social links land here for follow-up." href="/dashboard/inquiries" bg="bg-[#b0b4d4]/40" />
          <FeatureCard icon={Bell} title="Notifications" description="Automated booking reminders, confirmations, cancellation notices, and waitlist alerts via email and SMS." href="/dashboard/notifications" bg="bg-[#a8b0d0]/40" />
          <FeatureCard icon={Star} title="Reviews" description="Collect, moderate, and showcase client reviews from Google, Instagram, and Yelp." href="/dashboard/reviews" bg="bg-[#c0b0c8]/40" />
          <FeatureCard icon={HeartHandshake} title="Aftercare" description="Send aftercare instructions and studio policies to clients automatically." href="/dashboard/services" bg="bg-[#c8b0c0]/40" />
          <FeatureCard icon={Share2} title="Referrals" description="Clients get referral codes — track who's bringing in new business." href="/dashboard/clients" bg="bg-[#b8a8c8]/40" />
          <FeatureCard icon={UserCog} title="Client Preferences" description="Save lash styles, curl types, lengths, skin sensitivities, and rebook intervals per client." href="/dashboard/clients" bg="bg-[#b0a8c0]/40" />
        </div>

        {/* Team & HR */}
        <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-3">Team & HR</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <FeatureCard icon={UserCheck} title="Staff Management" description="Manage team members, specialties, availability, bios, and start dates." href="/dashboard/team" bg="bg-[#b0c8b8]/40" />
          <FeatureCard icon={CalendarRange} title="Shift Scheduling" description="Schedule shifts, track in-progress and completed shifts, and manage locations." href="/dashboard/team" bg="bg-[#a8c0b0]/40" />
          <FeatureCard icon={Percent} title="Payroll & Commissions" description="Set hourly rates, commission percentages or flat fees, and tip splits per team member." href="/dashboard/team" bg="bg-[#a0b8a8]/40" />
          <FeatureCard icon={GraduationCap} title="Training & Certification" description="Run certification programs with modules, lessons, attendance tracking, and issued certificates." href="/dashboard/team" bg="bg-[#98b0a0]/40" />
          <FeatureCard icon={Briefcase} title="Consulting" description="Offer consulting services with flexible pricing — fixed, hourly, or contact for quote." href="/dashboard/services" bg="bg-[#90a898]/40" />
          <FeatureCard icon={TrendingUp} title="Performance & Ratings" description="Track staff ratings from client reviews and monitor team performance." href="/dashboard/team" bg="bg-[#a0b0a0]/40" />
        </div>

        {/* Money & Business */}
        <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-3">Money & Business</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <FeatureCard icon={DollarSign} title="Payments & Invoices" description="Accept card, cash, or wallet payments. Auto-generate invoices with tax and tips." href="/dashboard/financial" bg="bg-[#b8c9a8]/40" />
          <FeatureCard icon={Receipt} title="Expenses" description="Track business expenses by category — supplies, rent, marketing, equipment." href="/dashboard/financial" bg="bg-[#a8c0a8]/40" />
          <FeatureCard icon={BarChart2} title="Analytics" description="Revenue breakdowns, busiest days, top services, and growth trends." href="/dashboard/analytics" bg="bg-[#9bb4c8]/40" />
          <FeatureCard icon={Gift} title="Gift Cards" description="Sell gift cards with balance tracking — clients redeem toward services or products." href="/dashboard/financial" bg="bg-[#c8b8a0]/40" />
          <FeatureCard icon={Tag} title="Promotions" description="Create discount codes — percent off, fixed amount, BOGO, with usage caps and expiration." href="/dashboard/services" bg="bg-[#c0b0a0]/40" />
          <FeatureCard icon={Heart} title="Loyalty & Rewards" description="Clients earn points on every visit, referral, and review — redeem for discounts and perks." href="/dashboard/loyalty" bg="bg-[#d0a8a8]/40" />
          <FeatureCard icon={Wallet} title="Deposits" description="Collect deposits upfront to protect your time and reduce no-shows." href="/dashboard/services" bg="bg-[#b8b0a0]/40" />
        </div>

        {/* Studio & Legal */}
        <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-3">Studio & Legal</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FeatureCard icon={Image} title="Media & Portfolio" description="Showcase before/after photos, tag clients, and track consent for every image." href="/dashboard/services" bg="bg-[#b0a8a8]/40" />
          <FeatureCard icon={ClipboardList} title="Forms & Waivers" description="Intake forms, liability waivers, and consent forms — digitally signed and stored." href="/dashboard/settings" bg="bg-[#a0a8b8]/40" />
          <FeatureCard icon={Scale} title="Legal Documents" description="Privacy policy and terms of service with version history and effective dates." href="/dashboard/settings" bg="bg-[#a8a8b0]/40" />
          <FeatureCard icon={ShieldAlert} title="Audit Trail" description="Every action is logged — who changed what, when, and from where." href="/dashboard/settings" bg="bg-[#a0a0b8]/40" />
          <FeatureCard icon={Plug} title="Integrations" description="Connect Square, Zoho CRM, Zoho Books, Twilio SMS, Resend email, EasyPost, and Instagram." href="/dashboard/settings" bg="bg-[#a0a0b0]/40" />
          <FeatureCard icon={Settings} title="Settings" description="Business info, branding, booking policies, team permissions, and feature toggles." href="/dashboard/settings" bg="bg-[#a8a0a8]/40" />
          <FeatureCard icon={Activity} title="Webhooks & Sync" description="Real-time sync with Square, Zoho, and third-party services with error tracking." href="/dashboard/settings" bg="bg-[#9898a8]/40" />
        </div>
      </div>
    </div>
  );
}
