/**
 * Client card for the grid view on the Clients page. Wraps in a Link to
 * the client detail page. Shows avatar, name, VIP star, contact info,
 * source/lifecycle/service badges, referral info, visit/spend/last-visit
 * stats, and a notes preview. Hover reveals edit, delete, preferences,
 * and waivers action buttons.
 *
 * Parent: app/dashboard/clients/ClientsPage.tsx
 *
 * Key operations:
 *   sourceBadge(client.source) — returns {label, className} for the acquisition source
 *   avatarColor(client.name)   — deterministic color from first char code % palette length
 *   client.services.map()      — renders category tags using SVC_LABEL/SVC_COLOR lookups
 *   Action buttons use e.preventDefault() + e.stopPropagation() to prevent
 *   the Link navigation when clicking edit/delete/preferences/waivers.
 */
"use client";

import Link from "next/link";
import { Pencil, Trash2, Star, Heart, FileText, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Client, sourceBadge, SVC_LABEL, SVC_COLOR, avatarColor } from "../ClientsPage";

export function ClientCard({
  client,
  onEdit,
  onDelete,
  onPreferences,
  onWaivers,
}: {
  client: Client;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
  onPreferences: (c: Client) => void;
  onWaivers: (c: Client) => void;
}) {
  const src = sourceBadge(client.source);
  const av = avatarColor(client.name);

  return (
    <Link
      href={`/dashboard/clients/${client.id}`}
      className="group relative flex flex-col gap-3 p-4 rounded-xl border border-border bg-background hover:shadow-sm transition-all cursor-pointer"
    >
      {/* Actions — hover reveal */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.preventDefault(); onWaivers(client); }}
          className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
          title="Waivers & Forms"
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onPreferences(client); }}
          className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
          title="Preferences"
        >
          <Heart className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onEdit(client); }}
          className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onDelete(client); }}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted hover:text-destructive transition-colors"
          title="Delete"
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
        {client.lifecycleStage && (
          <Badge
            className={cn(
              "border text-[10px] px-1.5 py-0.5 font-medium",
              client.lifecycleStage === "prospect" && "bg-blue-50 text-blue-700 border-blue-100",
              client.lifecycleStage === "active" && "bg-green-50 text-green-700 border-green-100",
              client.lifecycleStage === "at_risk" && "bg-amber-50 text-amber-700 border-amber-100",
              client.lifecycleStage === "lapsed" &&
                "bg-orange-50 text-orange-700 border-orange-100",
              client.lifecycleStage === "churned" && "bg-red-50 text-red-600 border-red-100",
            )}
          >
            {client.lifecycleStage === "at_risk"
              ? "At Risk"
              : client.lifecycleStage.charAt(0).toUpperCase() + client.lifecycleStage.slice(1)}
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

      {/* Referred by / referral count */}
      {(client.source === "referral" && client.referredBy) || client.referralCount > 0 ? (
        <div className="flex items-center justify-between -mt-1">
          {client.source === "referral" && client.referredBy ? (
            <p className="text-[10px] text-muted">
              Referred by <span className="font-medium text-foreground">{client.referredBy}</span>
            </p>
          ) : (
            <span />
          )}
          {client.referralCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-1.5 py-0.5">
              <Users className="w-2.5 h-2.5" />
              {client.referralCount} referred
            </span>
          )}
        </div>
      ) : null}

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
    </Link>
  );
}
