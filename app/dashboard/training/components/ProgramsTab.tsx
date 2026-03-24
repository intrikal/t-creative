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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mb-4">
            <GraduationCap className="w-5 h-5 text-muted" />
          </div>
          <p className="text-sm font-semibold text-foreground">No programs yet</p>
          <p className="text-xs text-muted mt-1">
            Create your first training program to start enrolling students.
          </p>
        </div>
      )}
    </div>
  );
}
