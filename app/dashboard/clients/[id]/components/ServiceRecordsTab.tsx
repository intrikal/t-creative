/**
 * @module ServiceRecordsTab
 * Expandable list of service records with detailed lash mapping,
 * product, and retention information per record.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "./helpers";
import type { ClientDetailData, ClientServiceRecordRow } from "./types";

interface ServiceRecordsTabProps {
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

export function ServiceRecordDetail({ record }: { record: ClientServiceRecordRow }) {
  return (
    <div className="space-y-2 text-sm pt-3">
      {record.lashMapping && <Row label="Lash mapping" value={record.lashMapping} />}
      {record.curlType && <Row label="Curl type" value={record.curlType} />}
      {record.diameter && <Row label="Diameter" value={record.diameter} />}
      {record.lengths && <Row label="Lengths" value={record.lengths} />}
      {record.adhesive && <Row label="Adhesive" value={record.adhesive} />}
      {record.retentionNotes && <Row label="Retention" value={record.retentionNotes} />}
      {record.productsUsed && <Row label="Products used" value={record.productsUsed} />}
      {record.notes && <Row label="Notes" value={record.notes} />}
      {record.reactions && (
        <div className="flex items-start gap-1.5 text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{record.reactions}</span>
        </div>
      )}
      {record.nextVisitNotes && <Row label="Next visit" value={record.nextVisitNotes} />}
    </div>
  );
}

export function ServiceRecordsTab({ data }: ServiceRecordsTabProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (data.serviceRecords.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">No service records yet</p>
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
      {data.serviceRecords.map((sr) => {
        const open = expanded.has(sr.id);
        return (
          <Card key={sr.id} className="py-0">
            <CardContent className="p-0">
              <button
                onClick={() => toggle(sr.id)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-foreground/3 transition-colors"
              >
                <div className="space-y-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground">{sr.serviceName}</span>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{formatDate(sr.bookingDate)}</span>
                    {sr.staffName && <span>by {sr.staffName}</span>}
                  </div>
                </div>
                {open ? (
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                )}
              </button>
              {open && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <ServiceRecordDetail record={sr} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
