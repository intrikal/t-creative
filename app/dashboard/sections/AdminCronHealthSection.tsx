/**
 * AdminCronHealthSection — Cron job health dashboard widget.
 *
 * Shows last run time and status for every scheduled cron job.
 * Renders as a Server Component — streamed independently via Suspense.
 */
import { CheckCircle2, XCircle, Clock, MinusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCronHealth } from "./cron-health-queries";

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelative(date: Date | null): string {
  if (!date) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "Just now";
}

function humanizeName(cronName: string): string {
  return cronName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function AdminCronHealthSection() {
  const jobs = await getCronHealth();
  const failCount = jobs.filter((j) => j.lastStatus === "failure").length;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Cron Health</CardTitle>
          {failCount > 0 ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              {failCount} failing
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#4e6b51]/10 text-[#4e6b51] border border-[#4e6b51]/20">
              All healthy
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-2">
        <div className="space-y-0">
          {jobs.map((job) => (
            <div
              key={job.cronName}
              className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
            >
              {/* Status icon */}
              {job.lastStatus === "success" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4e6b51] shrink-0" />
              )}
              {job.lastStatus === "failure" && (
                <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
              )}
              {job.lastStatus === "never" && (
                <MinusCircle className="w-3.5 h-3.5 text-muted shrink-0" />
              )}

              {/* Name */}
              <span
                className={cn(
                  "flex-1 text-xs font-medium truncate",
                  job.lastStatus === "failure" ? "text-destructive" : "text-foreground",
                )}
              >
                {humanizeName(job.cronName)}
              </span>

              {/* Duration */}
              {job.lastDurationMs !== null && (
                <span className="text-[10px] text-muted shrink-0 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDuration(job.lastDurationMs)}
                </span>
              )}

              {/* Last run */}
              <span className="text-[10px] text-muted shrink-0 w-14 text-right">
                {formatRelative(job.lastRunAt)}
              </span>
            </div>
          ))}
        </div>

        {/* Error detail for failing jobs */}
        {jobs
          .filter((j) => j.lastStatus === "failure" && j.lastError)
          .map((j) => (
            <div
              key={`err-${j.cronName}`}
              className="mt-2 rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2"
            >
              <p className="text-[10px] font-semibold text-destructive mb-0.5">
                {humanizeName(j.cronName)}
              </p>
              <p className="text-[10px] text-destructive/80 break-all line-clamp-2">
                {j.lastError}
              </p>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
