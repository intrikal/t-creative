/**
 * LessonProgressCard.tsx
 * Displays lesson progress for an enrolled student, with expandable modules
 * and toggleable lesson completion checkmarks.
 */

"use client";

import { useState, useTransition } from "react";
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toggleLessonCompletion } from "../actions";
import type { ClientEnrollment, ClientLessonModule } from "../client-actions";
import { PROG_STYLE } from "./client-helpers";

export function LessonProgressCard({ enrollment }: { enrollment: ClientEnrollment }) {
  const style = PROG_STYLE[enrollment.programType];
  const [modules, setModules] = useState<ClientLessonModule[]>(enrollment.lessonModules);
  const [expandedModule, setExpandedModule] = useState<number | null>(
    modules.find((m) => m.lessons.some((l) => !l.completed))?.id ?? modules[0]?.id ?? null,
  );
  const [isPending, startTransition] = useTransition();

  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);
  const doneLessons = modules.reduce((n, m) => n + m.lessons.filter((l) => l.completed).length, 0);
  const pct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

  function handleToggle(moduleId: number, lessonId: number) {
    setModules((prev) =>
      prev.map((m) =>
        m.id !== moduleId
          ? m
          : {
              ...m,
              lessons: m.lessons.map((l) =>
                l.id !== lessonId ? l : { ...l, completed: !l.completed },
              ),
            },
      ),
    );
    startTransition(() => toggleLessonCompletion(lessonId));
  }

  if (modules.length === 0) return null;

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className={cn("w-4 h-4", style.text)} />
            <CardTitle className="text-sm font-semibold">{enrollment.programName}</CardTitle>
          </div>
          <span className="text-[11px] text-muted tabular-nums">
            {doneLessons}/{totalLessons} lessons
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-foreground/8">
            <div
              className={cn("h-full rounded-full transition-all", style.dot)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-muted">{pct}%</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-3 space-y-1">
        {modules.map((mod) => {
          const modDone = mod.lessons.filter((l) => l.completed).length;
          const isExpanded = expandedModule === mod.id;
          return (
            <div key={mod.id} className="border border-border/40 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-foreground/3 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {modDone === mod.lessons.length ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#4e6b51] shrink-0" />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5 text-muted shrink-0" />
                  )}
                  <span className="text-xs font-medium text-foreground truncate">{mod.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] text-muted">
                    {modDone}/{mod.lessons.length}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-border/40 divide-y divide-border/30">
                  {mod.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => handleToggle(mod.id, lesson.id)}
                      disabled={isPending}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-foreground/3 transition-colors disabled:opacity-60"
                    >
                      <CheckCircle2
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          lesson.completed ? "text-[#4e6b51]" : "text-foreground/20",
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs flex-1",
                          lesson.completed ? "text-muted line-through" : "text-foreground",
                        )}
                      >
                        {lesson.title}
                      </span>
                      {lesson.durationMin > 0 && (
                        <span className="text-[10px] text-muted shrink-0">
                          {lesson.durationMin}m
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
