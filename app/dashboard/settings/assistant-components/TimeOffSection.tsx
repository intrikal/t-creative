/**
 * TimeOffSection.tsx
 *
 * Time off request form and past requests list for assistant settings.
 */

import { CalendarOff, Check, Clock, Settings2 } from "lucide-react";
import type { TimeOffRequest } from "@/app/dashboard/settings/assistant-settings-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtDate, STATUS_CFG } from "./helpers";

export interface TimeOffSectionProps {
  requests: TimeOffRequest[];
  newFrom: string;
  newTo: string;
  newReason: string;
  submitted: boolean;
  onNewFromChange: (value: string) => void;
  onNewToChange: (value: string) => void;
  onNewReasonChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function TimeOffSection({
  requests,
  newFrom,
  newTo,
  newReason,
  submitted,
  onNewFromChange,
  onNewToChange,
  onNewReasonChange,
  onSubmit,
  isPending,
}: TimeOffSectionProps) {
  return (
    <div className="space-y-4">
      {/* Submit new request */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-muted" /> Request Time Off
          </CardTitle>
          <p className="text-xs text-muted mt-0.5">Requests go directly to Trini for approval.</p>
        </CardHeader>
        <CardContent className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">From date</label>
              <input
                type="date"
                value={newFrom}
                onChange={(e) => onNewFromChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                To date <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={newTo}
                min={newFrom}
                onChange={(e) => onNewToChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Reason <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              value={newReason}
              onChange={(e) => onNewReasonChange(e.target.value)}
              placeholder="e.g. Family event, Doctor's appointment…"
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            {submitted && (
              <p className="text-xs text-[#4e6b51] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Request sent to Trini!
              </p>
            )}
            <div className="ml-auto">
              <button
                onClick={onSubmit}
                disabled={!newFrom || isPending}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                Submit request
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Past requests */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Your Requests</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Settings2 className="w-8 h-8 text-foreground/15 mb-2" />
              <p className="text-sm text-muted">No requests submitted yet.</p>
            </div>
          ) : (
            requests.map((r) => {
              const cfg = STATUS_CFG[r.status];
              const isSingleDay = r.from === r.to;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-4 px-5 py-3.5 border-b border-border/40 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted" />
                        {isSingleDay ? fmtDate(r.from) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {r.reason} · Submitted {r.submittedOn}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0",
                      cfg.className,
                    )}
                  >
                    {cfg.label}
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
