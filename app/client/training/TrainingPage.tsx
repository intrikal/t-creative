"use client";

import { useState } from "react";
import {
  GraduationCap,
  Users,
  Clock,
  Award,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  CalendarDays,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & data                                                        */
/* ------------------------------------------------------------------ */

type ProgramType = "lash" | "jewelry" | "business" | "crochet";
type EnrollStatus = "enrolled" | "waitlist" | "completed" | null;

interface Program {
  id: number;
  name: string;
  type: ProgramType;
  price: number;
  sessions: number;
  description: string;
  spotsLeft: number;
  maxSpots: number;
  waitlistOpen: boolean;
  whatYouLearn: string[];
  includes: string[];
  instructor: string;
  startDate: string;
  schedule: string;
  location: string;
}

const PROGRAMS: Program[] = [
  {
    id: 1,
    name: "Classic Lash Certification",
    type: "lash",
    price: 800,
    sessions: 4,
    description:
      "Full classic application, mapping, isolation, and aftercare. The foundation course for aspiring lash technicians.",
    spotsLeft: 1,
    maxSpots: 4,
    waitlistOpen: true,
    whatYouLearn: [
      "Natural lash anatomy and health assessment",
      "Classic lash mapping and curl selection",
      "Isolation technique and adhesive chemistry",
      "Full set application and speed drills",
    ],
    includes: [
      "Starter kit (lashes, glue, tools)",
      "Digital manual",
      "Practice mannequin time",
      "Certificate upon completion",
    ],
    instructor: "Trini",
    startDate: "Mar 15, 2026",
    schedule: "Sat & Sun, 9am–5pm (2 weekends)",
    location: "T Creative Studio",
  },
  {
    id: 2,
    name: "Volume Lash Masterclass",
    type: "lash",
    price: 1200,
    sessions: 6,
    description:
      "Pre-made fans, handmade fans, and mega volume. For certified lash technicians ready to level up.",
    spotsLeft: 2,
    maxSpots: 3,
    waitlistOpen: true,
    whatYouLearn: [
      "Pre-made fan application and selection",
      "Handmade fan technique — 2D to 10D",
      "Mega volume and retention strategies",
      "Troubleshooting and client assessment",
    ],
    includes: [
      "Volume lash kit",
      "Advanced digital workbook",
      "Live model sessions",
      "Certificate upon completion",
    ],
    instructor: "Trini",
    startDate: "Apr 5, 2026",
    schedule: "Sat & Sun, 9am–5pm (3 weekends)",
    location: "T Creative Studio",
  },
  {
    id: 3,
    name: "Permanent Jewelry Training",
    type: "jewelry",
    price: 450,
    sessions: 2,
    description:
      "1-day hands-on training covering welding technique, chain selection, client safety, and business setup.",
    spotsLeft: 3,
    maxSpots: 5,
    waitlistOpen: false,
    whatYouLearn: [
      "Welder equipment setup and safety",
      "Chain sizing and material selection",
      "Live model welding practice",
      "Client consultation and pricing",
    ],
    includes: [
      "Jewelry kit (welder, chains, clasps)",
      "Safety documentation templates",
      "Pricing guide",
      "Certificate upon completion",
    ],
    instructor: "Jade & Trini",
    startDate: "Mar 8, 2026",
    schedule: "Sat, 10am–4pm (1 day)",
    location: "T Creative Studio",
  },
  {
    id: 4,
    name: "Beauty Business Bootcamp",
    type: "business",
    price: 600,
    sessions: 3,
    description:
      "Pricing strategy, client retention, and brand building for beauty professionals ready to grow.",
    spotsLeft: 6,
    maxSpots: 6,
    waitlistOpen: false,
    whatYouLearn: [
      "How to price services for profitability",
      "Client retention and rebooking systems",
      "Instagram and content marketing for beauty",
      "Hiring, team building, and HR basics",
    ],
    includes: [
      "Workbooks and templates",
      "Pricing calculator spreadsheet",
      "Private community access",
      "Certificate of completion",
    ],
    instructor: "Trini",
    startDate: "Mar 29, 2026",
    schedule: "Sat, 10am–4pm (3 sessions)",
    location: "Virtual + In-person",
  },
];

const PROG_STYLE: Record<
  ProgramType,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  lash: {
    label: "Lash",
    bg: "bg-[#c4907a]/12",
    text: "text-[#96604a]",
    border: "border-[#c4907a]/20",
    dot: "bg-[#c4907a]",
  },
  jewelry: {
    label: "Jewelry",
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/20",
    dot: "bg-[#d4a574]",
  },
  business: {
    label: "Business",
    bg: "bg-[#5b8a8a]/12",
    text: "text-[#3a6060]",
    border: "border-[#5b8a8a]/20",
    dot: "bg-[#5b8a8a]",
  },
  crochet: {
    label: "Crochet",
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4a7a7a]",
    border: "border-[#7ba3a3]/20",
    dot: "bg-[#7ba3a3]",
  },
};

