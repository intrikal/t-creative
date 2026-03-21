/**
 * AssistantCard — Expandable card for a single assistant/staff member.
 *
 * Collapsed view: avatar, name, status badge, skill tags, and three KPI
 * metrics (sessions this month, avg rating, all-time revenue).
 *
 * Expanded view: contact info, editable commission & tip-split settings,
 * shift schedule, certifications, recent sessions, and a status toggle.
 *
 * Commission editing is inline (no dialog) — the admin clicks the pencil
 * icon, edits values, and saves. This avoids modal fatigue when updating
 * multiple assistants in sequence.
 */
"use client";

import { useState } from "react";
import {
  Star,
  Clock,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Award,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CommissionType } from "../actions";
import {
  type Assistant,
  type AssistantStatus,
  ALL_DAYS,
  statusConfig,
  skillTag,
  ratingStars,
} from "../AssistantsPage";

type CommissionDraft = {
  commissionType: CommissionType;
  commissionRate: string;
  commissionFlatFee: string;
  tipSplitPercent: string;
};

export function AssistantCard({
  assistant,
  onToggleStatus,
  onUpdateCommissionSettings,
}: {
  assistant: Assistant;
  onToggleStatus: (id: string, status: AssistantStatus) => void;
  onUpdateCommissionSettings: (
    id: string,
    settings: {
      commissionType: CommissionType;
      commissionRate?: number;
      commissionFlatFee?: number;
      tipSplitPercent?: number;
    },
  ) => void;
}) {
  /** expanded: whether the card's detail section is visible */
  const [expanded, setExpanded] = useState(false);
  /** editingCommission: toggles the inline commission editor form */
  const [editingCommission, setEditingCommission] = useState(false);
  /** draft: local working copy of commission settings while editing */
  const [draft, setDraft] = useState<CommissionDraft>({
    commissionType: assistant.commissionType,
    commissionRate: String(assistant.commissionRate ?? 60),
    commissionFlatFee: String(((assistant.commissionFlatFee ?? 0) / 100).toFixed(2)),
    tipSplitPercent: String(assistant.tipSplitPercent ?? 100),
  });
  const status = statusConfig(assistant.status);

  // ternary: cycle between active ↔ on_leave; inactive always goes to active.
  // This maps to the single toggle button shown at the card's bottom.
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

  function startEditing() {
    setDraft({
      commissionType: assistant.commissionType,
      commissionRate: String(assistant.commissionRate ?? 60),
      commissionFlatFee: String(((assistant.commissionFlatFee ?? 0) / 100).toFixed(2)),
      tipSplitPercent: String(assistant.tipSplitPercent ?? 100),
    });
    setEditingCommission(true);
  }

  function saveCommission() {
    const type = draft.commissionType;
    const rate = Math.min(100, Math.max(0, Number(draft.commissionRate) || 60));
    const flatFee = Math.max(0, Math.round(Number(draft.commissionFlatFee) * 100) || 0);
    const tipSplit = Math.min(100, Math.max(0, Number(draft.tipSplitPercent) || 100));
    onUpdateCommissionSettings(assistant.id, {
      commissionType: type,
      commissionRate: type === "percentage" ? rate : undefined,
      commissionFlatFee: type === "flat_fee" ? flatFee : undefined,
      tipSplitPercent: tipSplit,
    });
    setEditingCommission(false);
  }

  // ternary: format the commission value as either a dollar flat-fee
  // per session or a percentage of revenue, matching the stored type
  const commissionLabel =
    assistant.commissionType === "flat_fee"
      ? `$${((assistant.commissionFlatFee ?? 0) / 100).toFixed(0)}/session`
      : `${assistant.commissionRate ?? 60}%`;

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
              {/* map: render one colour-coded pill per skill tag */}
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

          {/* Commission & tip settings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Commission & Tips
              </p>
              {!editingCommission && (
                <button
                  onClick={startEditing}
                  className="p-1 rounded text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>

            {editingCommission ? (
              <div className="space-y-3 bg-surface/60 rounded-xl p-3 border border-border/60">
                {/* Commission type */}
                <div>
                  <p className="text-[10px] text-muted mb-1.5">Commission type</p>
                  <div className="flex gap-2">
                    {(["percentage", "flat_fee"] as CommissionType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDraft((d) => ({ ...d, commissionType: t }))}
                        className={cn(
                          "flex-1 text-xs py-1.5 rounded-lg border transition-colors font-medium",
                          draft.commissionType === t
                            ? "bg-accent text-white border-accent"
                            : "bg-background text-muted border-border hover:border-foreground/20",
                        )}
                      >
                        {t === "percentage" ? "% of Revenue" : "Flat / Session"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rate or flat fee */}
                {draft.commissionType === "percentage" ? (
                  <div>
                    <p className="text-[10px] text-muted mb-1">Commission rate</p>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={draft.commissionRate}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, commissionRate: e.target.value }))
                        }
                        className="w-16 text-sm text-foreground bg-background border border-border rounded-md px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <span className="text-sm text-muted">%</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] text-muted mb-1">Flat fee per session</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.commissionFlatFee}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, commissionFlatFee: e.target.value }))
                        }
                        className="w-20 text-sm text-foreground bg-background border border-border rounded-md px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>
                )}

                {/* Tip split */}
                <div>
                  <p className="text-[10px] text-muted mb-1">Assistant keeps % of tips</p>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.tipSplitPercent}
                      onChange={(e) => setDraft((d) => ({ ...d, tipSplitPercent: e.target.value }))}
                      className="w-16 text-sm text-foreground bg-background border border-border rounded-md px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <span className="text-sm text-muted">%</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveCommission}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
                  >
                    <Check className="w-3 h-3" /> Save
                  </button>
                  <button
                    onClick={() => setEditingCommission(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-xs text-muted rounded-lg hover:bg-foreground/5 transition-colors"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-[10px] text-muted">Service commission</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                    {commissionLabel}
                    <span className="text-[10px] font-normal text-muted ml-1">
                      {assistant.commissionType === "flat_fee" ? "flat" : "of revenue"}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">Tip split</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                    {assistant.tipSplitPercent ?? 100}%
                    <span className="text-[10px] font-normal text-muted ml-1">to assistant</span>
                  </p>
                </div>
              </div>
            )}
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
