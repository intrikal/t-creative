"use client";

import { Pencil, Trash2, Star, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Client, sourceBadge, SVC_LABEL, SVC_COLOR, avatarColor } from "../ClientsPage";

export function ClientCard({
  client,
  onEdit,
  onDelete,
}: {
  client: Client;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  const src = sourceBadge(client.source);
  const av = avatarColor(client.name);

  return (
    <div className="group relative flex flex-col gap-3 p-4 rounded-xl border border-border bg-background hover:shadow-sm transition-all">
      {/* Actions — hover reveal */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(client)}
          className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(client)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top row: avatar + name */}
      <div className="flex items-start gap-3">
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarFallback className={cn("text-xs font-semibold", av)}>
            {client.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 pr-12">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground leading-tight">
              {client.name}
            </span>
            {client.vip && <Star className="w-3 h-3 text-[#d4a574] fill-[#d4a574] shrink-0" />}
          </div>
          <p className="text-xs text-muted truncate mt-0.5">{client.email}</p>
          <p className="text-xs text-muted">{client.phone}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {src && (
          <Badge className={cn("border text-[10px] px-1.5 py-0.5 font-medium", src.className)}>
            {src.label}
          </Badge>
        )}
        {client.services.map((s) => (
          <span
            key={s}
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
              SVC_COLOR[s],
            )}
          >
            {SVC_LABEL[s]}
          </span>
        ))}
      </div>

      {/* Referred by */}
      {client.source === "referral" && client.referredBy && (
        <p className="text-[10px] text-muted -mt-1">
          Referred by <span className="font-medium text-foreground">{client.referredBy}</span>
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-0 pt-2.5 border-t border-border/50">
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{client.totalBookings}</p>
          <p className="text-[10px] text-muted mt-0.5">Visits</p>
        </div>
        <div className="text-center border-x border-border/50">
          <p className="text-sm font-semibold text-foreground">
            ${client.totalSpent.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted mt-0.5">Spent</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground truncate">{client.lastVisit}</p>
          <p className="text-[10px] text-muted mt-0.5">Last visit</p>
        </div>
      </div>

      {/* Notes */}
      {client.notes && (
        <p className="text-[10px] text-muted italic truncate border-t border-border/40 pt-2">
          {client.notes}
        </p>
      )}
    </div>
  );
}
