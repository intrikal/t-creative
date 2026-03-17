"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Calendar,
  CreditCard,
  ClipboardList,
  Heart,
  Gift,
  MessageSquare,
  FileText,
  StickyNote,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Users,
  Cake,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientDetailData, ClientServiceRecordRow } from "./actions";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function initials(first: string, last: string) {
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "bg-[#c4907a]/20 text-[#96604a]",
  "bg-[#d4a574]/20 text-[#a07040]",
  "bg-[#7ba3a3]/20 text-[#3a6a6a]",
  "bg-purple-100 text-purple-700",
  "bg-blue-50 text-blue-700",
  "bg-amber-50 text-amber-700",
];

function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-50 text-green-700 border-green-100";
    case "confirmed":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "in_progress":
      return "bg-indigo-50 text-indigo-700 border-indigo-100";
    case "cancelled":
      return "bg-red-50 text-red-600 border-red-100";
    case "no_show":
      return "bg-stone-50 text-stone-600 border-stone-100";
    case "paid":
      return "bg-green-50 text-green-700 border-green-100";
    case "refunded":
    case "partially_refunded":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "failed":
      return "bg-red-50 text-red-600 border-red-100";
    default:
      return "bg-stone-50 text-stone-600 border-stone-100";
  }
}

function lifecycleBadge(stage: string) {
  switch (stage) {
    case "prospect":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "active":
      return "bg-green-50 text-green-700 border-green-100";
    case "at_risk":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "lapsed":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "churned":
      return "bg-red-50 text-red-600 border-red-100";
    default:
      return "bg-stone-50 text-stone-600 border-stone-100";
  }
}

function formatStage(s: string) {
  return s === "at_risk" ? "At Risk" : s.charAt(0).toUpperCase() + s.slice(1);
}

function getTier(points: number) {
  if (points >= 1500) return { label: "Platinum", color: "text-[#5b8a8a]", bg: "bg-[#5b8a8a]/10" };
  if (points >= 700) return { label: "Gold", color: "text-[#d4a574]", bg: "bg-[#d4a574]/10" };
  if (points >= 300) return { label: "Silver", color: "text-muted", bg: "bg-foreground/8" };
  return { label: "Bronze", color: "text-[#a07040]", bg: "bg-[#a07040]/10" };
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "service-records", label: "Service Records", icon: StickyNote },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "loyalty", label: "Loyalty", icon: Gift },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "forms", label: "Forms", icon: FileText },
] as const;

