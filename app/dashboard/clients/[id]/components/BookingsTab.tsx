/**
 * @module BookingsTab
 * Displays the client's booking history with status badges,
 * timing details, and pricing information.
 */

import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime, formatCents, statusBadge } from "./helpers";
import type { ClientDetailData } from "./types";

interface BookingsTabProps {
  data: ClientDetailData;
}

export function BookingsTab({ data }: BookingsTabProps) {
  if (data.bookings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">No bookings yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.bookings.map((b) => (
        <Card key={b.id} className="py-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{b.serviceName}</span>
                  <Badge
                    className={cn(
                      "border text-[10px] px-1.5 py-0.5 font-medium",
                      statusBadge(b.status),
                    )}
                  >
                    {b.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                  <span>{formatDateTime(b.startsAt)}</span>
                  <span>{b.durationMinutes} min</span>
                  {b.staffName && <span>with {b.staffName}</span>}
                  {b.location && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" /> {b.location}
                    </span>
                  )}
                </div>
                {b.clientNotes && (
                  <p className="text-xs text-muted italic mt-1">Client: {b.clientNotes}</p>
                )}
                {b.staffNotes && <p className="text-xs text-muted italic">Staff: {b.staffNotes}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground">
                  {formatCents(b.totalInCents)}
                </p>
                {b.discountInCents > 0 && (
                  <p className="text-[10px] text-green-600">
                    -{formatCents(b.discountInCents)} discount
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
