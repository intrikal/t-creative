"use client";

import { useState, useTransition } from "react";
import { GraduationCap, Award, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientProgram, ClientTrainingData, EnrollStatus } from "@/lib/types/training.types";
import { clientEnroll, clientJoinWaitlist } from "./client-actions";
import { PROG_STYLE } from "./components/client-helpers";
import { ClientProgramCard } from "./components/ClientProgramCard";
import { EnrollModal } from "./components/EnrollModal";
import { LessonProgressCard } from "./components/LessonProgressCard";

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

      {/* Lesson progress cards for active enrollments */}
      {activeEnrollments
        .filter((e) => e.lessonModules.length > 0)
        .map((e) => (
          <LessonProgressCard key={e.id} enrollment={e} />
        ))}

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
            <ClientProgramCard
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
