"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminAlert } from "../admin-dashboard-types";

export function AdminAlertBanners({ alerts }: { alerts: AdminAlert[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((alert) => {
        const styles = {
          warning: { bar: "bg-[#7a5c10]", bg: "bg-[#7a5c10]/5 border-[#7a5c10]/20", text: "text-[#7a5c10]", Icon: AlertTriangle },
          error: { bar: "bg-destructive", bg: "bg-destructive/5 border-destructive/20", text: "text-destructive", Icon: AlertCircle },
          info: { bar: "bg-accent", bg: "bg-accent/5 border-accent/20", text: "text-accent", Icon: Info },
        }[alert.type];

        return (
          <div
            key={alert.id}
            className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border text-sm", styles.bg)}
          >
            <div className={cn("w-1 self-stretch rounded-full shrink-0", styles.bar)} />
            <styles.Icon className={cn("w-4 h-4 shrink-0", styles.text)} />
            <p className="flex-1 text-foreground text-sm">{alert.message}</p>
            <Link href={alert.href} className={cn("text-xs font-medium shrink-0 hover:underline", styles.text)}>
              {alert.cta}
            </Link>
            <button
              onClick={() => setDismissed((prev) => [...prev, alert.id])}
              className="p-1 rounded-md hover:bg-foreground/8 text-muted hover:text-foreground transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
