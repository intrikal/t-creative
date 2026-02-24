"use client";

import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentRow, StudentStatus } from "../actions";
import { StudentCard } from "./StudentCard";

export function StudentsTab({
  students,
  filter,
  setFilter,
  waitlistCount,
  pendingIds,
  onDelete,
}: {
  students: StudentRow[];
  filter: "all" | StudentStatus;
  setFilter: (f: "all" | StudentStatus) => void;
  waitlistCount: number;
  pendingIds: Set<string>;
  onDelete: (id: number) => void;
}) {
  const filtered = students.filter((s) => filter === "all" || s.status === filter);

  return (
    <>
      <div className="flex gap-1 flex-wrap">
        {(["all", "active", "waitlist", "completed", "paused"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
              filter === f ? "bg-foreground/8 text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {f}
            {f === "waitlist" && waitlistCount > 0 && (
              <span className="ml-1 text-accent font-bold">·{waitlistCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.map((s) => (
          <StudentCard
            key={s.id}
            student={s}
            onDelete={() => onDelete(s.id)}
            pending={pendingIds.has(`stu-${s.id}`)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 border border-dashed border-border rounded-xl">
            <UserPlus className="w-8 h-8 text-muted/40 mx-auto mb-2" />
            <p className="text-sm text-muted">No students with this status.</p>
          </div>
        )}
      </div>
    </>
  );
}
