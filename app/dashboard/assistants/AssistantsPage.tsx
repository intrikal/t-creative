"use client";

import { useState } from "react";
import {
  UserCheck,
  Clock,
  Star,
  Calendar,
  Award,
  DollarSign,
  Plus,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Download,
  CheckSquare,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, Field, Input, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

type AssistantStatus = "active" | "on_leave" | "inactive";
type Skill = "lash" | "jewelry" | "crochet" | "consulting" | "training" | "events" | "admin";
type ShiftDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

const ALL_DAYS: ShiftDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Session {
  id: number;
  clientName: string;
  service: string;
  date: string;
  revenue: number;
  rating: number | null;
}

interface Assistant {
  id: number;
  name: string;
  initials: string;
  role: string;
  status: AssistantStatus;
  phone: string;
  email: string;
  skills: Skill[];
  shifts: ShiftDay[];
  hours: string;
  hireDate: string;
  totalSessions: number;
  totalRevenue: number;
  avgRating: number;
  thisMonthSessions: number;
  certifications: string[];
  recentSessions: Session[];
}

const INITIAL_ASSISTANTS: Assistant[] = [
  {
    id: 1,
    name: "Jasmine Carter",
    initials: "JC",
    role: "Lead Lash Technician",
    status: "active",
    phone: "(555) 201-4587",
    email: "jasmine@tcreative.studio",
    skills: ["lash", "training"],
    shifts: ["Tue", "Wed", "Thu", "Fri", "Sat"],
    hours: "10:00 AM – 6:00 PM",
    hireDate: "Jan 2023",
    totalSessions: 312,
    totalRevenue: 24680,
    avgRating: 4.9,
    thisMonthSessions: 28,
    certifications: ["Volume Lashes Pro", "Lash Lift Certified"],
    recentSessions: [
      {
        id: 1,
        clientName: "Priya K.",
        service: "Volume Full Set",
        date: "Today, 1:00 PM",
        revenue: 175,
        rating: null,
      },
      {
        id: 2,
        clientName: "Mia L.",
        service: "Classic Fill",
        date: "Yesterday",
        revenue: 85,
        rating: 5,
      },
      {
        id: 3,
        clientName: "Diana R.",
        service: "Mega Volume Set",
        date: "2 days ago",
        revenue: 200,
        rating: 5,
      },
    ],
  },
  {
    id: 2,
    name: "Brianna Moss",
    initials: "BM",
    role: "Jewelry & Crochet Artist",
    status: "active",
    phone: "(555) 378-9120",
    email: "brianna@tcreative.studio",
    skills: ["jewelry", "crochet", "events"],
    shifts: ["Mon", "Wed", "Fri", "Sat"],
    hours: "11:00 AM – 5:00 PM",
    hireDate: "Apr 2023",
    totalSessions: 189,
    totalRevenue: 14230,
    avgRating: 4.8,
    thisMonthSessions: 21,
    certifications: ["Permanent Jewelry Certified"],
    recentSessions: [
      {
        id: 1,
        clientName: "Chloe T.",
        service: "Perm Jewelry Weld",
        date: "Today, 3:00 PM",
        revenue: 65,
        rating: null,
      },
      {
        id: 2,
        clientName: "Amy L.",
        service: "Custom Crochet Pickup",
        date: "Yesterday",
        revenue: 120,
        rating: 5,
      },
      {
        id: 3,
        clientName: "Kim P.",
        service: "Perm Jewelry — Anklet",
        date: "3 days ago",
        revenue: 70,
        rating: 4,
      },
    ],
  },
  {
    id: 3,
    name: "Simone Owens",
    initials: "SO",
    role: "Admin & Client Relations",
    status: "active",
    phone: "(555) 445-6677",
    email: "simone@tcreative.studio",
    skills: ["admin", "consulting"],
    shifts: ["Mon", "Tue", "Thu", "Fri"],
    hours: "9:00 AM – 3:00 PM",
    hireDate: "Sep 2023",
    totalSessions: 94,
    totalRevenue: 8150,
    avgRating: 4.7,
    thisMonthSessions: 14,
    certifications: ["Business Admin Certificate"],
    recentSessions: [
      {
        id: 1,
        clientName: "Marcus B.",
        service: "Consulting Session",
        date: "Yesterday",
        revenue: 150,
        rating: 5,
      },
      {
        id: 2,
        clientName: "Tanya B.",
        service: "Client Intake",
        date: "2 days ago",
        revenue: 0,
        rating: null,
      },
      {
        id: 3,
        clientName: "Nina P.",
        service: "Consulting Session",
        date: "Last week",
        revenue: 150,
        rating: 4,
      },
    ],
  },
  {
    id: 4,
    name: "Kezia Thompson",
    initials: "KT",
    role: "Lash Technician — Junior",
    status: "on_leave",
    phone: "(555) 512-3344",
    email: "kezia@tcreative.studio",
    skills: ["lash"],
    shifts: ["Wed", "Thu", "Sat"],
    hours: "10:00 AM – 6:00 PM",
    hireDate: "Nov 2023",
    totalSessions: 67,
    totalRevenue: 5420,
    avgRating: 4.6,
    thisMonthSessions: 0,
    certifications: ["Classic Lashes Certified"],
    recentSessions: [],
  },
];

const COMMISSION_DATA = [
  {
    id: 1,
    name: "Jasmine Carter",
    initials: "JC",
    rate: 30,
    sessions: 28,
    revenue: 4900,
    earned: 1470,
    paidOut: 1200,
  },
  {
    id: 2,
    name: "Brianna Moss",
    initials: "BM",
    rate: 28,
    sessions: 21,
    revenue: 2100,
    earned: 588,
    paidOut: 500,
  },
  {
    id: 3,
    name: "Simone Owens",
    initials: "SO",
    rate: 25,
    sessions: 14,
    revenue: 1850,
    earned: 462,
    paidOut: 400,
  },
  {
    id: 4,
    name: "Kezia Thompson",
    initials: "KT",
    rate: 25,
    sessions: 0,
    revenue: 0,
    earned: 0,
    paidOut: 0,
  },
];

/* ------------------------------------------------------------------ */
/*  Stat summary                                                        */
/* ------------------------------------------------------------------ */

const TEAM_STATS = [
  {
    label: "Total Assistants",
    value: "4",
    sub: "3 active · 1 on leave",
    icon: UserCheck,
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    label: "Sessions This Month",
    value: "63",
    sub: "↑ 9% vs last month",
    icon: Calendar,
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
  },
  {
    label: "Avg. Rating",
    value: "4.8",
    sub: "Across all assistants",
    icon: Star,
    color: "text-[#d4a574]",
    bg: "bg-[#d4a574]/10",
  },
  {
    label: "Team Revenue",
    value: "$52,480",
    sub: "All time combined",
    icon: DollarSign,
    color: "text-blush",
    bg: "bg-blush/10",
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function statusConfig(status: AssistantStatus) {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "on_leave":
      return { label: "On Leave", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "inactive":
      return { label: "Inactive", className: "bg-foreground/8 text-muted border-foreground/12" };
  }
}

function skillTag(skill: Skill) {
  const map: Record<Skill, { label: string; className: string }> = {
    lash: { label: "Lash", className: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20" },
    jewelry: { label: "Jewelry", className: "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/20" },
    crochet: { label: "Crochet", className: "bg-[#7ba3a3]/12 text-[#4a7a7a] border-[#7ba3a3]/20" },
    consulting: {
      label: "Consulting",
      className: "bg-[#5b8a8a]/12 text-[#3a6a6a] border-[#5b8a8a]/20",
    },
    training: { label: "Training", className: "bg-accent/12 text-accent border-accent/20" },
    events: { label: "Events", className: "bg-purple-50 text-purple-700 border-purple-100" },
    admin: { label: "Admin", className: "bg-foreground/8 text-muted border-foreground/12" },
  };
  return map[skill];
}

function ratingStars(rating: number) {
  return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
}

/* ------------------------------------------------------------------ */
/*  AssistantCard                                                       */
/* ------------------------------------------------------------------ */

function AssistantCard({ assistant }: { assistant: Assistant }) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig(assistant.status);

  return (
    <Card className="gap-0">
      <CardContent className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-4">
          <Avatar className="w-12 h-12 shrink-0">
            <AvatarFallback className="text-sm bg-surface text-muted font-semibold">
              {assistant.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">{assistant.name}</h3>
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", status.className)}>
                {status.label}
              </Badge>
            </div>
            <p className="text-xs text-muted mt-0.5">{assistant.role}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {assistant.skills.map((s) => {
                const sk = skillTag(s);
                return (
                  <span
                    key={s}
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                      sk.className,
                    )}
                  >
                    {sk.label}
                  </span>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/60">
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{assistant.thisMonthSessions}</p>
            <p className="text-[10px] text-muted mt-0.5">Sessions</p>
          </div>
          <div className="text-center border-x border-border/60">
            <p className="text-base font-semibold text-foreground flex items-center justify-center gap-0.5">
              {assistant.avgRating}
              <Star className="w-3 h-3 text-[#d4a574] fill-[#d4a574]" />
            </p>
            <p className="text-[10px] text-muted mt-0.5">Avg Rating</p>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">
              ${assistant.totalRevenue.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted mt-0.5">All-Time Rev</p>
          </div>
        </div>
      </CardContent>

      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Contact</p>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
              {assistant.phone}
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Mail className="w-3.5 h-3.5 text-muted shrink-0" />
              {assistant.email}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
              Shifts
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map((day) => (
                <span
                  key={day}
                  className={cn(
                    "text-[11px] font-medium px-2 py-1 rounded-md border",
                    assistant.shifts.includes(day)
                      ? "bg-foreground/8 text-foreground border-foreground/12"
                      : "bg-transparent text-muted/40 border-border/40",
                  )}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
          {assistant.certifications.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
                Certifications
              </p>
              <div className="space-y-1">
                {assistant.certifications.map((cert) => (
                  <div key={cert} className="flex items-center gap-2 text-xs text-foreground">
                    <Award className="w-3.5 h-3.5 text-[#d4a574] shrink-0" />
                    {cert}
                  </div>
                ))}
              </div>
            </div>
          )}
          {assistant.recentSessions.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
                Recent Sessions
              </p>
              <div className="space-y-2">
                {assistant.recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{session.service}</p>
                      <p className="text-muted">
                        {session.clientName} · {session.date}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {session.revenue > 0 && (
                        <p className="font-medium text-foreground">${session.revenue}</p>
                      )}
                      {session.rating !== null && (
                        <div className="flex items-center gap-0.5 justify-end mt-0.5">
                          {ratingStars(session.rating).map((filled, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-2.5 h-2.5",
                                filled ? "text-[#d4a574] fill-[#d4a574]" : "text-muted",
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted pt-1 border-t border-border/50">
            <Clock className="w-3.5 h-3.5" />
            Hired {assistant.hireDate} · {assistant.totalSessions} total sessions
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Add assistant dialog                                                */
/* ------------------------------------------------------------------ */

function AddAssistantDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (
    a: Omit<
      Assistant,
      "id" | "totalSessions" | "totalRevenue" | "avgRating" | "thisMonthSessions" | "recentSessions"
    >,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AssistantStatus>("active");
  const [skills, setSkills] = useState("");
  const [shifts, setShifts] = useState("");
  const [certs, setCerts] = useState("");

  return (
    <Dialog open={open} onClose={onClose} title="Add Assistant" size="lg">
      <div className="space-y-4" key={String(open)}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jasmine Carter"
              autoFocus
            />
          </Field>
          <Field label="Role / title" required>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Lead Lash Technician"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@tcreative.studio"
            />
          </Field>
        </div>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as AssistantStatus)}>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field
          label="Skills"
          hint="Comma-separated: lash, jewelry, crochet, consulting, training, events, admin"
        >
          <Input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="lash, training"
          />
        </Field>
        <Field label="Shifts" hint="Comma-separated days: Mon, Tue, Wed, Thu, Fri, Sat, Sun">
          <Input
            value={shifts}
            onChange={(e) => setShifts(e.target.value)}
            placeholder="Mon, Wed, Fri, Sat"
          />
        </Field>
        <Field label="Certifications" hint="Comma-separated">
          <Input
            value={certs}
            onChange={(e) => setCerts(e.target.value)}
            placeholder="Volume Lashes Pro, Lash Lift Certified"
          />
        </Field>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!name.trim()) return;
            const initials = name
              .trim()
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const parseList = (s: string) =>
              s
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
            onSave({
              name: name.trim(),
              initials,
              role: role.trim(),
              status,
              phone: phone.trim(),
              email: email.trim(),
              skills: parseList(skills) as Skill[],
              shifts: parseList(shifts) as ShiftDay[],
              hours: "9:00 AM – 5:00 PM",
              hireDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              certifications: parseList(certs),
            });
            onClose();
          }}
          confirmLabel="Add assistant"
          disabled={!name.trim() || !role.trim()}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

const PAGE_TABS = ["Roster", "Availability", "Commissions", "Payroll"] as const;
type PageTab = (typeof PAGE_TABS)[number];

export function AssistantsPage() {
  const [assistants, setAssistants] = useState<Assistant[]>(INITIAL_ASSISTANTS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pageTab, setPageTab] = useState<PageTab>("Roster");

  const totalCommissionBalance = COMMISSION_DATA.reduce((s, c) => s + (c.earned - c.paidOut), 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Assistants</h1>
          <p className="text-sm text-muted mt-0.5">Your team overview and performance</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Assistant
        </button>
      </div>

      {/* Team stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TEAM_STATS.map((stat) => (
          <Card key={stat.label} className="gap-0 py-4">
            <CardContent className="px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-semibold text-foreground mt-1">{stat.value}</p>
                  <p className="text-[10px] text-muted mt-1">{stat.sub}</p>
                </div>
                <div className={cn("rounded-xl p-2 shrink-0", stat.bg)}>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {PAGE_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setPageTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              pageTab === t
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Roster ── */}
      {pageTab === "Roster" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {assistants.map((a) => (
            <AssistantCard key={a.id} assistant={a} />
          ))}
        </div>
      )}

      {/* ── Availability ── */}
      {pageTab === "Availability" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4 md:px-5">
            <CardTitle className="text-sm font-semibold">Weekly Availability</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Assistant
                    </th>
                    {ALL_DAYS.map((d) => (
                      <th
                        key={d}
                        className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-2 pb-2.5"
                      >
                        {d}
                      </th>
                    ))}
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5 hidden lg:table-cell">
                      Hours
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assistants.map((a) => {
                    const st = statusConfig(a.status);
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      >
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                                {a.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">{a.name}</p>
                              <Badge
                                className={cn(
                                  "border text-[10px] px-1.5 py-0 mt-0.5",
                                  st.className,
                                )}
                              >
                                {st.label}
                              </Badge>
                            </div>
                          </div>
                        </td>
                        {ALL_DAYS.map((day) => {
                          const works = a.status !== "on_leave" && a.shifts.includes(day);
                          return (
                            <td key={day} className="px-2 py-3 text-center align-middle">
                              {a.status === "on_leave" ? (
                                <span className="text-muted/30 text-xs">—</span>
                              ) : works ? (
                                <CheckCircle2 className="w-4 h-4 text-[#4e6b51] mx-auto" />
                              ) : (
                                <span className="w-4 h-4 block mx-auto rounded-full bg-border/50" />
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 md:px-5 py-3 align-middle hidden lg:table-cell">
                          {a.status === "on_leave" ? (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-[#7a5c10]" /> On leave
                            </span>
                          ) : (
                            <span className="text-xs text-muted">{a.hours}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Commissions ── */}
      {pageTab === "Commissions" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4 md:px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Commissions — This Month</CardTitle>
              <span className="text-xs text-muted">
                ${totalCommissionBalance.toLocaleString()} balance outstanding
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Assistant
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Rate
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Sessions
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Revenue
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Earned
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                      Paid Out
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMMISSION_DATA.map((c) => {
                    const balance = c.earned - c.paidOut;
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      >
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                                {c.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <span className="text-xs font-semibold text-foreground">{c.rate}%</span>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <span className="text-sm text-foreground tabular-nums">{c.sessions}</span>
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <span className="text-sm text-foreground tabular-nums">
                            ${c.revenue.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            ${c.earned.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right align-middle hidden lg:table-cell">
                          <span className="text-sm text-muted tabular-nums">
                            ${c.paidOut.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 md:px-5 py-3 text-right align-middle">
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              balance > 0 ? "text-[#7a5c10]" : "text-muted",
                            )}
                          >
                            ${balance.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-surface/40">
                    <td
                      className="px-4 md:px-5 py-2.5 text-xs font-semibold text-foreground"
                      colSpan={3}
                    >
                      Total
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">
                      ${COMMISSION_DATA.reduce((s, c) => s + c.revenue, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">
                      ${COMMISSION_DATA.reduce((s, c) => s + c.earned, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums hidden lg:table-cell">
                      ${COMMISSION_DATA.reduce((s, c) => s + c.paidOut, 0).toLocaleString()}
                    </td>
                    <td className="px-4 md:px-5 py-2.5 text-right text-sm font-semibold text-[#7a5c10] tabular-nums">
                      ${totalCommissionBalance.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Payroll ── */}
      {pageTab === "Payroll" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Payroll & 1099</h2>
              <p className="text-xs text-muted mt-0.5">
                Track payments and generate 1099 summaries for independent contractors.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border text-xs font-medium rounded-lg hover:bg-foreground/5 transition-colors text-foreground">
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors">
                <DollarSign className="w-3.5 h-3.5" />
                Run Payroll
              </button>
            </div>
          </div>

          {/* Pay period summary */}
          <div className="bg-background border border-border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-muted">Current Pay Period</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">Feb 1 – Feb 28, 2026</p>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-xs text-muted">Total Owed</p>
                <p className="text-lg font-semibold text-foreground">$1,416</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted">Paid Out</p>
                <p className="text-lg font-semibold text-[#4e6b51]">$1,110</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted">Remaining</p>
                <p className="text-lg font-semibold text-[#a07040]">$306</p>
              </div>
            </div>
          </div>

          {/* Payroll table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-surface/40">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                    Staff
                  </th>
                  <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                    Type
                  </th>
                  <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                    Sessions
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                    Revenue
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                    Owed
                  </th>
                  <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                    Status
                  </th>
                  <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    name: "Aaliyah",
                    role: "Lash Tech",
                    type: "1099",
                    sessions: 24,
                    revenue: 2880,
                    owed: 864,
                    paid: false,
                  },
                  {
                    name: "Jade",
                    role: "Jewelry Tech",
                    type: "1099",
                    sessions: 12,
                    revenue: 1020,
                    owed: 306,
                    paid: false,
                  },
                  {
                    name: "Maya",
                    role: "Crochet Tech",
                    type: "1099",
                    sessions: 8,
                    revenue: 820,
                    owed: 246,
                    paid: true,
                  },
                  {
                    name: "Trini",
                    role: "Owner",
                    type: "Owner Draw",
                    sessions: 38,
                    revenue: 5640,
                    owed: 0,
                    paid: true,
                  },
                ].map((s) => (
                  <tr
                    key={s.name}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-4 py-3 align-middle">
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-[10px] text-muted">{s.role}</p>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="text-[10px] font-medium text-muted bg-surface border border-border px-1.5 py-0.5 rounded-full">
                        {s.type}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="text-sm text-foreground tabular-nums">{s.sessions}</span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="text-sm text-foreground tabular-nums">
                        ${s.revenue.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          s.owed === 0 ? "text-muted" : "text-foreground",
                        )}
                      >
                        ${s.owed.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      {s.owed === 0 ? (
                        <span className="text-[10px] text-muted">N/A</span>
                      ) : s.paid ? (
                        <span className="flex items-center justify-center gap-1 text-[10px] text-[#4e6b51]">
                          <CheckSquare className="w-3 h-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#a07040] bg-[#a07040]/10 px-1.5 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      {s.owed > 0 && !s.paid && (
                        <button className="text-[10px] text-accent hover:underline">
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 1099 section */}
          <div className="bg-background border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">1099 Summary — Tax Year 2025</p>
              <button className="flex items-center gap-1.5 text-xs text-accent hover:underline">
                <Download className="w-3 h-3" />
                Download All 1099s
              </button>
            </div>
            <div className="space-y-2">
              {[
                { name: "Aaliyah", ein: "***-**-4821", total: 8640 },
                { name: "Jade", ein: "***-**-3392", total: 3670 },
                { name: "Maya", ein: "***-**-7714", total: 2460 },
              ].map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-[10px] text-muted">EIN/SSN: {s.ein}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        ${s.total.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted">earned in 2025</p>
                    </div>
                    <button className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors">
                      <Download className="w-3 h-3" />
                      1099
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <AddAssistantDialog
        key={`assistant-${dialogOpen}`}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={(data) =>
          setAssistants((prev) => [
            {
              id: Date.now(),
              ...data,
              totalSessions: 0,
              totalRevenue: 0,
              avgRating: 0,
              thisMonthSessions: 0,
              recentSessions: [],
            },
            ...prev,
          ])
        }
      />
    </div>
  );
}
