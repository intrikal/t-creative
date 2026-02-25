"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  BookOpen,
  Lock,
  ChevronDown,
  ChevronUp,
  Award,
  Play,
  ExternalLink,
  GraduationCap,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AssistantTrainingData, AssistantModule, AssistantLesson } from "./actions";
import { toggleLessonCompletion } from "./actions";

type ModuleCategory = string;

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  technique: {
    label: "Technique",
    className: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20",
  },
  lash: {
    label: "Technique",
    className: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20",
  },
  "client-care": {
    label: "Client Care",
    className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
  },
  business: {
    label: "Business",
    className: "bg-accent/12 text-accent border-accent/20",
  },
  consulting: {
    label: "Business",
    className: "bg-accent/12 text-accent border-accent/20",
  },
  safety: {
    label: "Safety",
    className: "bg-[#7ba3a3]/12 text-[#4a7a7a] border-[#7ba3a3]/20",
  },
  jewelry: {
    label: "Jewelry",
    className: "bg-[#7a5c10]/12 text-[#7a5c10] border-[#7a5c10]/20",
  },
  crochet: {
    label: "Crochet",
    className: "bg-[#8b6b9e]/12 text-[#6b4d80] border-[#8b6b9e]/20",
  },
};

function getCategoryConfig(cat: string) {
  return (
    CATEGORY_CONFIG[cat] ?? {
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      className: "bg-foreground/8 text-foreground border-foreground/20",
    }
  );
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}hr ${m}m` : `${h}hr`;
}

export function AssistantTrainingPage({ data }: { data: AssistantTrainingData }) {
  const [modules, setModules] = useState<AssistantModule[]>(data.modules);
  const [expanded, setExpanded] = useState<number | null>(
    modules.find((m) => m.status === "available" || m.status === "in_progress")?.id ?? null,
  );
  const [viewingLesson, setViewingLesson] = useState<AssistantLesson | null>(null);
  const [isPending, startTransition] = useTransition();

  const { stats } = data;

  const completedModules = modules.filter((m) => m.status === "completed").length;
  const availableModules = modules.filter(
    (m) => m.status === "available" || m.status === "in_progress",
  ).length;
  const totalLessons = modules.flatMap((m) => m.lessons).length;
  const completedLessons = modules.flatMap((m) => m.lessons).filter((l) => l.completed).length;
  const progressPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  function handleToggleLesson(moduleId: number, lessonId: number) {
    // Optimistic update
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id !== moduleId) return mod;
        const updated = mod.lessons.map((l) =>
          l.id === lessonId ? { ...l, completed: !l.completed } : l,
        );
        const allDone = updated.every((l) => l.completed);
        const anyStarted = updated.some((l) => l.completed);
        return {
          ...mod,
          lessons: updated,
          status: allDone
            ? ("completed" as const)
            : anyStarted
              ? ("in_progress" as const)
              : ("available" as const),
          completedDate: allDone
            ? new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : undefined,
        };
      }),
    );

    startTransition(async () => {
      await toggleLessonCompletion(lessonId);
    });
  }

  function handleStartLesson(mod: AssistantModule) {
    const nextLesson = mod.lessons.find((l) => !l.completed);
    if (!nextLesson) return;

    if (nextLesson.content) {
      setViewingLesson(nextLesson);
    } else {
      handleToggleLesson(mod.id, nextLesson.id);
    }
  }

  function handleLessonClick(mod: AssistantModule, lesson: AssistantLesson) {
    if (mod.status === "locked") return;

    if (lesson.content && !lesson.completed) {
      setViewingLesson(lesson);
    } else {
      handleToggleLesson(mod.id, lesson.id);
    }
  }

  function handleFinishReading(moduleId: number, lessonId: number) {
    handleToggleLesson(moduleId, lessonId);
    setViewingLesson(null);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Training</h1>
        <p className="text-sm text-muted mt-0.5">Courses and modules assigned by Trini</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Modules Completed", value: `${completedModules}/${modules.length}` },
          { label: "Pending", value: availableModules },
          { label: "Lessons Done", value: `${completedLessons}/${totalLessons}` },
          { label: "Certificates", value: stats.certificates },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall progress bar */}
      {totalLessons > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted font-medium">Overall progress</span>
            <span className="text-foreground font-semibold">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-foreground/8">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {modules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <GraduationCap className="w-10 h-10 text-foreground/15 mb-3" />
          <p className="text-sm text-muted">No training modules assigned yet.</p>
          <p className="text-xs text-muted/60 mt-1">
            Trini will add modules when new training is available.
          </p>
        </div>
      )}

      {/* Module list */}
      <div className="space-y-3">
        {modules.map((mod) => {
          const cat = getCategoryConfig(mod.category);
          const isExpanded = expanded === mod.id;
          const isLocked = mod.status === "locked";
          const isCompleted = mod.status === "completed" && mod.lessons.every((l) => l.completed);
          const modLessonsCompleted = mod.lessons.filter((l) => l.completed).length;
          const nextLesson = mod.lessons.find((l) => !l.completed);
          const noneStarted = modLessonsCompleted === 0;

          return (
            <Card key={mod.id} className={cn("gap-0", isLocked && "opacity-60")}>
              {/* Module header */}
              <button
                onClick={() => !isLocked && setExpanded(isExpanded ? null : mod.id)}
                disabled={isLocked}
                className="w-full text-left"
              >
                <CardContent className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-[#4e6b51]" />
                      ) : isLocked ? (
                        <Lock className="w-5 h-5 text-muted" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-[#7a5c10]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              isCompleted ? "text-muted" : "text-foreground",
                            )}
                          >
                            {mod.title}
                          </p>
                          <Badge className={cn("border text-[10px] px-1.5 py-0.5", cat.className)}>
                            {cat.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {mod.dueDate && !isCompleted && (
                            <span className="text-[10px] font-medium text-[#7a5c10] bg-[#7a5c10]/10 border border-[#7a5c10]/20 px-1.5 py-0.5 rounded-full">
                              Due {mod.dueDate}
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 border border-[#4e6b51]/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Award className="w-2.5 h-2.5" /> {mod.completedDate}
                            </span>
                          )}
                          {!isLocked &&
                            (isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted" />
                            ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted mt-1">{mod.description}</p>
                      {!isCompleted && !isLocked && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-foreground/8">
                            <div
                              className="h-full rounded-full bg-accent transition-all"
                              style={{
                                width: `${(modLessonsCompleted / mod.lessons.length) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted">
                            {modLessonsCompleted}/{mod.lessons.length} lessons
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </button>

              {/* Expanded lesson list */}
              {isExpanded && (
                <div className="border-t border-border/50 bg-surface/30">
                  {mod.lessons.map((lesson, i) => (
                    <button
                      key={lesson.id}
                      onClick={() => handleLessonClick(mod, lesson)}
                      disabled={isCompleted}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-3 text-left transition-colors",
                        i < mod.lessons.length - 1 && "border-b border-border/30",
                        !isCompleted && "hover:bg-foreground/[0.02]",
                      )}
                    >
                      {lesson.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4e6b51] shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-border shrink-0" />
                      )}
                      <span
                        className={cn(
                          "flex-1 text-xs",
                          lesson.completed ? "text-muted line-through" : "text-foreground",
                        )}
                      >
                        {lesson.title}
                      </span>
                      {lesson.content && !lesson.completed && (
                        <BookOpen className="w-3 h-3 text-accent/60 shrink-0" />
                      )}
                      <span className="text-[10px] text-muted/60 shrink-0">
                        {formatDuration(lesson.durationMin)}
                      </span>
                    </button>
                  ))}

                  {/* CTA — only when not fully completed */}
                  {!isCompleted && nextLesson && (
                    <div className="px-5 py-3 border-t border-border/30">
                      <button
                        onClick={() => handleStartLesson(mod)}
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
                      >
                        <Play className="w-3 h-3" />
                        {noneStarted
                          ? `Start: ${nextLesson.title}`
                          : `Continue: ${nextLesson.title}`}
                      </button>
                    </div>
                  )}

                  {/* All done */}
                  {!isCompleted && !nextLesson && (
                    <div className="px-5 py-3 border-t border-border/30 text-center">
                      <p className="text-xs text-[#4e6b51] font-medium flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> All lessons complete — marked as
                        done!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Lesson content viewer */}
      {viewingLesson && (
        <LessonViewer
          lesson={viewingLesson}
          moduleId={modules.find((m) => m.lessons.some((l) => l.id === viewingLesson.id))?.id ?? 0}
          onFinish={handleFinishReading}
          onClose={() => setViewingLesson(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lesson content viewer overlay                                      */
/* ------------------------------------------------------------------ */

function LessonViewer({
  lesson,
  moduleId,
  onFinish,
  onClose,
}: {
  lesson: AssistantLesson;
  moduleId: number;
  onFinish: (moduleId: number, lessonId: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{lesson.title}</h3>
            <p className="text-[10px] text-muted mt-0.5">
              {formatDuration(lesson.durationMin)} read
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors shrink-0 ml-3"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {lesson.content}
          </div>
          {lesson.resourceUrl && (
            <a
              href={lesson.resourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 text-xs text-accent hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View resource
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50">
          <button
            onClick={() => onFinish(moduleId, lesson.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark as complete
          </button>
        </div>
      </div>
    </div>
  );
}