/* ------------------------------------------------------------------ */
/*  Enroll modal                                                        */
/* ------------------------------------------------------------------ */

function EnrollModal({
  program,
  isWaitlist,
  onClose,
  onConfirm,
}: {
  program: Program;
  isWaitlist: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const style = PROG_STYLE[program.type];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">
            {isWaitlist ? "Join Waitlist" : "Enroll in Program"}
          </p>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className={cn("p-3 rounded-xl border", style.bg, style.border)}>
            <p className={cn("text-sm font-semibold", style.text)}>{program.name}</p>
            <p className="text-xs text-muted mt-0.5">
              ${program.price.toLocaleString()} · {program.sessions} sessions · with{" "}
              {program.instructor}
            </p>
          </div>
          {isWaitlist ? (
            <p className="text-xs text-muted leading-relaxed">
              This program is full. Join the waitlist and you&apos;ll be notified when a spot opens.
              No payment required now.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted leading-relaxed">
                A 50% deposit of{" "}
                <span className="font-semibold text-foreground">
                  ${Math.round(program.price * 0.5).toLocaleString()}
                </span>{" "}
                is required to secure your spot. The remaining balance is due before your first
                session.
              </p>
              <p className="text-xs text-muted leading-relaxed">
                T Creative Studio will reach out within 24–48 hours to confirm your enrollment and
                schedule your first session.
              </p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            {isWaitlist ? "Join Waitlist" : "Confirm & Pay Deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Program card                                                        */
/* ------------------------------------------------------------------ */

function ProgramCard({
  program,
  enrollStatus,
  onEnroll,
  onWaitlist,
}: {
  program: Program;
  enrollStatus: EnrollStatus;
  onEnroll: () => void;
  onWaitlist: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const style = PROG_STYLE[program.type];
  const isFull = program.spotsLeft === 0;
  const fillPct = Math.round(((program.maxSpots - program.spotsLeft) / program.maxSpots) * 100);

  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              style.bg,
            )}
          >
            <GraduationCap className={cn("w-5 h-5", style.text)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">{program.name}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
                  {enrollStatus === "enrolled" && (
                    <Badge className="border text-[10px] px-1.5 py-0.5 bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20">
                      Enrolled
                    </Badge>
                  )}
                  {enrollStatus === "waitlist" && (
                    <Badge className="border text-[10px] px-1.5 py-0.5 bg-accent/12 text-accent border-accent/20">
                      On Waitlist
                    </Badge>
                  )}
                  {enrollStatus === "completed" && (
                    <Badge className="border text-[10px] px-1.5 py-0.5 bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/20 flex items-center gap-0.5">
                      <Award className="w-2.5 h-2.5" /> Certified
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-base font-bold text-foreground shrink-0">
                ${program.price.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">{program.description}</p>

        {/* Meta */}
        <div className="flex flex-col gap-1.5 text-xs text-muted">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {program.sessions} sessions
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              with {program.instructor}
            </span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1 font-medium text-foreground/80">
              <CalendarDays className="w-3 h-3" />
              Starts {program.startDate}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {program.location}
            </span>
          </div>
          <p className="text-[11px] text-muted/70">{program.schedule}</p>
          {!isFull && (
            <span
              className={cn(
                "font-medium",
                program.spotsLeft <= 1
                  ? "text-destructive"
                  : program.spotsLeft <= 2
                    ? "text-[#7a5c10]"
                    : "text-muted",
              )}
            >
              {program.spotsLeft} spot{program.spotsLeft !== 1 ? "s" : ""} left
            </span>
          )}
          {isFull && program.waitlistOpen && (
            <span className="text-accent font-medium">Waitlist open</span>
          )}
        </div>

        {/* Fill bar */}
        <div className="space-y-1">
          <div className="w-full h-1.5 rounded-full bg-foreground/8">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isFull ? "bg-destructive/50" : style.dot,
              )}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted">
            {program.maxSpots - program.spotsLeft}/{program.maxSpots} spots filled
          </p>
        </div>

        {/* Expand what you learn */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          {expanded ? "Hide details" : "What you&apos;ll learn"}
        </button>

        {expanded && (
          <div className="space-y-3 pt-1 border-t border-border/40">
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">What you&apos;ll learn</p>
              <ul className="space-y-1">
                {program.whatYouLearn.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted">
                    <CheckCircle2 className="w-3 h-3 text-[#4e6b51] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">What&apos;s included</p>
              <ul className="space-y-1">
                {program.includes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted">
                    <span className="w-1 h-1 rounded-full bg-muted/50 shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* CTA */}
        {!enrollStatus && (
          <div className="flex gap-2 pt-1">
            {!isFull ? (
              <button
                onClick={onEnroll}
                className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Enroll — ${program.price.toLocaleString()}
              </button>
            ) : program.waitlistOpen ? (
              <button
                onClick={onWaitlist}
                className="flex-1 py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent/5 transition-colors"
              >
                Join Waitlist
              </button>
            ) : (
              <button
                disabled
                className="flex-1 py-2 rounded-lg bg-foreground/8 text-muted text-sm font-medium cursor-not-allowed"
              >
                Full — Waitlist closed
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientTrainingPage() {
  const [enrollStatuses, setEnrollStatuses] = useState<Record<number, EnrollStatus>>({});
  const [modalTarget, setModalTarget] = useState<{ program: Program; isWaitlist: boolean } | null>(
    null,
  );

  function handleConfirm(programId: number, isWaitlist: boolean) {
    setEnrollStatuses((prev) => ({ ...prev, [programId]: isWaitlist ? "waitlist" : "enrolled" }));
  }

  const totalEnrolled = Object.values(enrollStatuses).filter((s) => s === "enrolled").length;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Training Programs</h1>
        <p className="text-sm text-muted mt-0.5">
          Learn from Trini — certification courses and workshops
        </p>
      </div>

      {totalEnrolled > 0 && (
        <div className="bg-[#4e6b51]/8 border border-[#4e6b51]/20 rounded-xl px-4 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#4e6b51] shrink-0" />
            <p className="text-sm font-semibold text-foreground">
              You&apos;re enrolled in {totalEnrolled} program{totalEnrolled !== 1 ? "s" : ""}
            </p>
          </div>
          {PROGRAMS.filter((p) => enrollStatuses[p.id] === "enrolled").map((p) => (
            <div key={p.id} className="pl-6 flex items-start gap-3 text-xs text-muted">
              <div className="flex-1">
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="mx-1.5">·</span>
                <span>Starts {p.startDate}</span>
                <span className="mx-1.5">·</span>
                <span>{p.location}</span>
              </div>
            </div>
          ))}
          <p className="pl-6 text-xs text-muted">
            T Creative will reach out within 24–48 hours to confirm and share prep details. A 50%
            deposit secures your spot — remaining balance due before session 1.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {PROGRAMS.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            enrollStatus={enrollStatuses[program.id] ?? null}
            onEnroll={() => setModalTarget({ program, isWaitlist: false })}
            onWaitlist={() => setModalTarget({ program, isWaitlist: true })}
          />
        ))}
      </div>

      {modalTarget && (
        <EnrollModal
          program={modalTarget.program}
          isWaitlist={modalTarget.isWaitlist}
          onClose={() => setModalTarget(null)}
          onConfirm={() => handleConfirm(modalTarget.program.id, modalTarget.isWaitlist)}
        />
      )}
    </div>
  );
}
