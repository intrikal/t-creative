/**
 * @module OverviewTab
 * Overview tab showing quick glance, lash preferences, last service record,
 * and internal notes for a client.
 */

import { Clock, Heart, StickyNote, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime } from "./helpers";
import type { ClientDetailData, ClientServiceRecordRow } from "./types";

interface OverviewTabProps {
  data: ClientDetailData;
}

/** Simple label/value row used within overview cards. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted shrink-0 w-32 capitalize">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function ServiceRecordDetail({ record }: { record: ClientServiceRecordRow }) {
  return (
    <div className="space-y-2 text-sm pt-3">
      {record.lashMapping && <Row label="Lash mapping" value={record.lashMapping} />}
      {record.curlType && <Row label="Curl type" value={record.curlType} />}
      {record.diameter && <Row label="Diameter" value={record.diameter} />}
      {record.lengths && <Row label="Lengths" value={record.lengths} />}
      {record.adhesive && <Row label="Adhesive" value={record.adhesive} />}
      {record.retentionNotes && <Row label="Retention" value={record.retentionNotes} />}
      {record.productsUsed && <Row label="Products used" value={record.productsUsed} />}
      {record.notes && <Row label="Notes" value={record.notes} />}
      {record.reactions && (
        <div className="flex items-start gap-1.5 text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{record.reactions}</span>
        </div>
      )}
      {record.nextVisitNotes && <Row label="Next visit" value={record.nextVisitNotes} />}
    </div>
  );
}

export function OverviewTab({ data }: OverviewTabProps) {
  const { profile, preferences, bookings: allBookings, serviceRecords: records } = data;
  const lastBooking = allBookings.find((b) => b.status === "completed");
  const nextBooking = allBookings.find(
    (b) => ["pending", "confirmed"].includes(b.status) && new Date(b.startsAt) >= new Date(),
  );
  const lastRecord = records[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Quick glance */}
      <Card className="py-0">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted" /> Quick Glance
          </h3>
          <div className="space-y-2 text-sm">
            <Row label="Last visit" value={lastBooking ? formatDate(lastBooking.startsAt) : "—"} />
            <Row label="Last service" value={lastBooking?.serviceName ?? "—"} />
            <Row
              label="Next appointment"
              value={
                nextBooking
                  ? `${nextBooking.serviceName} — ${formatDateTime(nextBooking.startsAt)}`
                  : "None scheduled"
              }
            />
            <Row
              label="Rebook interval"
              value={
                preferences?.preferredRebookIntervalDays
                  ? `${preferences.preferredRebookIntervalDays} days`
                  : "—"
              }
            />
            {lastRecord?.retentionNotes && (
              <Row label="Retention" value={lastRecord.retentionNotes} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lash preferences */}
      {preferences && (
        <Card className="py-0">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-muted" /> Lash Preferences
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="Style" value={preferences.preferredLashStyle ?? "—"} />
              <Row label="Curl type" value={preferences.preferredCurlType ?? "—"} />
              <Row label="Lengths" value={preferences.preferredLengths ?? "—"} />
              <Row label="Diameter" value={preferences.preferredDiameter ?? "—"} />
              <Row label="Natural lash notes" value={preferences.naturalLashNotes ?? "—"} />
              <Row label="Skin type" value={preferences.skinType ?? "—"} />
              <Row
                label="Adhesive sensitivity"
                value={preferences.adhesiveSensitivity ? "Yes" : "No"}
              />
              {preferences.preferredContactMethod && (
                <Row label="Contact method" value={preferences.preferredContactMethod} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last service record */}
      {lastRecord && (
        <Card className="py-0">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-muted" /> Last Service Record
            </h3>
            <ServiceRecordDetail record={lastRecord} />
          </CardContent>
        </Card>
      )}

      {/* Internal notes */}
      {(profile.internalNotes || preferences?.generalNotes || preferences?.retentionProfile) && (
        <Card className="py-0">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-muted" /> Notes
            </h3>
            <div className="space-y-2 text-sm">
              {profile.internalNotes && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-0.5">
                    Internal
                  </p>
                  <p className="text-foreground">{profile.internalNotes}</p>
                </div>
              )}
              {preferences?.retentionProfile && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-0.5">
                    Retention Profile
                  </p>
                  <p className="text-foreground">{preferences.retentionProfile}</p>
                </div>
              )}
              {preferences?.generalNotes && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-0.5">
                    General
                  </p>
                  <p className="text-foreground">{preferences.generalNotes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
