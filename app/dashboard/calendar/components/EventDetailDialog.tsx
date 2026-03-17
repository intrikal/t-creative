/**
 * @file EventDetailDialog.tsx
 * @description Read-only event detail dialog with edit/delete actions.
 */

import { CalendarDays, Clock, User, Users, MapPin, Pencil, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { DAY_NAMES_SHORT, MONTH_NAMES, TYPE_C, TYPE_LABELS } from "./constants";
import { parseDate, fmt12 } from "./helpers";
import type { CalEvent } from "./types";

export function EventDetailDialog({
  event,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = TYPE_C[event.type];
  const d = parseDate(event.date);

  return (
    <Dialog open title={event.title} onClose={onClose}>
      <div className="space-y-4">
        <span
          className="inline-block text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ backgroundColor: c.bg, color: c.text, outline: `1px solid ${c.border}40` }}
        >
          {TYPE_LABELS[event.type]}
        </span>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <CalendarDays className="w-4 h-4 shrink-0" />
            <span>
              {DAY_NAMES_SHORT[d.getDay()]}, {MONTH_NAMES[d.getMonth()]} {d.getDate()}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {fmt12(event.startTime)} · {event.durationMin} min
            </span>
          </div>
          {event.staff && (
            <div className="flex items-center gap-2.5 text-sm text-muted">
              <User className="w-4 h-4 shrink-0" />
              <span>{event.staff}</span>
            </div>
          )}
          {event.client && (
            <div className="flex items-center gap-2.5 text-sm text-muted">
              <Users className="w-4 h-4 shrink-0" />
              <span>{event.client}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2.5 text-sm text-muted">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
          {event.notes && (
            <p className="text-sm text-muted bg-surface rounded-lg p-3 border border-border">
              {event.notes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-destructive/10 text-muted hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>
    </Dialog>
  );
}
