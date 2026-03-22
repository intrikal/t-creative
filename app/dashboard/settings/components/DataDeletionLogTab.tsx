/**
 * DataDeletionLogTab — Admin view of CCPA data deletion requests.
 *
 * Displays a table of all processed deletion requests pulled from
 * the audit_log (entityType = "ccpa_deletion_request"). Each row
 * shows the original email (captured at deletion time), timestamp,
 * IP address, and number of media items deleted.
 *
 * Read-only — no mutations from this tab.
 */
"use client";

import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CcpaDeletionEntry } from "@/lib/types/settings.types";

export function DataDeletionLogTab({ entries }: { entries: CcpaDeletionEntry[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Data Deletion Requests</h2>
        <p className="text-xs text-muted mt-0.5">
          CCPA &quot;Right to Delete&quot; — log of processed client data deletion requests
        </p>
      </div>

      <Card className="gap-0">
        <CardContent className="px-0 pb-0 pt-0">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="w-8 h-8 text-muted/40 mb-3" />
              <p className="text-sm font-medium text-muted">No deletion requests</p>
              <p className="text-xs text-muted/70 mt-1">
                Processed CCPA data deletion requests will appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                      Original Email
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                      Media Deleted
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-foreground/[0.02] transition-colors">
                      <td className="px-5 py-3 text-foreground whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3 text-foreground font-mono text-xs">
                        {entry.email}
                      </td>
                      <td className="px-5 py-3 text-muted font-mono text-xs">
                        {entry.actorId ? `${entry.actorId.slice(0, 8)}...` : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {entry.mediaItemsDeleted > 0 ? entry.mediaItemsDeleted : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted font-mono text-xs">
                        {entry.ipAddress ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted">
        Deletion records are retained indefinitely for regulatory compliance. Client profiles shown
        as &quot;Deleted User&quot; in booking and payment history.
      </p>
    </div>
  );
}
