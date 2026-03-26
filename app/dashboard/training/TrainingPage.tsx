"use client";

import { useState, useTransition, useCallback } from "react";
import { Plus, Lock, Users, Clock, GraduationCap, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ProgramRow,
  StudentRow,
  TrainingStats,
  ClientOption,
  StudentStatus,
  ProgramFormData,
  EnrollmentFormData,
} from "./actions";
import {
  createProgram,
  updateProgram,
  deleteProgram as deleteProgramAction,
  toggleWaitlist as toggleWaitlistAction,
  createEnrollment,
  deleteEnrollment,
} from "./actions";
import { ProgramDialog } from "./components/ProgramDialog";
import { ProgramsTab } from "./components/ProgramsTab";
import { StudentDialog } from "./components/StudentDialog";
import { StudentsTab } from "./components/StudentsTab";

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function TrainingPage({
  initialPrograms,
  initialStudents,
  stats,
  clients,
  embedded,
}: {
  initialPrograms: ProgramRow[];
  initialStudents: StudentRow[];
  stats: TrainingStats;
  clients: ClientOption[];
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<"students" | "programs">("students");
  const [filter, setFilter] = useState<"all" | StudentStatus>("all");
  const handleFilterChange = useCallback((f: "all" | StudentStatus) => {
    setFilter(f);
  }, []);
  const [isPending, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [programDialog, setProgramDialog] = useState<{
    open: boolean;
    program: ProgramRow | null;
  }>({ open: false, program: null });

  function markPending(key: string) {
    setPendingIds((prev) => new Set(prev).add(key));
  }
  function clearPending(key: string) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  /* Program handlers */
  function handleSaveProgram(form: ProgramFormData) {
    startTransition(async () => {
      if (programDialog.program) {
        await updateProgram(programDialog.program.id, form);
      } else {
        await createProgram(form);
      }
      setProgramDialog({ open: false, program: null });
    });
  }

  function handleDeleteProgram(id: number) {
    setDeleteError(null);
    markPending(`prog-${id}`);
    startTransition(async () => {
      const result = await deleteProgramAction(id);
      clearPending(`prog-${id}`);
      if (result.error) {
        setDeleteError(result.error);
      }
    });
  }

  function handleToggleWaitlist(programId: number) {
    markPending(`prog-${programId}`);
    startTransition(async () => {
      await toggleWaitlistAction(programId);
      clearPending(`prog-${programId}`);
    });
  }

  /* Enrollment handlers */
  function handleAddStudent(form: EnrollmentFormData) {
    startTransition(async () => {
      await createEnrollment(form);
      setStudentDialogOpen(false);
    });
  }

  function handleDeleteStudent(id: number) {
    markPending(`stu-${id}`);
    startTransition(async () => {
      await deleteEnrollment(id);
      clearPending(`stu-${id}`);
    });
  }

  return (
    <div className={cn("max-w-7xl mx-auto w-full space-y-4", embedded ? "" : "p-4 md:p-6 lg:p-8")}>
      {/* Header */}
      {!embedded && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              Training
            </h1>
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
      )}
      {embedded && (
        <div className="flex justify-end">
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
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          {
            label: "Active",
            value: String(stats.activeStudents),
            sub: "students enrolled",
            icon: Users,
            color: "text-accent",
            bg: "bg-accent/10",
          },
          {
            label: "Waitlist",
            value: String(stats.waitlistStudents),
            sub: "waiting for a spot",
            icon: Clock,
            color: "text-[#a07040]",
            bg: "bg-[#a07040]/10",
          },
          {
            label: "Certified",
            value: String(stats.certified),
            sub: "graduates",
            icon: GraduationCap,
            color: "text-[#4e6b51]",
            bg: "bg-[#4e6b51]/10",
          },
          {
            label: "Revenue",
            value: `$${stats.revenue.toLocaleString()}`,
            sub: "collected",
            icon: DollarSign,
            color: "text-blush",
            bg: "bg-blush/10",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wide leading-none">
                  {stat.label}
                </p>
                <p className="text-lg font-semibold text-foreground leading-tight">{stat.value}</p>
                <p className="text-xs text-muted">{stat.sub}</p>
              </div>
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                  stat.bg,
                )}
              >
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5 w-fit">
        {(["students", "programs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setDeleteError(null);
            }}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-foreground text-background" : "text-muted hover:text-foreground",
            )}
          >
            {t}
            {t === "students" && stats.waitlistStudents > 0 && (
              <span className="ml-1.5 text-[10px] bg-accent/20 text-accent rounded-full px-1.5 py-0.5 font-semibold">
                {stats.waitlistStudents}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Delete error alert */}
      {deleteError && (
        <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-3 flex items-center gap-3">
          <Lock className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs text-foreground">{deleteError}</p>
          <button
            onClick={() => setDeleteError(null)}
            className="ml-auto text-xs text-muted hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab content */}
      {tab === "students" && (
        <StudentsTab
          students={initialStudents}
          filter={filter}
          onFilterChange={handleFilterChange}
          waitlistCount={stats.waitlistStudents}
          pendingIds={pendingIds}
          onDelete={handleDeleteStudent}
        />
      )}

      {tab === "programs" && (
        <ProgramsTab
          programs={initialPrograms}
          students={initialStudents}
          pendingIds={pendingIds}
          onEdit={(prog) => setProgramDialog({ open: true, program: prog })}
          onDelete={handleDeleteProgram}
          onToggleWaitlist={handleToggleWaitlist}
        />
      )}

      {/* Dialogs */}
      <StudentDialog
        key={`student-${studentDialogOpen}`}
        open={studentDialogOpen}
        onClose={() => setStudentDialogOpen(false)}
        programs={initialPrograms}
        clients={clients}
        onSave={handleAddStudent}
        saving={isPending}
      />
      <ProgramDialog
        key={`program-${programDialog.open}-${programDialog.program?.id}`}
        open={programDialog.open}
        onClose={() => setProgramDialog({ open: false, program: null })}
        initial={programDialog.program}
        onSave={handleSaveProgram}
        saving={isPending}
      />
    </div>
  );
}
