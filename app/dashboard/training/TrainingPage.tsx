"use client";

import { useState } from "react";
import {
  Plus,
  Award,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  CheckCircle,
  Clock,
  Pencil,
  Trash2,
  Users,
  Lock,
  Unlock,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type ProgramType = "lash" | "jewelry" | "business" | "crochet";
type StudentStatus = "active" | "completed" | "paused" | "waitlist";
type SessionStatus = "completed" | "upcoming" | "cancelled";

interface TrainingSession {
  id: number;
  date: string;
  topic: string;
  status: SessionStatus;
  notes?: string;
}

interface Student {
  id: number;
  name: string;
  initials: string;
  program: ProgramType;
  programId: number;
  status: StudentStatus;
  enrolled: string;
  sessionsCompleted: number;
  sessionsTotal: number;
  amountPaid: number;
  amountTotal: number;
  certified: boolean;
  certDate?: string;
  sessions: TrainingSession[];
}

interface Program {
  id: number;
  name: string;
  type: ProgramType;
  price: number;
  sessions: number;
  description: string;
  active: boolean;
  maxSpots: number;
  waitlistOpen: boolean;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

const INITIAL_PROGRAMS: Program[] = [
  {
    id: 1,
    name: "Classic Lash Certification",
    type: "lash",
    price: 800,
    sessions: 4,
    description: "Full classic application, mapping, isolation, aftercare. Includes kit.",
    active: true,
    maxSpots: 4,
    waitlistOpen: true,
  },
  {
    id: 2,
    name: "Volume Lash Masterclass",
    type: "lash",
    price: 1200,
    sessions: 6,
    description: "Pre-made fans, handmade fans, mega volume. For certified lash techs.",
    active: true,
    maxSpots: 3,
    waitlistOpen: true,
  },
  {
    id: 3,
    name: "Permanent Jewelry Training",
    type: "jewelry",
    price: 450,
    sessions: 2,
    description: "Welding technique, chain selection, client safety. Kit included.",
    active: true,
    maxSpots: 5,
    waitlistOpen: false,
  },
  {
    id: 4,
    name: "Beauty Business Bootcamp",
    type: "business",
    price: 600,
    sessions: 3,
    description: "Pricing strategy, client retention, brand building for beauty pros.",
    active: false,
    maxSpots: 6,
    waitlistOpen: false,
  },
];

const INITIAL_STUDENTS: Student[] = [
  {
    id: 1,
    name: "Kezia Thompson",
    initials: "KT",
    program: "lash",
    programId: 1,
    status: "active",
    enrolled: "Jan 10, 2026",
    sessionsCompleted: 3,
    sessionsTotal: 4,
    amountPaid: 600,
    amountTotal: 800,
    certified: false,
    sessions: [
      {
        id: 1,
        date: "Jan 10",
        topic: "Intro to Lash Extensions — Theory & Safety",
        status: "completed",
      },
      {
        id: 2,
        date: "Jan 17",
        topic: "Isolation technique + Classic application on mannequin",
        status: "completed",
      },
      {
        id: 3,
        date: "Jan 31",
        topic: "First live model — Classic full set",
        status: "completed",
        notes: "Great progress, isolation improving.",
      },
      { id: 4, date: "Feb 28", topic: "Assessment + Certification exam", status: "upcoming" },
    ],
  },
  {
    id: 2,
    name: "Bianca Reynolds",
    initials: "BR",
    program: "lash",
    programId: 2,
    status: "active",
    enrolled: "Feb 1, 2026",
    sessionsCompleted: 1,
    sessionsTotal: 6,
    amountPaid: 400,
    amountTotal: 1200,
    certified: false,
    sessions: [
      {
        id: 1,
        date: "Feb 1",
        topic: "Volume theory — pre-made fans, sizing, curl types",
        status: "completed",
        notes: "Strong foundation. Excited learner.",
      },
      { id: 2, date: "Feb 15", topic: "Handmade fan practice", status: "upcoming" },
    ],
  },
  {
    id: 3,
    name: "Mia Chen",
    initials: "MC",
    program: "jewelry",
    programId: 3,
    status: "completed",
    enrolled: "Jan 5, 2026",
    sessionsCompleted: 2,
    sessionsTotal: 2,
    amountPaid: 450,
    amountTotal: 450,
    certified: true,
    certDate: "Jan 20, 2026",
    sessions: [
      {
        id: 1,
        date: "Jan 5",
        topic: "Welding safety, equipment setup, chain selection",
        status: "completed",
      },
      {
        id: 2,
        date: "Jan 20",
        topic: "Live model practice + certification assessment",
        status: "completed",
        notes: "Passed with flying colors!",
      },
    ],
  },
  {
    id: 4,
    name: "Faith Okafor",
    initials: "FO",
    program: "lash",
    programId: 1,
    status: "completed",
    enrolled: "Nov 1, 2025",
    sessionsCompleted: 4,
    sessionsTotal: 4,
    amountPaid: 800,
    amountTotal: 800,
    certified: true,
    certDate: "Dec 12, 2025",
    sessions: [],
  },
  {
    id: 5,
    name: "Diana Lopez",
    initials: "DL",
    program: "lash",
    programId: 2,
    status: "waitlist",
    enrolled: "Feb 18, 2026",
    sessionsCompleted: 0,
    sessionsTotal: 6,
    amountPaid: 0,
    amountTotal: 1200,
    certified: false,
    sessions: [],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const PROGRAM_STYLE: Record<
  ProgramType,
  { label: string; bg: string; text: string; border: string }
> = {
  lash: {
    label: "Lash",
    bg: "bg-[#c4907a]/12",
    text: "text-[#96604a]",
    border: "border-[#c4907a]/20",
  },
  jewelry: {
    label: "Jewelry",
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/20",
  },
  business: {
    label: "Business",
    bg: "bg-[#5b8a8a]/12",
    text: "text-[#3a6a6a]",
    border: "border-[#5b8a8a]/20",
  },
  crochet: {
    label: "Crochet",
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4a7a7a]",
    border: "border-[#7ba3a3]/20",
  },
};

function studentStatusConfig(status: StudentStatus) {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "completed":
      return { label: "Completed", className: "bg-foreground/8 text-muted border-foreground/12" };
    case "paused":
      return { label: "Paused", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "waitlist":
      return { label: "Waitlist", className: "bg-accent/12 text-accent border-accent/20" };
  }
}

/* ------------------------------------------------------------------ */
/*  Student card                                                        */
/* ------------------------------------------------------------------ */

function StudentCard({ student }: { student: Student }) {
  const [expanded, setExpanded] = useState(false);
  const prog = PROGRAM_STYLE[student.program];
  const sts = studentStatusConfig(student.status);
  const progressPct =
    student.sessionsTotal > 0
      ? Math.round((student.sessionsCompleted / student.sessionsTotal) * 100)
      : 0;
  const paymentPct =
    student.amountTotal > 0 ? Math.round((student.amountPaid / student.amountTotal) * 100) : 0;

  return (
    <Card className="gap-0">
      <CardContent className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <Avatar size="sm" className="shrink-0 mt-0.5">
            <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
              {student.initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{student.name}</span>
              {student.certified && (
                <Award className="w-3.5 h-3.5 text-[#d4a574] fill-[#d4a574]/30" />
              )}
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                {sts.label}
              </Badge>
              <Badge
                className={cn("border text-[10px] px-1.5 py-0.5", prog.bg, prog.text, prog.border)}
              >
                {prog.label}
              </Badge>
            </div>
            <p className="text-xs text-muted mt-0.5">Enrolled {student.enrolled}</p>

            {student.status !== "waitlist" && (
              <div className="mt-3 space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] text-muted mb-1">
                    <span>Sessions</span>
                    <span>
                      {student.sessionsCompleted}/{student.sessionsTotal}
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#c4907a] rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-muted mb-1">
                    <span>Payment</span>
                    <span>
                      ${student.amountPaid} / ${student.amountTotal}
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4e6b51] rounded-full transition-all"
                      style={{ width: `${paymentPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {student.status === "waitlist" && (
              <p className="text-xs text-muted mt-2 italic">Awaiting an open spot</p>
            )}

            {student.certified && student.certDate && (
              <p className="text-xs text-[#d4a574] mt-2 flex items-center gap-1">
                <Award className="w-3 h-3" /> Certified {student.certDate}
              </p>
            )}
          </div>

          {student.sessions.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors shrink-0"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        {expanded && student.sessions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-3">
              Session Log
            </p>
            <div className="space-y-2.5">
              {student.sessions.map((s) => (
                <div key={s.id} className="flex gap-3 text-xs">
                  <div className="shrink-0 mt-0.5">
                    {s.status === "completed" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-[#4e6b51]" />
                    ) : s.status === "upcoming" ? (
                      <Clock className="w-3.5 h-3.5 text-muted" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-destructive/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{s.date}</span>
                      {s.status === "upcoming" && (
                        <span className="text-[10px] text-muted italic">Upcoming</span>
                      )}
                    </div>
                    <p className="text-muted mt-0.5">{s.topic}</p>
                    {s.notes && (
                      <p className="text-[10px] text-muted/70 mt-0.5 italic">{s.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Student dialog                                                      */
/* ------------------------------------------------------------------ */

function StudentDialog({
  open,
  onClose,
  onSave,
  programs,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Student, "id" | "sessions" | "certified" | "certDate">) => void;
  programs: Program[];
}) {
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState<number>(programs[0]?.id ?? 0);
  const [status, setStatus] = useState<StudentStatus>("active");
  const [amountPaid, setAmountPaid] = useState("0");

  const selectedProg = programs.find((p) => p.id === programId) ?? programs[0];

  return (
    <Dialog open={open} onClose={onClose} title="Add Student" size="md">
      <div className="space-y-4" key={String(open)}>
        <Field label="Student name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Program" required>
            <Select
              value={String(programId)}
              onChange={(e) => setProgramId(Number(e.target.value))}
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)}>
              <option value="waitlist">Waitlist</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </Select>
          </Field>
        </div>
        <Field label="Amount paid ($)">
          <Input
            type="number"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            min={0}
          />
        </Field>
        {selectedProg && (
          <p className="text-xs text-muted bg-surface border border-border rounded-lg px-3 py-2">
            Program: <span className="text-foreground font-medium">{selectedProg.name}</span>
            {" · "}${selectedProg.price} · {selectedProg.sessions} sessions
          </p>
        )}
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!name.trim() || !selectedProg) return;
            const ini = name
              .trim()
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            onSave({
              name: name.trim(),
              initials: ini,
              program: selectedProg.type,
              programId: selectedProg.id,
              status,
              enrolled: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
              sessionsCompleted: 0,
              sessionsTotal: selectedProg.sessions,
              amountPaid: Number(amountPaid) || 0,
              amountTotal: selectedProg.price,
            });
            onClose();
          }}
          confirmLabel="Add student"
          disabled={!name.trim()}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Program dialog                                                      */
/* ------------------------------------------------------------------ */

function ProgramDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: Program | null;
  onSave: (p: Omit<Program, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ProgramType>(initial?.type ?? "lash");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [sessions, setSessions] = useState(String(initial?.sessions ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [maxSpots, setMaxSpots] = useState(String(initial?.maxSpots ?? "6"));
  const [waitlistOpen, setWaitlistOpen] = useState(initial?.waitlistOpen ?? true);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? "Edit Program" : "New Program"}
      size="md"
    >
      <div className="space-y-4" key={String(open)}>
        <Field label="Program name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Volume Lash Masterclass"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <Select value={type} onChange={(e) => setType(e.target.value as ProgramType)}>
              <option value="lash">Lash</option>
              <option value="jewelry">Jewelry</option>
              <option value="business">Business</option>
              <option value="crochet">Crochet</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={active ? "true" : "false"}
              onChange={(e) => setActive(e.target.value === "true")}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price ($)" required>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="800"
              min={0}
            />
          </Field>
          <Field label="Sessions" required>
            <Input
              type="number"
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
              placeholder="4"
              min={1}
            />
          </Field>
          <Field label="Max spots">
            <Input
              type="number"
              value={maxSpots}
              onChange={(e) => setMaxSpots(e.target.value)}
              placeholder="6"
              min={1}
            />
          </Field>
        </div>
        <Field label="Waitlist">
          <Select
            value={waitlistOpen ? "true" : "false"}
            onChange={(e) => setWaitlistOpen(e.target.value === "true")}
          >
            <option value="true">Open — accepting waitlist</option>
            <option value="false">Closed — no new waitlist sign-ups</option>
          </Select>
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does this program cover?"
          />
        </Field>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!name.trim()) return;
            onSave({
              name: name.trim(),
              type,
              price: Number(price) || 0,
              sessions: Number(sessions) || 1,
              description,
              active,
              maxSpots: Number(maxSpots) || 6,
              waitlistOpen,
            });
            onClose();
          }}
          confirmLabel={initial ? "Save changes" : "Add program"}
          disabled={!name.trim() || !price}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Program card                                                        */
/* ------------------------------------------------------------------ */

function ProgramCard({
  prog,
  enrolledCount,
  waitlistCount,
  onEdit,
  onDelete,
  onToggleWaitlist,
}: {
  prog: Program;
  enrolledCount: number;
  waitlistCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleWaitlist: () => void;
}) {
  const style = PROGRAM_STYLE[prog.type];
  const spotsLeft = Math.max(0, prog.maxSpots - enrolledCount);
  const isFull = spotsLeft === 0;

  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              style.bg,
            )}
          >
            <GraduationCap className={cn("w-5 h-5", style.text)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{prog.name}</span>
                  <Badge
                    className={cn(
                      "border text-[10px] px-1.5 py-0.5",
                      style.bg,
                      style.text,
                      style.border,
                    )}
                  >
                    {style.label}
                  </Badge>
                  {!prog.active && (
                    <Badge className="border text-[10px] px-1.5 py-0.5 bg-foreground/8 text-muted border-foreground/12">
                      Inactive
                    </Badge>
                  )}
                  {isFull && (
                    <Badge className="border text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive border-destructive/20">
                      Full
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">{prog.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted">
                  <span className="font-semibold text-foreground">
                    ${prog.price.toLocaleString()}
                  </span>
                  <span>{prog.sessions} sessions</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {enrolledCount}/{prog.maxSpots} enrolled
                  </span>
                  {waitlistCount > 0 && (
                    <span className="text-accent font-medium">{waitlistCount} on waitlist</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={onToggleWaitlist}
                  title={prog.waitlistOpen ? "Close waitlist" : "Open waitlist"}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
                    prog.waitlistOpen
                      ? "border-[#4e6b51]/30 text-[#4e6b51] bg-[#4e6b51]/8 hover:bg-[#4e6b51]/15"
                      : "border-border text-muted bg-surface hover:bg-foreground/5",
                  )}
                >
                  {prog.waitlistOpen ? (
                    <>
                      <Unlock className="w-3 h-3" /> Waitlist open
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" /> Waitlist closed
                    </>
                  )}
                </button>
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
                  title="Edit program"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg hover:bg-destructive/8 text-muted hover:text-destructive transition-colors"
                  title="Delete program"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Spots bar */}
            <div className="mt-3">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isFull ? "bg-destructive/60" : "bg-[#c4907a]",
                  )}
                  style={{ width: `${Math.min(100, (enrolledCount / prog.maxSpots) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted mt-1">
                {isFull
                  ? "No spots available"
                  : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} remaining`}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function TrainingPage() {
  const [tab, setTab] = useState<"students" | "programs">("students");
  const [filter, setFilter] = useState<"all" | StudentStatus>("all");
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [programs, setPrograms] = useState<Program[]>(INITIAL_PROGRAMS);
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [programDialog, setProgramDialog] = useState<{ open: boolean; program: Program | null }>({
    open: false,
    program: null,
  });

  const filtered = students.filter((s) => filter === "all" || s.status === filter);
  const activeStudents = students.filter((s) => s.status === "active").length;
  const waitlistStudents = students.filter((s) => s.status === "waitlist").length;
  const certified = students.filter((s) => s.certified).length;
  const revenue = students.reduce((sum, s) => sum + s.amountPaid, 0);

  function enrolledForProgram(progId: number) {
    return students.filter((s) => s.programId === progId && s.status === "active").length;
  }
  function waitlistForProgram(progId: number) {
    return students.filter((s) => s.programId === progId && s.status === "waitlist").length;
  }

  function toggleWaitlist(progId: number) {
    setPrograms((prev) =>
      prev.map((p) => (p.id === progId ? { ...p, waitlistOpen: !p.waitlistOpen } : p)),
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Training</h1>
          <p className="text-sm text-muted mt-0.5">Programs, students, and certifications</p>
        </div>
        <button
          onClick={() =>
            tab === "students"
              ? setStudentDialogOpen(true)
              : setProgramDialog({ open: true, program: null })
          }
          className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {tab === "students" ? "Add Student" : "Add Program"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="gap-0 py-4">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Active</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{activeStudents}</p>
            <p className="text-xs text-muted mt-0.5">students enrolled</p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-4">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Waitlist</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{waitlistStudents}</p>
            <p className="text-xs text-muted mt-0.5">waiting for a spot</p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-4">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Certified
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1">{certified}</p>
            <p className="text-xs text-muted mt-0.5">graduates</p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-4">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Revenue</p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              ${revenue.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">collected</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5 w-fit">
        {(["students", "programs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-foreground text-background" : "text-muted hover:text-foreground",
            )}
          >
            {t}
            {t === "students" && waitlistStudents > 0 && (
              <span className="ml-1.5 text-[10px] bg-accent/20 text-accent rounded-full px-1.5 py-0.5 font-semibold">
                {waitlistStudents}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Students tab */}
      {tab === "students" && (
        <>
          <div className="flex gap-1 flex-wrap">
            {(["all", "active", "waitlist", "completed", "paused"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "bg-foreground/8 text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {f}
                {f === "waitlist" && waitlistStudents > 0 && (
                  <span className="ml-1 text-accent font-bold">·{waitlistStudents}</span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((s) => (
              <StudentCard key={s.id} student={s} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 border border-dashed border-border rounded-xl">
                <UserPlus className="w-8 h-8 text-muted/40 mx-auto mb-2" />
                <p className="text-sm text-muted">No students with this status.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Programs tab */}
      {tab === "programs" && (
        <div className="space-y-3">
          {programs.map((prog) => (
            <ProgramCard
              key={prog.id}
              prog={prog}
              enrolledCount={enrolledForProgram(prog.id)}
              waitlistCount={waitlistForProgram(prog.id)}
              onEdit={() => setProgramDialog({ open: true, program: prog })}
              onDelete={() => setPrograms((prev) => prev.filter((p) => p.id !== prog.id))}
              onToggleWaitlist={() => toggleWaitlist(prog.id)}
            />
          ))}
          {programs.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <GraduationCap className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">No programs yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <StudentDialog
        key={`student-${studentDialogOpen}`}
        open={studentDialogOpen}
        onClose={() => setStudentDialogOpen(false)}
        programs={programs}
        onSave={(data) =>
          setStudents((prev) => [
            { id: Date.now(), ...data, certified: false, sessions: [] },
            ...prev,
          ])
        }
      />
      <ProgramDialog
        key={`program-${programDialog.open}-${programDialog.program?.id}`}
        open={programDialog.open}
        onClose={() => setProgramDialog({ open: false, program: null })}
        initial={programDialog.program}
        onSave={(data) => {
          if (programDialog.program) {
            setPrograms((prev) =>
              prev.map((p) => (p.id === programDialog.program!.id ? { ...p, ...data } : p)),
            );
          } else {
            setPrograms((prev) => [{ id: Date.now(), ...data }, ...prev]);
          }
        }}
      />
    </div>
  );
}
