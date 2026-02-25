"use client";

import {
  Clock,
  MapPin,
  Pencil,
  Trash2,
  MoreHorizontal,
  Check,
  X,
  CheckCircle,
  CreditCard,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusConfig, categoryDot, type Booking, type BookingStatus } from "../BookingsPage";

export function BookingRow({
  booking,
  menuOpen,
  onToggleMenu,
  onEdit,
  onQuickStatus,
  onCancel,
  onDelete,
  onPayment,
}: {
  booking: Booking;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onQuickStatus: (status: BookingStatus) => void;
  onCancel: () => void;
  onDelete: () => void;
  onPayment: () => void;
}) {
  const status = statusConfig(booking.status);

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 group">
      <div className="flex flex-col items-center gap-1 shrink-0 w-20">
        <span className={cn("w-1.5 h-1.5 rounded-full", categoryDot(booking.category))} />
        <span className="text-[10px] text-muted font-medium">{booking.date}</span>
        <span className="text-[10px] text-muted/70 tabular-nums">{booking.time}</span>
      </div>
      <Avatar size="sm">
        <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
          {booking.clientInitials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{booking.service}</p>
        <p className="text-xs text-muted mt-0.5">
          {booking.client}
          {booking.location && (
            <span className="ml-2 inline-flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {booking.location}
            </span>
          )}
        </p>
        {booking.notes && (
          <p className="text-[10px] text-muted/60 mt-0.5 truncate">{booking.notes}</p>
        )}
      </div>
      <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs text-muted">{booking.staff}</span>
        <span className="text-[10px] text-muted/60 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {booking.durationMin}m
        </span>
      </div>
      <span className="text-sm font-medium text-foreground shrink-0 hidden sm:block w-12 text-right">
        ${booking.price}
      </span>
      <Badge
        className={cn(
          "border text-[10px] px-1.5 py-0.5 shrink-0 w-20 justify-center",
          status.className,
        )}
      >
        {status.label}
      </Badge>
      <div className="relative shrink-0">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleMenu}
            className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
            title="More"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg py-1 z-20 w-36">
            <button
              onClick={onEdit}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/5 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-muted" /> Edit
            </button>
            {booking.status === "pending" && (
              <button
                onClick={() => onQuickStatus("confirmed")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/5 transition-colors"
              >
                <Check className="w-3.5 h-3.5 text-muted" /> Confirm
              </button>
            )}
            {booking.status === "confirmed" && (
              <button
                onClick={onPayment}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/5 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5 text-muted" /> Payment Link
              </button>
            )}
            {(booking.status === "confirmed" || booking.status === "in_progress") && (
              <button
                onClick={() => onQuickStatus("completed")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/5 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5 text-muted" /> Complete
              </button>
            )}
            {booking.status !== "cancelled" && booking.status !== "completed" && (
              <button
                onClick={onCancel}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
