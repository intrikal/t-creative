"use client";

/**
 * ClientsPage — Admin client roster and loyalty program management.
 *
 * ## What
 * A two-tab view available to admin users:
 * - "Clients" tab — a searchable, filterable card grid of all studio clients with
 *   inline add/edit/delete dialogs.
 * - "Loyalty" tab — a leaderboard table showing each client's points balance, tier
 *   progress bar, and a per-client "Issue Reward" dialog.
 *
 * ## Why it is client-side only (no server data)
 * This page currently uses hardcoded `INITIAL_CLIENTS` mock data. It is a UI
 * prototype for the admin CRM view — the live version will replace the static
 * array with server-fetched data from `profiles` and `loyalty_transactions`.
 * All mutations (add, edit, delete, issue reward) update local React state only
 * and are not persisted to the database yet.
 *
 * ## Component breakdown
 * - `ClientCard`         — single client tile with hover-reveal edit/delete actions
 * - `ClientFormDialog`   — shared modal for both "Add Client" and "Edit Client" flows
 * - `LoyaltyTab`         — full loyalty leaderboard; contains `IssueRewardDialog`
 * - `IssueRewardDialog`  — reward issuance modal; shows a tier-up celebration when
 *                          adding bonus points pushes a client to the next tier
 * - `ClientsPage`        — root component; owns all state and wires the above together
 *
 * ## Tier configuration
 * `TIER_CONFIG` mirrors the four-tier structure (Bronze → Silver → Gold → Platinum)
 * defined in `ClientHomePage.tsx`. Points thresholds are duplicated here because
 * this file drives the admin-side view independently of the client-side view.
 * A future refactor should extract the shared config to a single constants file.
 *
 * ## Related files
 * - app/dashboard/clients/page.tsx  — Server Component wrapper that renders this
 * - app/client/ClientHomePage.tsx   — Client-side loyalty display (same tier logic)
 * - db/schema/users.ts              — profiles table (eventual data source)
 * - db/schema/loyalty.ts            — loyalty_transactions table
 */
