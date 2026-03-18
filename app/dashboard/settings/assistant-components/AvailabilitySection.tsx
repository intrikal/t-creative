/**
 * AvailabilitySection.tsx
 *
 * Weekly availability toggles and time inputs with save button for assistant settings.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DAY_LABELS, DAY_ORDER } from "./helpers";

export type AvailabilityMap = Record<number, { on: boolean; start: string; end: string }>;

export interface AvailabilitySectionProps {
  availability: AvailabilityMap;
  onChange: (updated: AvailabilityMap) => void;
  onSave: () => void;
  isPending: boolean;
  saved: boolean;
}

export function AvailabilitySection({
  availability,
  onChange,
  onSave,
  isPending,
  saved,
}: AvailabilitySectionProps) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <CardTitle className="text-sm font-semibold">Weekly Availability</CardTitle>
        <p className="text-xs text-muted mt-0.5">
          Set your regular working hours. Trini uses this for scheduling.
        </p>
      </CardHeader>
      <CardContent className="px-5 py-4 space-y-3">
        {DAY_ORDER.map((dow) => {
          const a = availability[dow];
          const label = DAY_LABELS[dow];
          return (
            <div key={dow} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-28 shrink-0">
                <button
                  onClick={() =>
                    onChange({
                      ...availability,
                      [dow]: { ...availability[dow], on: !availability[dow].on },
                    })
                  }
                  className={cn(
                    "w-8 rounded-full transition-colors relative shrink-0",
                    a.on ? "bg-accent" : "bg-foreground/15",
                  )}
                  style={{ height: "18px", width: "32px" }}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform",
                      a.on ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
                <span
                  className={cn("text-xs font-medium", a.on ? "text-foreground" : "text-muted")}
                >
                  {label}
                </span>
              </div>
              {a.on ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={a.start}
                    onChange={(e) =>
                      onChange({
                        ...availability,
                        [dow]: { ...availability[dow], start: e.target.value },
                      })
                    }
                    className="px-2 py-1 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                  />
                  <span className="text-xs text-muted">to</span>
                  <input
                    type="time"
                    value={a.end}
                    onChange={(e) =>
                      onChange({
                        ...availability,
                        [dow]: { ...availability[dow], end: e.target.value },
                      })
                    }
                    className="px-2 py-1 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                  />
                </div>
              ) : (
                <span className="text-xs text-muted/50 italic">Off</span>
              )}
            </div>
          );
        })}
        <div className="flex justify-end pt-2">
          <button
            onClick={onSave}
            disabled={isPending}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {saved ? "Saved!" : "Save availability"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
