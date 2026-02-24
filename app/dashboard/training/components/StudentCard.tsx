"use client";

import { useState } from "react";
import { Award, ChevronDown, ChevronUp, CheckCircle, Clock, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StudentRow } from "../actions";
import { PROGRAM_STYLE, studentStatusConfig } from "./helpers";

export function StudentCard({
  student,
  onDelete,
  pending,
}: {
  student: StudentRow;
  onDelete: () => void;
  pending: boolean;
}) {
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
    <Card className={cn("gap-0", pending && "opacity-60")}>
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

          <div className="flex items-center gap-0.5 shrink-0">
            {student.sessions.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-destructive/8 text-muted hover:text-destructive transition-colors"
              title="Remove enrollment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
