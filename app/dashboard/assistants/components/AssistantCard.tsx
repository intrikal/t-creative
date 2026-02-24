"use client";

import { useState } from "react";
import { Star, Clock, ChevronDown, ChevronUp, Phone, Mail, Award } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  type Assistant,
  type AssistantStatus,
  ALL_DAYS,
  statusConfig,
  skillTag,
  ratingStars,
} from "../AssistantsPage";

export function AssistantCard({
  assistant,
  onToggleStatus,
}: {
  assistant: Assistant;
  onToggleStatus: (id: string, status: AssistantStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig(assistant.status);

  const nextStatus: AssistantStatus =
    assistant.status === "active"
      ? "on_leave"
      : assistant.status === "on_leave"
        ? "active"
        : "active";
  const toggleLabel =
    assistant.status === "active"
      ? "Set On Leave"
      : assistant.status === "on_leave"
        ? "Activate"
        : "Activate";

  return (
    <Card className="gap-0">
      <CardContent className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-4">
          <Avatar className="w-12 h-12 shrink-0">
            <AvatarFallback className="text-sm bg-surface text-muted font-semibold">
              {assistant.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">{assistant.name}</h3>
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", status.className)}>
                {status.label}
              </Badge>
            </div>
            <p className="text-xs text-muted mt-0.5">{assistant.role}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {assistant.skills.map((s) => {
                const sk = skillTag(s);
                return (
                  <span
                    key={s}
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                      sk.className,
                    )}
                  >
                    {sk.label}
                  </span>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/60">
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{assistant.thisMonthSessions}</p>
            <p className="text-[10px] text-muted mt-0.5">Sessions</p>
          </div>
          <div className="text-center border-x border-border/60">
            <p className="text-base font-semibold text-foreground flex items-center justify-center gap-0.5">
              {assistant.avgRating}
              <Star className="w-3 h-3 text-[#d4a574] fill-[#d4a574]" />
            </p>
            <p className="text-[10px] text-muted mt-0.5">Avg Rating</p>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">
              ${assistant.totalRevenue.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted mt-0.5">All-Time Rev</p>
          </div>
        </div>
      </CardContent>

      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Contact</p>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
              {assistant.phone || "—"}
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Mail className="w-3.5 h-3.5 text-muted shrink-0" />
              {assistant.email}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
              Shifts
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map((day) => (
                <span
                  key={day}
                  className={cn(
                    "text-[11px] font-medium px-2 py-1 rounded-md border",
                    assistant.shifts.includes(day)
                      ? "bg-foreground/8 text-foreground border-foreground/12"
                      : "bg-transparent text-muted/40 border-border/40",
                  )}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
          {assistant.certifications.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
                Certifications
              </p>
              <div className="space-y-1">
                {assistant.certifications.map((cert) => (
                  <div key={cert} className="flex items-center gap-2 text-xs text-foreground">
                    <Award className="w-3.5 h-3.5 text-[#d4a574] shrink-0" />
                    {cert}
                  </div>
                ))}
              </div>
            </div>
          )}
          {assistant.recentSessions.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
                Recent Sessions
              </p>
              <div className="space-y-2">
                {assistant.recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{session.service}</p>
                      <p className="text-muted">
                        {session.clientName} · {session.date}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {session.revenue > 0 && (
                        <p className="font-medium text-foreground">${session.revenue}</p>
                      )}
                      {session.rating !== null && (
                        <div className="flex items-center gap-0.5 justify-end mt-0.5">
                          {ratingStars(session.rating).map((filled, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-2.5 h-2.5",
                                filled ? "text-[#d4a574] fill-[#d4a574]" : "text-muted",
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            <span className="flex items-center gap-2 text-xs text-muted">
              <Clock className="w-3.5 h-3.5" />
              Hired {assistant.hireDate} · {assistant.totalSessions} total sessions
            </span>
            <button
              onClick={() => onToggleStatus(assistant.id, nextStatus)}
              className={cn(
                "text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors",
                assistant.status === "active"
                  ? "text-[#7a5c10] bg-[#7a5c10]/10 hover:bg-[#7a5c10]/15"
                  : "text-[#4e6b51] bg-[#4e6b51]/10 hover:bg-[#4e6b51]/15",
              )}
            >
              {toggleLabel}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
