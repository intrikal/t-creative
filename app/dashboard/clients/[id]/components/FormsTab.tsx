/**
 * @module FormsTab
 * Expandable list of form submissions with key/value detail views.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "./helpers";
import type { ClientDetailData } from "./types";

interface FormsTabProps {
  data: ClientDetailData;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted shrink-0 w-32 capitalize">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function FormsTab({ data }: FormsTabProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (data.formSubmissions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">No form submissions</p>
      </div>
    );
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {data.formSubmissions.map((f) => {
        const open = expanded.has(f.id);
        return (
          <Card key={f.id} className="py-0">
            <CardContent className="p-0">
              <button
                onClick={() => toggle(f.id)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-foreground/3 transition-colors"
              >
                <div className="space-y-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground">{f.formName}</span>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="capitalize">{f.formType}</span>
                    {f.formVersion && <span>v{f.formVersion}</span>}
                    <span>{formatDate(f.submittedAt)}</span>
                  </div>
                </div>
                {open ? (
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                )}
              </button>
              {open && f.data && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <div className="space-y-1.5 pt-3 text-sm">
                    {Object.entries(f.data).map(([key, value]) => (
                      <Row key={key} label={key.replace(/_/g, " ")} value={String(value ?? "—")} />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