type Tab = (typeof TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ClientDetailPage({ data }: { data: ClientDetailData }) {
  const { profile, preferences, loyaltyBalance } = data;
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const av = avatarColor(fullName);
  const tier = getTier(loyaltyBalance);

  const totalSpent = data.bookings
    .filter((b) => b.status === "completed")
    .reduce((s, b) => s + b.totalInCents, 0);
  const completedBookings = data.bookings.filter((b) => b.status === "completed").length;
  const lastVisit = data.bookings.find((b) => b.status === "completed")?.startsAt ?? null;

  // Allergies from preferences or onboarding
  const allergies =
    preferences?.allergies ||
    (profile.onboardingData?.allergies as string | undefined) ||
    null;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
      {/* Back link */}
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to clients
      </Link>

      {/* Header card */}
      <Card className="py-0">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Avatar */}
            <Avatar className="w-16 h-16 shrink-0">
              <AvatarFallback className={cn("text-lg font-semibold", av)}>
                {initials(profile.firstName, profile.lastName)}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground">{fullName}</h1>
                {profile.isVip && (
                  <Star className="w-4 h-4 text-[#d4a574] fill-[#d4a574] shrink-0" />
                )}
                {profile.lifecycleStage && (
                  <Badge
                    className={cn(
                      "border text-[10px] px-1.5 py-0.5 font-medium",
                      lifecycleBadge(profile.lifecycleStage),
                    )}
                  >
                    {formatStage(profile.lifecycleStage)}
                  </Badge>
                )}
                <Badge className={cn("border text-[10px] px-1.5 py-0.5 font-medium", tier.bg, tier.color)}>
                  {tier.label}
                </Badge>
              </div>

              <div className="flex items-center gap-4 flex-wrap text-sm text-muted">
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {profile.email}
                </span>
                {profile.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {profile.phone}
                  </span>
                )}
                {preferences?.birthday && (
                  <span className="inline-flex items-center gap-1">
                    <Cake className="w-3.5 h-3.5" /> {preferences.birthday}
                  </span>
                )}
              </div>

              {/* Quick info row */}
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
                {profile.source && (
                  <span>
                    Source: <span className="font-medium text-foreground capitalize">{profile.source.replace("_", " ")}</span>
                  </span>
                )}
                {profile.referredByName && (
                  <span>
                    Referred by <span className="font-medium text-foreground">{profile.referredByName}</span>
                  </span>
                )}
                {profile.referralCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <Users className="w-3 h-3" /> {profile.referralCount} referred
                  </span>
                )}
                <span>Client since {formatDate(profile.createdAt)}</span>
              </div>
            </div>

            {/* Key stats */}
            <div className="flex gap-4 sm:gap-6 shrink-0 items-start pt-1">
              <div className="text-center">
                <p className="text-2xl font-semibold text-foreground">{completedBookings}</p>
                <p className="text-[10px] text-muted uppercase tracking-wide">Visits</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-foreground">{formatCents(totalSpent)}</p>
                <p className="text-[10px] text-muted uppercase tracking-wide">Total Spent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-foreground">{loyaltyBalance}</p>
                <p className="text-[10px] text-muted uppercase tracking-wide">Points</p>
              </div>
            </div>
          </div>

          {/* Allergy / health alert */}
          {(allergies || preferences?.healthNotes) && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 space-y-0.5">
                {allergies && <p><span className="font-semibold">Allergies:</span> {allergies}</p>}
                {preferences?.healthNotes && (
                  <p><span className="font-semibold">Health notes:</span> {preferences.healthNotes}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === "messages" && data.threads.some((t) => t.unreadCount > 0) && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab data={data} />}
      {activeTab === "bookings" && <BookingsTab data={data} />}
      {activeTab === "service-records" && <ServiceRecordsTab data={data} />}
      {activeTab === "payments" && <PaymentsTab data={data} />}
      {activeTab === "loyalty" && <LoyaltyTab data={data} />}
      {activeTab === "messages" && <MessagesTab data={data} />}
      {activeTab === "forms" && <FormsTab data={data} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview Tab                                                       */
/* ------------------------------------------------------------------ */

function OverviewTab({ data }: { data: ClientDetailData }) {
  const { profile, preferences, bookings: allBookings, serviceRecords: records } = data;
  const lastBooking = allBookings.find((b) => b.status === "completed");
  const nextBooking = allBookings.find((b) =>
    ["pending", "confirmed"].includes(b.status) && new Date(b.startsAt) >= new Date(),
  );
  const lastRecord = records[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Quick glance */}
      <Card className="py-0">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted" /> Quick Glance
          </h3>
          <div className="space-y-2 text-sm">
            <Row label="Last visit" value={lastBooking ? formatDate(lastBooking.startsAt) : "—"} />
            <Row label="Last service" value={lastBooking?.serviceName ?? "—"} />
            <Row
              label="Next appointment"
              value={nextBooking ? `${nextBooking.serviceName} — ${formatDateTime(nextBooking.startsAt)}` : "None scheduled"}
            />
            <Row
              label="Rebook interval"
              value={preferences?.preferredRebookIntervalDays ? `${preferences.preferredRebookIntervalDays} days` : "—"}
            />
            {lastRecord?.retentionNotes && (
              <Row label="Retention" value={lastRecord.retentionNotes} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lash preferences */}
      {preferences && (
        <Card className="py-0">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-muted" /> Lash Preferences
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="Style" value={preferences.preferredLashStyle ?? "—"} />
              <Row label="Curl type" value={preferences.preferredCurlType ?? "—"} />
              <Row label="Lengths" value={preferences.preferredLengths ?? "—"} />
              <Row label="Diameter" value={preferences.preferredDiameter ?? "—"} />
              <Row label="Natural lash notes" value={preferences.naturalLashNotes ?? "—"} />
              <Row label="Skin type" value={preferences.skinType ?? "—"} />
              <Row
                label="Adhesive sensitivity"
                value={preferences.adhesiveSensitivity ? "Yes" : "No"}
              />
              {preferences.preferredContactMethod && (
                <Row label="Contact method" value={preferences.preferredContactMethod} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last service record */}
      {lastRecord && (
        <Card className="py-0">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-muted" /> Last Service Record
            </h3>
            <ServiceRecordDetail record={lastRecord} />
          </CardContent>
        </Card>
      )}

      {/* Internal notes */}
      {(profile.internalNotes || preferences?.generalNotes || preferences?.retentionProfile) && (
        <Card className="py-0">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-muted" /> Notes
            </h3>
            <div className="space-y-2 text-sm">
              {profile.internalNotes && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-0.5">Internal</p>
                  <p className="text-foreground">{profile.internalNotes}</p>
                </div>
              )}
              {preferences?.retentionProfile && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-0.5">Retention Profile</p>
                  <p className="text-foreground">{preferences.retentionProfile}</p>
                </div>
              )}
              {preferences?.generalNotes && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-0.5">General</p>
                  <p className="text-foreground">{preferences.generalNotes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bookings Tab                                                       */
/* ------------------------------------------------------------------ */

function BookingsTab({ data }: { data: ClientDetailData }) {
  if (data.bookings.length === 0) return <EmptyState label="No bookings yet" />;

  return (
    <div className="space-y-2">
      {data.bookings.map((b) => (
        <Card key={b.id} className="py-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{b.serviceName}</span>
                  <Badge
                    className={cn("border text-[10px] px-1.5 py-0.5 font-medium", statusBadge(b.status))}
                  >
                    {b.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                  <span>{formatDateTime(b.startsAt)}</span>
                  <span>{b.durationMinutes} min</span>
                  {b.staffName && <span>with {b.staffName}</span>}
                  {b.location && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" /> {b.location}
                    </span>
                  )}
                </div>
                {b.clientNotes && (
                  <p className="text-xs text-muted italic mt-1">Client: {b.clientNotes}</p>
                )}
                {b.staffNotes && (
                  <p className="text-xs text-muted italic">Staff: {b.staffNotes}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground">{formatCents(b.totalInCents)}</p>
                {b.discountInCents > 0 && (
                  <p className="text-[10px] text-green-600">-{formatCents(b.discountInCents)} discount</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Service Records Tab                                                */
/* ------------------------------------------------------------------ */

function ServiceRecordsTab({ data }: { data: ClientDetailData }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (data.serviceRecords.length === 0) return <EmptyState label="No service records yet" />;

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {data.serviceRecords.map((sr) => {
        const open = expanded.has(sr.id);
        return (
          <Card key={sr.id} className="py-0">
            <CardContent className="p-0">
              <button
                onClick={() => toggle(sr.id)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-foreground/3 transition-colors"
              >
                <div className="space-y-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground">{sr.serviceName}</span>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{formatDate(sr.bookingDate)}</span>
                    {sr.staffName && <span>by {sr.staffName}</span>}
                  </div>
                </div>
                {open ? (
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                )}
              </button>
              {open && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <ServiceRecordDetail record={sr} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ServiceRecordDetail({ record }: { record: ClientServiceRecordRow }) {
  return (
    <div className="space-y-2 text-sm pt-3">
      {record.lashMapping && <Row label="Lash mapping" value={record.lashMapping} />}
      {record.curlType && <Row label="Curl type" value={record.curlType} />}
      {record.diameter && <Row label="Diameter" value={record.diameter} />}
      {record.lengths && <Row label="Lengths" value={record.lengths} />}
      {record.adhesive && <Row label="Adhesive" value={record.adhesive} />}
      {record.retentionNotes && <Row label="Retention" value={record.retentionNotes} />}
      {record.productsUsed && <Row label="Products used" value={record.productsUsed} />}
      {record.notes && <Row label="Notes" value={record.notes} />}
      {record.reactions && (
        <div className="flex items-start gap-1.5 text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{record.reactions}</span>
        </div>
      )}
      {record.nextVisitNotes && <Row label="Next visit" value={record.nextVisitNotes} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Payments Tab                                                       */
/* ------------------------------------------------------------------ */

function PaymentsTab({ data }: { data: ClientDetailData }) {
  if (data.payments.length === 0) return <EmptyState label="No payment records" />;

  const totalPaid = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amountInCents, 0);
  const totalTips = data.payments.reduce((s, p) => s + p.tipInCents, 0);
  const totalRefunded = data.payments.reduce((s, p) => s + p.refundedInCents, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">Total Paid</p>
            <p className="text-xl font-semibold text-foreground">{formatCents(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">Tips</p>
            <p className="text-xl font-semibold text-foreground">{formatCents(totalTips)}</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">Refunded</p>
            <p className="text-xl font-semibold text-foreground">{formatCents(totalRefunded)}</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <div className="space-y-2">
        {data.payments.map((p) => (
          <Card key={p.id} className="py-0">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn("border text-[10px] px-1.5 py-0.5 font-medium", statusBadge(p.status))}
                  >
                    {p.status}
                  </Badge>
                  {p.method && (
                    <span className="text-xs text-muted capitalize">{p.method.replace(/_/g, " ")}</span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {p.paidAt ? formatDateTime(p.paidAt) : formatDateTime(p.createdAt)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground">{formatCents(p.amountInCents)}</p>
                {p.tipInCents > 0 && (
                  <p className="text-[10px] text-muted">+{formatCents(p.tipInCents)} tip</p>
                )}
                {p.refundedInCents > 0 && (
                  <p className="text-[10px] text-orange-600">-{formatCents(p.refundedInCents)} refund</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loyalty Tab                                                        */
/* ------------------------------------------------------------------ */

function LoyaltyTab({ data }: { data: ClientDetailData }) {
  const tier = getTier(data.loyaltyBalance);

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <Card className="py-0">
        <CardContent className="p-5 flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", tier.bg)}>
            <Gift className={cn("w-5 h-5", tier.color)} />
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{data.loyaltyBalance} points</p>
            <p className={cn("text-sm font-medium", tier.color)}>{tier.label} Tier</p>
          </div>
        </CardContent>
      </Card>

      {/* Transaction history */}
      {data.loyaltyTransactions.length === 0 ? (
        <EmptyState label="No loyalty activity" />
      ) : (
        <div className="space-y-1">
          {data.loyaltyTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-foreground/3 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {tx.description || tx.type.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted">{formatDate(tx.createdAt)}</p>
              </div>
              <span
                className={cn(
                  "text-sm font-semibold shrink-0",
                  tx.points > 0 ? "text-green-600" : "text-red-500",
                )}
              >
                {tx.points > 0 ? "+" : ""}
                {tx.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Messages Tab                                                       */
/* ------------------------------------------------------------------ */

function MessagesTab({ data }: { data: ClientDetailData }) {
  if (data.threads.length === 0) return <EmptyState label="No message threads" />;

  return (
    <div className="space-y-2">
      {data.threads.map((t) => (
        <Card key={t.id} className="py-0">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate">{t.subject}</span>
                {t.unreadCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Badge className="border text-[10px] px-1.5 py-0.5 font-medium bg-stone-50 text-stone-600 border-stone-100">
                  {t.threadType}
                </Badge>
                <Badge className={cn("border text-[10px] px-1.5 py-0.5 font-medium", statusBadge(t.status))}>
                  {t.status}
                </Badge>
                <span>{t.messageCount} messages</span>
              </div>
            </div>
            <span className="text-xs text-muted shrink-0">{formatDate(t.lastMessageAt)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Forms Tab                                                          */
/* ------------------------------------------------------------------ */

function FormsTab({ data }: { data: ClientDetailData }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (data.formSubmissions.length === 0) return <EmptyState label="No form submissions" />;

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {data.formSubmissions.map((f) => {
        const open = expanded.has(f.id);
        return (
          <Card key={f.id} className="py-0">
            <CardContent className="p-0">
              <button
                onClick={() => toggle(f.id)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-foreground/3 transition-colors"
              >
                <div className="space-y-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground">{f.formName}</span>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="capitalize">{f.formType}</span>
                    {f.formVersion && <span>v{f.formVersion}</span>}
                    <span>{formatDate(f.submittedAt)}</span>
                  </div>
                </div>
                {open ? (
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                )}
              </button>
              {open && f.data && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <div className="space-y-1.5 pt-3 text-sm">
                    {Object.entries(f.data).map(([key, value]) => (
                      <Row key={key} label={key.replace(/_/g, " ")} value={String(value ?? "—")} />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared components                                                  */
/* ------------------------------------------------------------------ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted shrink-0 w-32 capitalize">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
