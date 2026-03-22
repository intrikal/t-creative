"use client";

/**
 * IntakeResponsesSection — Displays submitted intake form responses in booking detail.
 *
 * Fetches and renders all intake form submissions for a given booking.
 * Shows field labels with their responses in a clean read-only layout.
 * Used in the staff/admin booking detail view.
 */

import { useState, useEffect } from "react";
import { ClipboardList } from "lucide-react";
import {
  getIntakeSubmissionsForBooking,
  type IntakeFormSubmissionRow,
} from "@/app/dashboard/services/intake-form-actions";
import type { IntakeFormField } from "@/db/schema";

export function IntakeResponsesSection({ bookingId }: { bookingId: number }) {
  const [submissions, setSubmissions] = useState<IntakeFormSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIntakeSubmissionsForBooking(bookingId)
      .then(setSubmissions)
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) return null;
  if (submissions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-muted" />
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Intake Form Responses
        </h3>
      </div>

      {submissions.map((sub) => {
        const fields = (sub.fields ?? []) as IntakeFormField[];

        return (
          <div
            key={sub.id}
            className="rounded-xl border border-border bg-surface/40 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">
                {sub.formName ?? `Form #${sub.formDefinitionId}`}
              </p>
              <span className="text-[10px] text-muted">v{sub.formVersion}</span>
            </div>

            {fields.map((field) => {
              const value = sub.responses?.[field.id];
              return (
                <div key={field.id} className="space-y-0.5">
                  <p className="text-[10px] text-muted font-medium uppercase tracking-wide">
                    {field.label}
                  </p>
                  <p className="text-sm text-foreground">
                    {formatResponse(value, field.type)}
                  </p>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function formatResponse(value: unknown, type: string): string {
  if (value === undefined || value === null || value === "") return "—";
  if (type === "checkbox") return value ? "Yes" : "No";
  if (type === "multiselect" && Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "—";
  }
  return String(value);
}