import { useState } from "react";
import {
  Search,
  Star,
  Plus,
  Users,
  TrendingUp,
  DollarSign,
  Pencil,
  Trash2,
  Gift,
  Award,
  Sparkles,
  Cake,
  CalendarDays,
  Tag,
  Zap,
  Crown,
  Scissors,
  BadgeCheck,
  Ticket,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, Field, Input, Select, Textarea, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type ClientSource =
  | "instagram"
  | "tiktok"
  | "pinterest"
  | "word_of_mouth"
  | "google_search"
  | "referral"
  | "website_direct";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

interface Client {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone: string;
  source: ClientSource;
  joinedDate: string;
  vip: boolean;
  services: ServiceCategory[];
  totalBookings: number;
  totalSpent: number;
  lastVisit: string;
  notes?: string;
  referredBy?: string;
}

const INITIAL_CLIENTS: Client[] = [
  {
    id: 1,
    name: "Amara Johnson",
    initials: "AJ",
    email: "amara@example.com",
    phone: "(404) 555-0201",
    source: "instagram",
    joinedDate: "Feb 18, 2025",
    vip: false,
    services: ["lash"],
    totalBookings: 4,
    totalSpent: 620,
    lastVisit: "Feb 18",
  },
  {
    id: 2,
    name: "Destiny Cruz",
    initials: "DC",
    email: "destiny@example.com",
    phone: "(404) 555-0202",
    source: "referral",
    joinedDate: "Jan 5, 2025",
    vip: true,
    services: ["lash", "jewelry"],
    totalBookings: 9,
    totalSpent: 1340,
    lastVisit: "Feb 15",
    referredBy: "Sarah Mitchell",
  },
  {
    id: 3,
    name: "Keisha Williams",
    initials: "KW",
    email: "keisha@example.com",
    phone: "(404) 555-0203",
    source: "word_of_mouth",
    joinedDate: "Jan 20, 2025",
    vip: false,
    services: ["crochet"],
    totalBookings: 3,
    totalSpent: 280,
    lastVisit: "Feb 10",
  },
  {
    id: 4,
    name: "Tanya Brown",
    initials: "TB",
    email: "tanya@example.com",
    phone: "(404) 555-0204",
    source: "google_search",
    joinedDate: "Dec 12, 2024",
    vip: false,
    services: ["consulting"],
    totalBookings: 2,
    totalSpent: 300,
    lastVisit: "Feb 5",
  },
  {
    id: 5,
    name: "Nina Patel",
    initials: "NP",
    email: "nina@example.com",
    phone: "(404) 555-0205",
    source: "instagram",
    joinedDate: "Nov 3, 2024",
    vip: true,
    services: ["jewelry"],
    totalBookings: 7,
    totalSpent: 890,
    lastVisit: "Feb 12",
    notes: "Prefers gold chains",
  },
  {
    id: 6,
    name: "Sarah Mitchell",
    initials: "SM",
    email: "sarah@example.com",
    phone: "(404) 555-0206",
    source: "referral",
    joinedDate: "Oct 18, 2024",
    vip: true,
    services: ["lash"],
    totalBookings: 12,
    totalSpent: 1980,
    lastVisit: "Today",
    referredBy: "Nina Patel",
  },
  {
    id: 7,
    name: "Maya Robinson",
    initials: "MR",
    email: "maya@example.com",
    phone: "(404) 555-0207",
    source: "instagram",
    joinedDate: "Sep 22, 2024",
    vip: false,
    services: ["lash"],
    totalBookings: 8,
    totalSpent: 760,
    lastVisit: "Today",
  },
  {
    id: 8,
    name: "Priya Kumar",
    initials: "PK",
    email: "priya@example.com",
    phone: "(404) 555-0208",
    source: "google_search",
    joinedDate: "Aug 14, 2024",
    vip: false,
    services: ["jewelry"],
    totalBookings: 5,
    totalSpent: 445,
    lastVisit: "Today",
  },
  {
    id: 9,
    name: "Chloe Thompson",
    initials: "CT",
    email: "chloe@example.com",
    phone: "(404) 555-0209",
    source: "word_of_mouth",
    joinedDate: "Jul 30, 2024",
    vip: false,
    services: ["lash"],
    totalBookings: 10,
    totalSpent: 1150,
    lastVisit: "Today",
  },
  {
    id: 10,
    name: "Marcus Banks",
    initials: "MB",
    email: "marcus@example.com",
    phone: "(404) 555-0210",
    source: "instagram",
    joinedDate: "Jun 8, 2024",
    vip: false,
    services: ["consulting"],
    totalBookings: 4,
    totalSpent: 600,
    lastVisit: "Today",
  },
  {
    id: 11,
    name: "Amy Lin",
    initials: "AL",
    email: "amy@example.com",
    phone: "(404) 555-0211",
    source: "website_direct",
    joinedDate: "May 20, 2024",
    vip: false,
    services: ["crochet"],
    totalBookings: 6,
    totalSpent: 480,
    lastVisit: "Today",
  },
  {
    id: 12,
    name: "Jordan Lee",
    initials: "JL",
    email: "jordan@example.com",
    phone: "(404) 555-0212",
    source: "instagram",
    joinedDate: "Apr 11, 2024",
    vip: false,
    services: ["lash"],
    totalBookings: 3,
    totalSpent: 285,
    lastVisit: "Feb 22",
  },
  {
    id: 13,
    name: "Aaliyah Washington",
    initials: "AW",
    email: "aaliyah@example.com",
    phone: "(404) 555-0213",
    source: "referral",
    joinedDate: "Mar 5, 2024",
    vip: true,
    services: ["consulting", "lash"],
    totalBookings: 11,
    totalSpent: 2100,
    lastVisit: "Feb 22",
    referredBy: "Chloe Thompson",
  },
  {
    id: 14,
    name: "Camille Foster",
    initials: "CF",
    email: "camille@example.com",
    phone: "(404) 555-0214",
    source: "instagram",
    joinedDate: "Feb 14, 2024",
    vip: false,
    services: ["jewelry"],
    totalBookings: 4,
    totalSpent: 310,
    lastVisit: "Feb 18",
  },
  {
    id: 15,
    name: "Tiffany Brown",
    initials: "TB2",
    email: "tiffany@example.com",
    phone: "(404) 555-0215",
    source: "google_search",
    joinedDate: "Jan 28, 2024",
    vip: false,
    services: ["lash"],
    totalBookings: 7,
    totalSpent: 1050,
    lastVisit: "Tomorrow",
  },
];

const SOURCE_FILTERS = [
  "All",
  "Instagram",
  "TikTok",
  "Pinterest",
  "Referral",
  "Word of Mouth",
  "Google",
  "Website",
] as const;

/* ------------------------------------------------------------------ */
/*  Display helpers                                                     */
/* ------------------------------------------------------------------ */

function sourceBadge(source: ClientSource) {
  switch (source) {
    case "instagram":
      return { label: "Instagram", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "tiktok":
      return { label: "TikTok", className: "bg-slate-50 text-slate-700 border-slate-100" };
    case "pinterest":
      return { label: "Pinterest", className: "bg-red-50 text-red-700 border-red-100" };
    case "word_of_mouth":
      return { label: "Word of Mouth", className: "bg-teal-50 text-teal-700 border-teal-100" };
    case "google_search":
      return { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-100" };
    case "referral":
      return { label: "Referral", className: "bg-amber-50 text-amber-700 border-amber-100" };
    case "website_direct":
      return { label: "Website", className: "bg-stone-50 text-stone-600 border-stone-100" };
  }
}

const SVC_LABEL: Record<ServiceCategory, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
};

const SVC_COLOR: Record<ServiceCategory, string> = {
  lash: "bg-[#c4907a]/10 text-[#96604a] border-[#c4907a]/20",
  jewelry: "bg-[#d4a574]/10 text-[#a07040] border-[#d4a574]/20",
  crochet: "bg-[#7ba3a3]/10 text-[#3a6a6a] border-[#7ba3a3]/20",
  consulting: "bg-[#5b8a8a]/10 text-[#3a6a6a] border-[#5b8a8a]/20",
};

function initials(name: string) {
  return name
    .trim()
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Avatar color based on initials                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Client form dialog (shared for add + edit)                         */
/* ------------------------------------------------------------------ */

interface ClientForm {
  name: string;
  email: string;
  phone: string;
  source: ClientSource;
  referredBy: string;
  services: string;
  notes: string;
  vip: boolean;
}

const BLANK_FORM: ClientForm = {
  name: "",
  email: "",
  phone: "",
  source: "instagram",
  referredBy: "",
  services: "",
  notes: "",
  vip: false,
};

function ClientFormDialog({
  open,
  title,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial: ClientForm;
  onClose: () => void;
  onSave: (f: ClientForm) => void;
}) {
  const [form, setForm] = useState<ClientForm>(initial);
  const set = (k: keyof ClientForm) => (v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <Field label="Full name" required>
          <Input
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="e.g. Amara Johnson"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              placeholder="email@example.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </Field>
        </div>

        <Field label="How did they find you?">
          <Select
            value={form.source}
            onChange={(e) => set("source")(e.target.value as ClientSource)}
          >
            <option value="instagram">Instagram</option>
            <option value="word_of_mouth">Word of Mouth</option>
            <option value="google_search">Google Search</option>
            <option value="referral">Referral</option>
            <option value="website_direct">Website Direct</option>
          </Select>
        </Field>

        {form.source === "referral" && (
          <Field label="Referred by">
            <Input
              value={form.referredBy}
              onChange={(e) => set("referredBy")(e.target.value)}
              placeholder="e.g. Sarah Mitchell"
            />
          </Field>
        )}

        <Field label="Services" hint="Comma-separated: lash, jewelry, crochet, consulting">
          <Input
            value={form.services}
            onChange={(e) => set("services")(e.target.value)}
            placeholder="lash, jewelry"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes")(e.target.value)}
            placeholder="Allergies, preferences, etc."
            rows={2}
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.vip}
            onChange={(e) => set("vip")(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          <span className="text-sm text-foreground">Mark as VIP client</span>
          <Star className="w-3.5 h-3.5 text-[#d4a574] fill-[#d4a574]" />
        </label>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={() => onSave(form)}
        confirmLabel="Save"
        disabled={!form.name.trim()}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Client card                                                         */
/* ------------------------------------------------------------------ */

function ClientCard({
  client,
  onEdit,
  onDelete,
}: {
  client: Client;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  const src = sourceBadge(client.source);
  const av = avatarColor(client.name);

  return (
    <div className="group relative flex flex-col gap-3 p-4 rounded-xl border border-border bg-background hover:shadow-sm transition-all">
      {/* Actions — hover reveal */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(client)}
          className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(client)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top row: avatar + name */}
      <div className="flex items-start gap-3">
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarFallback className={cn("text-xs font-semibold", av)}>
            {client.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 pr-12">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground leading-tight">
              {client.name}
            </span>
            {client.vip && <Star className="w-3 h-3 text-[#d4a574] fill-[#d4a574] shrink-0" />}
          </div>
          <p className="text-xs text-muted truncate mt-0.5">{client.email}</p>
          <p className="text-xs text-muted">{client.phone}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge className={cn("border text-[10px] px-1.5 py-0.5 font-medium", src.className)}>
          {src.label}
        </Badge>
        {client.services.map((s) => (
          <span
            key={s}
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
              SVC_COLOR[s],
            )}
          >
            {SVC_LABEL[s]}
          </span>
        ))}
      </div>

      {/* Referred by */}
      {client.source === "referral" && client.referredBy && (
        <p className="text-[10px] text-muted -mt-1">
          Referred by <span className="font-medium text-foreground">{client.referredBy}</span>
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-0 pt-2.5 border-t border-border/50">
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{client.totalBookings}</p>
          <p className="text-[10px] text-muted mt-0.5">Visits</p>
        </div>
        <div className="text-center border-x border-border/50">
          <p className="text-sm font-semibold text-foreground">
            ${client.totalSpent.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted mt-0.5">Spent</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground truncate">{client.lastVisit}</p>
          <p className="text-[10px] text-muted mt-0.5">Last visit</p>
        </div>
      </div>

      {/* Notes */}
      {client.notes && (
        <p className="text-[10px] text-muted italic truncate border-t border-border/40 pt-2">
          {client.notes}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loyalty tab                                                        */
/* ------------------------------------------------------------------ */

interface LoyaltyEntry {
  id: number;
  name: string;
  initials: string;
  points: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  totalSpent: number;
  lastActivity: string;
  pointsToNext: number;
}

// $1 spent = 1 point. Tiers based on lifetime points.
const TIER_CONFIG = {
  bronze: {
    label: "Bronze",
    color: "text-[#a07040]",
    bg: "bg-[#a07040]/10",
    border: "border-[#a07040]/20",
    minPoints: 0,
    nextPoints: 300,
  },
  silver: {
    label: "Silver",
    color: "text-muted",
    bg: "bg-foreground/8",
    border: "border-foreground/15",
    minPoints: 300,
    nextPoints: 700,
  },
  gold: {
    label: "Gold",
    color: "text-[#d4a574]",
    bg: "bg-[#d4a574]/10",
    border: "border-[#d4a574]/20",
    minPoints: 700,
    nextPoints: 1500,
  },
  platinum: {
    label: "Platinum",
    color: "text-[#5b8a8a]",
    bg: "bg-[#5b8a8a]/10",
    border: "border-[#5b8a8a]/20",
    minPoints: 1500,
    nextPoints: null,
  },
};

const TIER_PERKS: Record<string, { perk: string; Icon: LucideIcon }[]> = {
  bronze: [
    { perk: "5% off on your birthday", Icon: Cake },
    { perk: "Early booking access", Icon: CalendarDays },
  ],
  silver: [
    { perk: "10% off 1 service per month", Icon: Tag },
    { perk: "Free lash bath add-on", Icon: Sparkles },
    { perk: "All Bronze perks", Icon: ChevronRight },
  ],
  gold: [
    { perk: "15% off all services", Icon: Tag },
    { perk: "Free add-on every visit", Icon: Gift },
    { perk: "Priority booking", Icon: Zap },
    { perk: "All Silver perks", Icon: ChevronRight },
  ],
  platinum: [
    { perk: "20% off all services", Icon: Crown },
    { perk: "1 complimentary service/mo", Icon: Scissors },
    { perk: "VIP event invites", Icon: Ticket },
    { perk: "All Gold perks", Icon: ChevronRight },
  ],
};

function getTier(points: number): "bronze" | "silver" | "gold" | "platinum" {
  if (points >= 1500) return "platinum";
  if (points >= 700) return "gold";
  if (points >= 300) return "silver";
  return "bronze";
}

const LOYALTY_DATA: LoyaltyEntry[] = INITIAL_CLIENTS.map((c) => {
  const points = c.totalSpent; // $1 = 1 point
  const tier = getTier(points);
  const nextPoints = TIER_CONFIG[tier].nextPoints;
  const pointsToNext = nextPoints ? Math.max(0, nextPoints - points) : 0;
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    points,
    tier,
    totalSpent: c.totalSpent,
    lastActivity: c.lastVisit,
    pointsToNext,
  };
}).sort((a, b) => b.points - a.points);

type RewardType = "discount" | "addon" | "service" | "points";

const REWARD_OPTIONS: { id: RewardType; label: string; desc: string; Icon: LucideIcon }[] = [
  { id: "discount", label: "Discount", desc: "$ or % off their next visit", Icon: Tag },
  { id: "addon", label: "Free Add-on", desc: "Complimentary upgrade or add-on", Icon: Sparkles },
  { id: "service", label: "Free Service", desc: "One service on the house", Icon: Scissors },
  { id: "points", label: "Bonus Points", desc: "Manually add points to balance", Icon: Zap },
];

function IssueRewardDialog({
  name,
  points,
  onClose,
  onIssue,
}: {
  name: string;
  points: number;
  onClose: () => void;
  onIssue: (
    type: RewardType,
    amount: string,
    note: string,
  ) => { tieredUp: boolean; newTier: LoyaltyEntry["tier"] } | void;
}) {
  const [type, setType] = useState<RewardType>("discount");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [issued, setIssued] = useState<{ tieredUp: boolean; newTier: LoyaltyEntry["tier"] } | null>(
    null,
  );

  const handleConfirm = () => {
    const result = onIssue(type, amount, note);
    setIssued(result ?? { tieredUp: false, newTier: getTier(points) });
  };

  if (issued) {
    const cfg = TIER_CONFIG[issued.newTier];
    return (
      <Dialog open onClose={onClose} title="Reward Issued" size="sm">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              issued.tieredUp ? cfg.bg : "bg-[#4e6b51]/15",
            )}
          >
            {issued.tieredUp ? (
              <Award className={cn("w-6 h-6", cfg.color)} />
            ) : (
              <BadgeCheck className="w-6 h-6 text-[#4e6b51]" />
            )}
          </div>
          {issued.tieredUp ? (
            <>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold",
                  cfg.color,
                  cfg.bg,
                  cfg.border,
                )}
              >
                <Award className={cn("w-3.5 h-3.5", cfg.color)} />
                {cfg.label} Tier Unlocked!
              </div>
              <p className="text-sm font-semibold text-foreground">{name} leveled up!</p>
              <p className="text-xs text-muted leading-relaxed">
                They&apos;ve crossed into{" "}
                <span className={cn("font-semibold", cfg.color)}>{cfg.label}</span> and now have
                access to their new tier perks.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Reward sent to {name}!</p>
              <p className="text-xs text-muted">
                They&apos;ll receive a notification with their reward details.
              </p>
            </>
          )}
        </div>
        <DialogFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Done" />
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title={`Issue Reward — ${name}`} size="md">
      <div className="space-y-4">
        {/* Points balance callout */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border">
          <Award className="w-3.5 h-3.5 text-muted shrink-0" />
          <span className="text-xs text-muted">Current balance: </span>
          <span className="text-xs font-semibold text-foreground">
            {points.toLocaleString()} pts
          </span>
          {points >= 500 && (
            <span className="ml-auto text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 px-2 py-0.5 rounded-full border border-[#4e6b51]/20">
              Can redeem
            </span>
          )}
        </div>

        {/* Reward type */}
        <div>
          <p className="text-xs font-medium text-muted mb-2">Reward type</p>
          <div className="grid grid-cols-2 gap-2">
            {REWARD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setType(opt.id)}
                className={cn(
                  "flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all",
                  type === opt.id
                    ? "border-accent bg-accent/8"
                    : "border-border hover:border-foreground/20 hover:bg-foreground/4",
                )}
              >
                <opt.Icon
                  className={cn(
                    "w-3.5 h-3.5 mt-0.5 shrink-0",
                    type === opt.id ? "text-accent" : "text-muted",
                  )}
                />
                <div>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      type === opt.id ? "text-accent" : "text-foreground",
                    )}
                  >
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-muted leading-tight mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        {(type === "discount" || type === "points") && (
          <Field label={type === "discount" ? "Amount (e.g. $10 or 15%)" : "Points to add"}>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={type === "discount" ? "$10 or 15%" : "e.g. 100"}
              autoFocus
            />
          </Field>
        )}

        {/* Note */}
        <Field label="Note to client" hint="Optional — shown in their reward notification">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Thank you for being a loyal client!"
            rows={2}
          />
        </Field>
      </div>
      <DialogFooter onCancel={onClose} onConfirm={handleConfirm} confirmLabel="Issue Reward" />
    </Dialog>
  );
}

function LoyaltyTab() {
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyEntry[]>(LOYALTY_DATA);
  const [showPerks, setShowPerks] = useState(false);
  const [issueTarget, setIssueTarget] = useState<LoyaltyEntry | null>(null);

  const handleIssue = (id: number, type: RewardType, amount: string) => {
    if (type !== "points") return;
    const pts = parseInt(amount, 10);
    if (!pts || isNaN(pts) || pts <= 0) return;

    const entry = loyaltyData.find((l) => l.id === id);
    if (!entry) return;

    const newPoints = entry.points + pts;
    const newTier = getTier(newPoints);
    const tieredUp = newTier !== entry.tier;
    const nextPoints = TIER_CONFIG[newTier].nextPoints;

    setLoyaltyData((prev) =>
      prev
        .map((l) =>
          l.id === id
            ? {
                ...l,
                points: newPoints,
                tier: newTier,
                pointsToNext: nextPoints ? Math.max(0, nextPoints - newPoints) : 0,
              }
            : l,
        )
        .sort((a, b) => b.points - a.points),
    );

    // Also update issueTarget so the dialog's balance callout is current if re-opened
    setIssueTarget((prev) =>
      prev && prev.id === id ? { ...prev, points: newPoints, tier: newTier } : prev,
    );

    return { tieredUp, newTier };
  };

  const totals = {
    enrolled: loyaltyData.length,
    redeemable: loyaltyData.filter((l) => l.points >= 500).length,
    totalPoints: loyaltyData.reduce((s, l) => s + l.points, 0),
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Loyalty Program</h2>
          <p className="text-xs text-muted mt-0.5">
            $1 spent = 1 point · 500 pts = $5 off · Tiers unlock perks automatically
          </p>
        </div>
        <button
          onClick={() => setShowPerks((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {showPerks ? "Hide Perks" : "View Rewards"}
        </button>
      </div>

      {/* Perks panel */}
      {showPerks && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["bronze", "silver", "gold", "platinum"] as const).map((tier) => {
            const cfg = TIER_CONFIG[tier];
            const perks = TIER_PERKS[tier];
            return (
              <div key={tier} className={cn("rounded-xl border p-3 space-y-2", cfg.bg, cfg.border)}>
                <div className="flex items-center gap-1.5">
                  <Award className={cn("w-3.5 h-3.5", cfg.color)} />
                  <p className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</p>
                  <span className="text-[10px] text-muted ml-auto">
                    {cfg.nextPoints ? `${cfg.minPoints}–${cfg.nextPoints}` : `${cfg.minPoints}+`}{" "}
                    pts
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {perks.map((p) => (
                    <li
                      key={p.perk}
                      className="flex items-center gap-1.5 text-[11px] text-foreground/80"
                    >
                      <p.Icon className={cn("w-3 h-3 shrink-0", cfg.color)} />
                      <span>{p.perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Tier summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["bronze", "silver", "gold", "platinum"] as const).map((tier) => {
          const cfg = TIER_CONFIG[tier];
          const count = loyaltyData.filter((l) => l.tier === tier).length;
          return (
            <div key={tier} className={cn("rounded-xl border p-3", cfg.bg, cfg.border)}>
              <div className="flex items-center gap-1.5 mb-2">
                <Award className={cn("w-3.5 h-3.5", cfg.color)} />
                <p className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</p>
              </div>
              <p className="text-2xl font-semibold text-foreground">{count}</p>
              <p className="text-[10px] text-muted mt-0.5">
                {cfg.nextPoints
                  ? `${cfg.minPoints}–${cfg.nextPoints} pts`
                  : `${cfg.minPoints}+ pts`}
              </p>
            </div>
          );
        })}
      </div>

      {/* Members table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">All Members</p>
          <span className="text-[10px] text-muted">
            {totals.enrolled} enrolled · {totals.redeemable} can redeem now ·{" "}
            {totals.totalPoints.toLocaleString()} pts total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                  Client
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                  Tier
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                  Progress
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5 hidden md:table-cell">
                  Total Spent
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 hidden md:table-cell">
                  Last Visit
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                  Issue
                </th>
              </tr>
            </thead>
            <tbody>
              {loyaltyData.map((l) => {
                const cfg = TIER_CONFIG[l.tier];
                const av = avatarColor(l.name);
                const canRedeem = l.points >= 500;
                // progress within current tier
                const tierMin = cfg.minPoints;
                const tierMax = cfg.nextPoints ?? cfg.minPoints + 1500;
                const pct = Math.min(
                  100,
                  Math.round(((l.points - tierMin) / (tierMax - tierMin)) * 100),
                );
                return (
                  <tr
                    key={l.id}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                            av,
                          )}
                        >
                          {l.initials}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{l.name}</span>
                          {canRedeem && (
                            <span className="ml-2 text-[9px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 px-1.5 py-0.5 rounded-full border border-[#4e6b51]/20">
                              Redeemable
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span
                        className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                          cfg.color,
                          cfg.bg,
                          cfg.border,
                        )}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              l.tier === "platinum"
                                ? "bg-[#5b8a8a]"
                                : l.tier === "gold"
                                  ? "bg-[#d4a574]"
                                  : l.tier === "silver"
                                    ? "bg-foreground/30"
                                    : "bg-[#a07040]",
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted tabular-nums whitespace-nowrap">
                          {l.tier === "platinum"
                            ? `${l.points.toLocaleString()} pts`
                            : `${l.points}/${cfg.nextPoints}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right align-middle hidden md:table-cell">
                      <span className="text-sm text-foreground tabular-nums">
                        ${l.totalSpent.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle hidden md:table-cell">
                      <span className="text-xs text-muted">{l.lastActivity}</span>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <button
                        onClick={() => setIssueTarget(l)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/15 transition-colors mx-auto"
                      >
                        <Gift className="w-3 h-3" />
                        Issue
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue reward dialog */}
      {issueTarget && (
        <IssueRewardDialog
          name={issueTarget.name}
          points={issueTarget.points}
          onClose={() => setIssueTarget(null)}
          onIssue={(type, amount, _note) => handleIssue(issueTarget.id, type, amount)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                                */
/* ------------------------------------------------------------------ */

const CLIENTS_TABS = [
  { id: "clients", label: "Clients" },
  { id: "loyalty", label: "Loyalty" },
] as const;
type ClientsTab = (typeof CLIENTS_TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  ClientsPage                                                         */
/* ------------------------------------------------------------------ */

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [vipOnly, setVipOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientsTab>("clients");

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [formInitial, setFormInitial] = useState<ClientForm>(BLANK_FORM);

  const filtered = clients.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === "All" || sourceBadge(c.source).label === sourceFilter;
    const matchVip = !vipOnly || c.vip;
    return matchSearch && matchSource && matchVip;
  });

  const vipCount = clients.filter((c) => c.vip).length;
  const totalRevenue = clients.reduce((s, c) => s + c.totalSpent, 0);
  const avgSpend = clients.length ? Math.round(totalRevenue / clients.length) : 0;

  const openAdd = () => {
    setEditTarget(null);
    setFormInitial(BLANK_FORM);
    setFormOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditTarget(c);
    setFormInitial({
      name: c.name,
      email: c.email,
      phone: c.phone,
      source: c.source,
      referredBy: c.referredBy ?? "",
      services: c.services.join(", "),
      notes: c.notes ?? "",
      vip: c.vip,
    });
    setFormOpen(true);
  };

  const handleSave = (f: ClientForm) => {
    const ini = initials(f.name);
    const svcList = f.services
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as ServiceCategory[];
    if (editTarget) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === editTarget.id
            ? {
                ...c,
                name: f.name,
                initials: ini,
                email: f.email,
                phone: f.phone,
                source: f.source,
                referredBy: f.referredBy || undefined,
                services: svcList,
                notes: f.notes || undefined,
                vip: f.vip,
              }
            : c,
        ),
      );
    } else {
      setClients((prev) => [
        {
          id: Date.now(),
          name: f.name,
          initials: ini,
          email: f.email,
          phone: f.phone,
          source: f.source,
          referredBy: f.referredBy || undefined,
          vip: f.vip,
          services: svcList,
          notes: f.notes || undefined,
          totalBookings: 0,
          totalSpent: 0,
          joinedDate: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          lastVisit: "—",
        },
        ...prev,
      ]);
    }
    setFormOpen(false);
  };

  const handleDelete = (c: Client) => {
    setClients((prev) => prev.filter((cl) => cl.id !== c.id));
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Clients</h1>
          <p className="text-sm text-muted mt-0.5">{clients.length} total clients</p>
        </div>
        {activeTab === "clients" && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        )}
      </div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border -mt-2">
        {CLIENTS_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === "loyalty" && <LoyaltyTab />}
      {activeTab === "clients" && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-muted" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Total
                  </p>
                </div>
                <p className="text-2xl font-semibold text-foreground">{clients.length}</p>
                <p className="text-xs text-muted mt-0.5">+3 this week</p>
              </CardContent>
            </Card>
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Star className="w-3.5 h-3.5 text-[#d4a574]" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    VIP
                  </p>
                </div>
                <p className="text-2xl font-semibold text-foreground">{vipCount}</p>
                <p className="text-xs text-muted mt-0.5">top clients</p>
              </CardContent>
            </Card>
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-muted" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Revenue
                  </p>
                </div>
                <p className="text-2xl font-semibold text-foreground">
                  ${totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-muted mt-0.5">all time</p>
              </CardContent>
            </Card>
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-muted" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Avg Spend
                  </p>
                </div>
                <p className="text-2xl font-semibold text-foreground">${avgSpend}</p>
                <p className="text-xs text-muted mt-0.5">per client</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
              />
            </div>
            <div className="flex gap-1 flex-wrap items-center">
              {SOURCE_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    sourceFilter === s
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => setVipOnly(!vipOnly)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  vipOnly
                    ? "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/25"
                    : "text-muted border-transparent hover:text-foreground",
                )}
              >
                <Star className={cn("w-3 h-3", vipOnly && "fill-[#d4a574] text-[#d4a574]")} />
                VIP only
              </button>
              <span className="text-xs text-muted ml-auto sm:ml-2">
                {filtered.length} of {clients.length}
              </span>
            </div>
          </div>

          {/* Client grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted">No clients match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}{" "}
      {/* end activeTab === "clients" */}
      {/* Form dialog */}
      {formOpen && (
        <ClientFormDialog
          key={editTarget?.id ?? "new"}
          open
          title={editTarget ? "Edit Client" : "Add Client"}
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
