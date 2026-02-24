"use client";

import { GraduationCap, Pencil, Trash2, Users, Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProgramRow } from "../actions";
import { PROGRAM_STYLE } from "./helpers";

export function ProgramCard({
  prog,
  enrolledCount,
  waitlistCount,
  onEdit,
  onDelete,
  onToggleWaitlist,
  pending,
}: {
  prog: ProgramRow;
  enrolledCount: number;
  waitlistCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleWaitlist: () => void;
  pending: boolean;
}) {
  const style = PROGRAM_STYLE[prog.type];
  const spotsLeft = Math.max(0, prog.maxSpots - enrolledCount);
  const isFull = spotsLeft === 0;

  return (
    <Card className={cn("gap-0", pending && "opacity-60")}>
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
