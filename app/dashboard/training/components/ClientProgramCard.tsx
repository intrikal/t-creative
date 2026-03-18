/**
 * ClientProgramCard.tsx
 * Displays a training program card for the client-facing training page.
 * Named "ClientProgramCard" to avoid collision with the admin ProgramCard.tsx.
 */

"use client";

import { useState } from "react";
import {
  GraduationCap,
  Clock,
  Award,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CalendarDays,
  MapPin,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientProgram, EnrollStatus } from "../client-actions";
import { PROG_STYLE, FORMAT_LABEL } from "./client-helpers";

export function ClientProgramCard({
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
