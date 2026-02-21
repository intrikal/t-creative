"use client";

import { useState } from "react";
import { CheckCircle2, BookOpen, Lock, ChevronDown, ChevronUp, Award, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ModuleCategory = "technique" | "client-care" | "business" | "safety";
type ModuleStatus = "completed" | "in_progress" | "available" | "locked";

interface Lesson {
  id: number;
  title: string;
  durationMin: number;
  completed: boolean;
}

interface TrainingModule {
  id: number;
  title: string;
  category: ModuleCategory;
  status: ModuleStatus;
  lessons: Lesson[];
  dueDate?: string;
  completedDate?: string;
  description: string;
}

const INITIAL_MODULES: TrainingModule[] = [
  {
    id: 1,
    title: "Updated Lash Aftercare Protocol",
    category: "client-care",
    status: "available",
    dueDate: "Feb 24",
    description:
      "New glue formulation requires updated aftercare instructions. Review before your next appointment.",
    lessons: [
      { id: 1, title: "New glue formula — what changed", durationMin: 8, completed: false },
      {
        id: 2,
        title: "Updated aftercare checklist walkthrough",
        durationMin: 12,
        completed: false,
      },
      {
        id: 3,
        title: "How to explain aftercare to new clients",
        durationMin: 10,
        completed: false,
      },
    ],
  },
  {
    id: 2,
    title: "Client Consultation Best Practices",
    category: "client-care",
    status: "available",
    dueDate: "Mar 1",
    description:
      "How to conduct a thorough consultation, capture client preferences, and set accurate expectations.",
    lessons: [
      { id: 1, title: "Pre-appointment intake form review", durationMin: 10, completed: false },
      {
        id: 2,
        title: "Reading lash health & contraindications",
        durationMin: 15,
        completed: false,
      },
      { id: 3, title: "Setting expectations for new clients", durationMin: 8, completed: false },
      { id: 4, title: "Upsell without pressure", durationMin: 6, completed: false },
    ],
  },
  {
    id: 3,
    title: "Intro to Volume Lashing",
    category: "technique",
    status: "completed",
    completedDate: "Jan 2025",
    description:
      "Foundations of volume lash application — fan making, placement, and curl selection.",
    lessons: [
      { id: 1, title: "Fan making — 2D to 5D", durationMin: 20, completed: true },
      { id: 2, title: "Curl and length mapping", durationMin: 15, completed: true },
      { id: 3, title: "Placement and bonding technique", durationMin: 18, completed: true },
      { id: 4, title: "Speed drills", durationMin: 25, completed: true },
    ],
  },
  {
    id: 4,
    title: "Permanent Jewelry Safety & Prep",
    category: "safety",
    status: "completed",
    completedDate: "Nov 2024",
    description: "Proper setup, skin prep, and safety protocol for permanent jewelry welding.",
    lessons: [
      { id: 1, title: "Workspace setup and sanitation", durationMin: 10, completed: true },
      { id: 2, title: "Skin prep and measurements", durationMin: 12, completed: true },
      { id: 3, title: "Welder safety protocol", durationMin: 8, completed: true },
    ],
  },
  {
    id: 5,
    title: "Advanced Volume — Mega Fans",
    category: "technique",
    status: "locked",
    description: "10D–20D mega volume fans. Available after completing 3 months of volume service.",
    lessons: [
      { id: 1, title: "Mega fan structure", durationMin: 20, completed: false },
      { id: 2, title: "Weight and retention considerations", durationMin: 15, completed: false },
      { id: 3, title: "Client candidacy assessment", durationMin: 10, completed: false },
    ],
  },
  {
    id: 6,
    title: "Business & Branding Basics",
    category: "business",
    status: "locked",
    description:
      "Personal branding for beauty professionals — social media, client retention, and referrals.",
    lessons: [
      { id: 1, title: "Building your personal brand", durationMin: 15, completed: false },
      { id: 2, title: "Instagram for lash techs", durationMin: 12, completed: false },
      { id: 3, title: "Client referral systems", durationMin: 10, completed: false },
    ],
  },
];

const CATEGORY_CONFIG: Record<ModuleCategory, { label: string; className: string }> = {
  technique: {
    label: "Technique",
    className: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20",
  },
  "client-care": {
    label: "Client Care",
    className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
  },
  business: { label: "Business", className: "bg-accent/12 text-accent border-accent/20" },
  safety: { label: "Safety", className: "bg-[#7ba3a3]/12 text-[#4a7a7a] border-[#7ba3a3]/20" },
};

export function AssistantTrainingPage() {
  const [modules, setModules] = useState<TrainingModule[]>(INITIAL_MODULES);
  const [expanded, setExpanded] = useState<number | null>(1); // open first module by default

  const completed = modules.filter((m) => m.status === "completed").length;
  const available = modules.filter((m) => m.status === "available").length;
  const totalLessons = modules.flatMap((m) => m.lessons).length;
  const completedLessons = modules.flatMap((m) => m.lessons).filter((l) => l.completed).length;

  function toggleLesson(moduleId: number, lessonId: number) {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id !== moduleId) return mod;
        const updated = mod.lessons.map((l) =>
          l.id === lessonId ? { ...l, completed: !l.completed } : l,
        );
        const allDone = updated.every((l) => l.completed);
        return {
          ...mod,
          lessons: updated,
          status: allDone ? "completed" : mod.status === "completed" ? "available" : mod.status,
          completedDate: allDone ? "Feb 2026" : undefined,
        };
      }),
    );
  }

  function startNextLesson(mod: TrainingModule) {
    const nextLesson = mod.lessons.find((l) => !l.completed);
    if (!nextLesson) return;
    toggleLesson(mod.id, nextLesson.id);
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
          { label: "Modules Completed", value: `${completed}/${modules.length}` },
          { label: "Pending", value: available },
          { label: "Lessons Done", value: `${completedLessons}/${totalLessons}` },
          { label: "Certificates", value: completed },
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
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted font-medium">Overall progress</span>
          <span className="text-foreground font-semibold">
            {Math.round((completedLessons / totalLessons) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-foreground/8">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${(completedLessons / totalLessons) * 100}%` }}
          />
        </div>
      </div>

      {/* Module list */}
      <div className="space-y-3">
        {modules.map((mod) => {
          const cat = CATEGORY_CONFIG[mod.category];
          const isExpanded = expanded === mod.id;
          const isLocked = mod.status === "locked";
          const isCompleted = mod.status === "completed" && mod.lessons.every((l) => l.completed);
          const modLessonsCompleted = mod.lessons.filter((l) => l.completed).length;
          const nextLesson = mod.lessons.find((l) => !l.completed);
          const noneStarted = modLessonsCompleted === 0;

          return (
            <Card key={mod.id} className={cn("gap-0", isLocked && "opacity-60")}>
              {/* Module header — clickable to expand */}
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
                      onClick={() => !isCompleted && toggleLesson(mod.id, lesson.id)}
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
                      <span className="text-[10px] text-muted/60 shrink-0">
                        {lesson.durationMin}m
                      </span>
                    </button>
                  ))}

                  {/* CTA — only when not fully completed */}
                  {!isCompleted && nextLesson && (
                    <div className="px-5 py-3 border-t border-border/30">
                      <button
                        onClick={() => startNextLesson(mod)}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        {noneStarted
                          ? `Start: ${nextLesson.title}`
                          : `Continue: ${nextLesson.title}`}
                      </button>
                    </div>
                  )}

                  {/* All done prompt */}
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
    </div>
  );
}
