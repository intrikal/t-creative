/**
 * ProgramsTab — renders the list of training programs on the admin Training dashboard.
 *
 * Computes per-program enrollment and waitlist counts by filtering the
 * full students array. This avoids separate DB queries per program — the
 * parent page fetches all students once and passes them down.
 *
 * @module training/components/ProgramsTab
 */
"use client";

import { GraduationCap } from "lucide-react";
import type { ProgramRow, StudentRow } from "@/lib/types/training.types";
import { ProgramCard } from "./ProgramCard";

export function ProgramsTab({
  programs,
  students,
  pendingIds,
  onEdit,
  onDelete,
  onToggleWaitlist,
}: {
  programs: ProgramRow[];
  students: StudentRow[];
  pendingIds: Set<string>;
  onEdit: (prog: ProgramRow) => void;
  onDelete: (id: number) => void;
  onToggleWaitlist: (id: number) => void;
}) {
  /** Count active enrollments for a program by filtering the full students list. */
  function enrolledForProgram(progId: number) {
    return students.filter((s) => s.programId === progId && s.status === "active").length;
  }
  /** Count waitlisted students for a program by filtering the full students list. */
  function waitlistForProgram(progId: number) {
    return students.filter((s) => s.programId === progId && s.status === "waitlist").length;
  }

  return (
    <div className="space-y-3">
      {programs.map((prog) => (
        <ProgramCard
          key={prog.id}
          prog={prog}
          enrolledCount={enrolledForProgram(prog.id)}
          waitlistCount={waitlistForProgram(prog.id)}
          onEdit={() => onEdit(prog)}
          onDelete={() => onDelete(prog.id)}
          onToggleWaitlist={() => onToggleWaitlist(prog.id)}
          pending={pendingIds.has(`prog-${prog.id}`)}
        />
      ))}
      {programs.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <GraduationCap className="w-8 h-8 text-muted/40 mx-auto mb-2" />
          <p className="text-sm text-muted">No programs yet.</p>
        </div>
      )}
    </div>
  );
}
