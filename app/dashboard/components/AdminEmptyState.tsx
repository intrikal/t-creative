import type React from "react";
import Link from "next/link";

export function EmptyState({
  icon: Icon, message, detail, actionLabel, actionHref,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="py-8 text-center">
      <Icon className="w-7 h-7 text-foreground/15 mx-auto mb-2" />
      <p className="text-sm text-muted/60 font-medium">{message}</p>
      <p className="text-xs text-muted/40 mt-0.5">{detail}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="text-xs text-accent hover:underline mt-2 inline-block">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
