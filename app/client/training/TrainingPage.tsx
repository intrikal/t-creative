"use client";

import { useState, useTransition } from "react";
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
  Download,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  ClientProgram,
  ClientEnrollment,
  ClientCertificate,
  ClientTrainingData,
  ProgramType,
  EnrollStatus,
} from "./actions";
import { clientEnroll, clientJoinWaitlist } from "./actions";

/* ------------------------------------------------------------------ */
/*  Styling                                                             */
/* ------------------------------------------------------------------ */

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

const FORMAT_LABEL: Record<string, string> = {
  in_person: "In-person",
  hybrid: "Hybrid",
  online: "Online",
};

/* ------------------------------------------------------------------ */
/*  Enroll modal                                                        */
/* ------------------------------------------------------------------ */

function EnrollModal({
  program,
  isWaitlist,
  onClose,
  onConfirm,
  isPending,
}: {
  program: ClientProgram;
  isWaitlist: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const style = PROG_STYLE[program.type];
  const deposit = Math.round(program.price * 0.5);
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
              ${program.price.toLocaleString()} · {program.modules.length} modules ·{" "}
              {FORMAT_LABEL[program.format] ?? program.format}
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
                <span className="font-semibold text-foreground">${deposit.toLocaleString()}</span>{" "}
                is required to secure your spot. The remaining balance is due before your first
                session.
              </p>
              <p className="text-xs text-muted leading-relaxed">
                T Creative Studio will reach out within 24–48 hours to confirm your enrollment and
                share prep details.
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
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40"
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
  program: ClientProgram;
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
                  {enrollStatus === "in_progress" && (
                    <Badge className="border text-[10px] px-1.5 py-0.5 bg-accent/12 text-accent border-accent/20">
                      In Progress
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
                  {program.certificationProvided && !enrollStatus && (
                    <Badge className="border text-[10px] px-1.5 py-0.5 bg-foreground/5 text-muted border-border">
                      Certificate
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
              <BookOpen className="w-3 h-3" />
              {program.modules.length} module{program.modules.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {FORMAT_LABEL[program.format] ?? program.format}
            </span>
            {program.kitIncluded && (
              <span className="flex items-center gap-1 text-accent">
                <CheckCircle2 className="w-3 h-3" />
                Kit included
              </span>
            )}
          </div>
          {program.nextSession && (
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1 font-medium text-foreground/80">
                <CalendarDays className="w-3 h-3" />
                {program.nextSession.startsAt}
              </span>
              {program.nextSession.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {program.nextSession.location}
                </span>
              )}
            </div>
          )}
          {program.nextSession?.schedule && (
            <p className="text-[11px] text-muted/70">{program.nextSession.schedule}</p>
          )}
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

        {/* Expand modules */}
        {program.modules.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              {expanded ? "Hide details" : "What you\u2019ll learn"}
            </button>

            {expanded && (
              <div className="space-y-2 pt-1 border-t border-border/40">
                {program.modules.map((mod, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-[#4e6b51] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-foreground font-medium">{mod.name}</span>
                      {mod.description && (
                        <span className="text-muted ml-1">— {mod.description}</span>
                      )}
                      {mod.lessonCount > 0 && (
                        <span className="text-muted/60 ml-1">
                          ({mod.lessonCount} lesson{mod.lessonCount !== 1 ? "s" : ""})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
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

export function ClientTrainingPage({ data }: { data: ClientTrainingData }) {
  const [enrollmentMap, setEnrollmentMap] = useState<Record<number, EnrollStatus>>(() => {
    const map: Record<number, EnrollStatus> = {};
    for (const e of data.enrollments) {
      map[e.programId] = e.status;
    }
    return map;
  });
  const [modalTarget, setModalTarget] = useState<{
    program: ClientProgram;
    isWaitlist: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeEnrollments = data.enrollments.filter(
    (e) => e.status === "enrolled" || e.status === "in_progress",
  );

  function handleConfirm(programId: number, isWaitlist: boolean) {
    // Optimistic update
    setEnrollmentMap((prev) => ({
      ...prev,
      [programId]: isWaitlist ? "waitlist" : "enrolled",
    }));
    setModalTarget(null);

    startTransition(async () => {
      if (isWaitlist) {
        await clientJoinWaitlist(programId);
      } else {
        await clientEnroll(programId);
      }
    });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Training Programs</h1>
        <p className="text-sm text-muted mt-0.5">
          Learn from Trini — certification courses and workshops
        </p>
      </div>

      {/* Certificates */}
      {data.certificates.length > 0 && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#d4a574]" />
              <CardTitle className="text-sm font-semibold">My Certificates</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-3 space-y-2">
            {data.certificates.map((cert) => {
              const style = PROG_STYLE[cert.programType];
              return (
                <div
                  key={cert.id}
                  className="flex items-center justify-between gap-3 py-2 border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        style.bg,
                      )}
                    >
                      <Award className={cn("w-4 h-4", style.text)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {cert.programName}
                      </p>
                      <p className="text-[11px] text-muted">
                        {cert.certificateCode} · Issued {cert.issuedAt}
                      </p>
                    </div>
                  </div>
                  {cert.pdfUrl && (
                    <a
                      href={cert.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0"
                      title="Download certificate"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Active enrollment banner */}
      {activeEnrollments.length > 0 && (
        <div className="bg-[#4e6b51]/8 border border-[#4e6b51]/20 rounded-xl px-4 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#4e6b51] shrink-0" />
            <p className="text-sm font-semibold text-foreground">
              You&apos;re enrolled in {activeEnrollments.length} program
              {activeEnrollments.length !== 1 ? "s" : ""}
            </p>
          </div>
          {activeEnrollments.map((e) => {
            const style = PROG_STYLE[e.programType];
            const paidPct =
              e.totalPriceCents > 0 ? Math.round((e.amountPaidCents / e.totalPriceCents) * 100) : 0;
            return (
              <div key={e.id} className="pl-6 space-y-1">
                <div className="flex items-start gap-3 text-xs text-muted">
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{e.programName}</span>
                    {e.sessionStartsAt && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{e.sessionStartsAt}</span>
                      </>
                    )}
                    {e.sessionLocation && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{e.sessionLocation}</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                {e.progressPercent > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-foreground/8">
                      <div
                        className={cn("h-full rounded-full", style.dot)}
                        style={{ width: `${e.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted">{e.progressPercent}%</span>
                  </div>
                )}
                {/* Payment status */}
                {e.amountPaidCents > 0 && e.totalPriceCents > 0 && paidPct < 100 && (
                  <p className="text-[11px] text-muted">
                    ${(e.amountPaidCents / 100).toFixed(0)} / $
                    {(e.totalPriceCents / 100).toFixed(0)} paid ({paidPct}%)
                  </p>
                )}
              </div>
            );
          })}
          <p className="pl-6 text-xs text-muted">
            T Creative will reach out within 24–48 hours to confirm and share prep details. A 50%
            deposit secures your spot — remaining balance due before session 1.
          </p>
        </div>
      )}

      {/* Program grid */}
      {data.programs.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl">
          <GraduationCap className="w-10 h-10 text-foreground/15 mx-auto mb-3" />
          <p className="text-sm text-muted">No training programs available right now.</p>
          <p className="text-xs text-muted/60 mt-1">Check back soon for upcoming courses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {data.programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              enrollStatus={enrollmentMap[program.id] ?? null}
              onEnroll={() => setModalTarget({ program, isWaitlist: false })}
              onWaitlist={() => setModalTarget({ program, isWaitlist: true })}
            />
          ))}
        </div>
      )}

      {modalTarget && (
        <EnrollModal
          program={modalTarget.program}
          isWaitlist={modalTarget.isWaitlist}
          onClose={() => setModalTarget(null)}
          onConfirm={() => handleConfirm(modalTarget.program.id, modalTarget.isWaitlist)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
