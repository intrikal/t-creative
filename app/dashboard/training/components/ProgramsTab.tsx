"use client";

import { GraduationCap } from "lucide-react";
import type { ProgramRow, StudentRow } from "../actions";
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
  function enrolledForProgram(progId: number) {
    return students.filter((s) => s.programId === progId && s.status === "active").length;
  }
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
