import Link from "next/link";
import { MapPin, Clock, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminBooking, AdminInquiry, AdminClient } from "../admin-dashboard-types";
import {
  bookingStatusConfig,
  categoryDot,
  categoryLabel,
  inquiryStatusConfig,
  sourceBadge,
} from "../admin-dashboard-helpers";

export function BookingRow({ booking }: { booking: AdminBooking }) {
  const status = bookingStatusConfig(booking.status);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex flex-col items-center gap-1.5 shrink-0 w-16">
        <span className={cn("w-1.5 h-1.5 rounded-full", categoryDot(booking.category))} />
        <span className="text-xs text-muted font-medium tabular-nums">{booking.time}</span>
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
            <span className="ml-1.5 inline-flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {booking.location}
            </span>
          )}
        </p>
      </div>
      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs text-muted">{booking.staff}</span>
        <span className="text-[10px] text-muted/60 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {booking.durationMin}m
        </span>
      </div>
      <Badge className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}>
        {status.label}
      </Badge>
    </div>
  );
}

export function InquiryRow({ inquiry }: { inquiry: AdminInquiry }) {
  const status = inquiryStatusConfig(inquiry.status);
  return (
    <div className="flex gap-3 py-3 border-b border-border/50 last:border-0">
      <Avatar size="sm">
        <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
          {inquiry.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{inquiry.name}</span>
          <Badge className={cn("border text-[10px] px-1.5 py-0.5", status.className)}>
            {status.label}
          </Badge>
          {inquiry.interest && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-foreground/5 text-muted border-foreground/8">
              {categoryLabel(inquiry.interest)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">{inquiry.message}</p>
        <p className="text-[10px] text-muted/60 mt-1">{inquiry.time}</p>
      </div>
    </div>
  );
}

export function ClientRow({ client }: { client: AdminClient }) {
  const src = sourceBadge(client.source);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <Avatar>
        <AvatarFallback className="bg-surface text-muted text-xs font-semibold">
          {client.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{client.name}</span>
          {client.vip && (
            <Star className="w-3 h-3 text-[#d4a574] fill-[#d4a574]" aria-label="VIP" />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <Badge className={cn("border text-[10px] px-1.5 py-0.5", src.className)}>
            {src.label}
          </Badge>
          {client.services.map((s) => (
            <span
              key={s}
              className={cn("w-1.5 h-1.5 rounded-full shrink-0", categoryDot(s))}
              title={categoryLabel(s)}
            />
          ))}
        </div>
      </div>
      <span className="text-[10px] text-muted/70 shrink-0 hidden sm:block">{client.joinedAgo}</span>
    </div>
  );
}
