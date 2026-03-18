/**
 * @module MessagesTab
 * Message threads list showing subject, type, status,
 * message count, and unread indicators.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, statusBadge } from "./helpers";
import type { ClientDetailData } from "./types";

interface MessagesTabProps {
  data: ClientDetailData;
}

export function MessagesTab({ data }: MessagesTabProps) {
  if (data.threads.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">No message threads</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.threads.map((t) => (
        <Card key={t.id} className="py-0">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate">{t.subject}</span>
                {t.unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Badge className="border text-[10px] px-1.5 py-0.5 font-medium bg-stone-50 text-stone-600 border-stone-100">
                  {t.threadType}
                </Badge>
                <Badge
                  className={cn(
                    "border text-[10px] px-1.5 py-0.5 font-medium",
                    statusBadge(t.status),
                  )}
                >
                  {t.status}
                </Badge>
                <span>{t.messageCount} messages</span>
              </div>
            </div>
            <span className="text-xs text-muted shrink-0">{formatDate(t.lastMessageAt)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
