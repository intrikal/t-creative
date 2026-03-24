/**
 * ExportButton — Admin data export dialog.
 *
 * Opens a modal that lets the admin select a data type and date range,
 * then triggers a CSV download from GET /api/export.
 *
 * All exports are recorded in the audit log server-side.
 */
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Dialog, Field, Input, Select } from "@/components/ui/dialog";

const EXPORT_OPTIONS = [
  { value: "clients", label: "Client List" },
  { value: "bookings", label: "Bookings" },
  { value: "payments", label: "Payments / Transactions" },
  { value: "expenses", label: "Expenses" },
  { value: "invoices", label: "Invoices" },
  { value: "orders", label: "Orders & Commissions" },
] as const;

type ExportType = (typeof EXPORT_OPTIONS)[number]["value"];

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function oneYearAgoStr(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

export function ExportButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ExportType>("payments");
  const [from, setFrom] = useState(oneYearAgoStr);
  const [to, setTo] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setError(null);
    setLoading(true);

    try {
      const params = new URLSearchParams({ type, from, to });
      const res = await fetch(`/api/export?${params}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Export failed. Please try again.");
        return;
      }

      // Trigger browser download
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `${type}-export.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-foreground border border-border hover:bg-foreground/8 hover:border-foreground/20 transition-colors flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>

      <Dialog
        open={open}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        title="Export Data"
        description="Download a CSV of your business data. All exports are logged."
        size="sm"
      >
        <div className="space-y-4">
          <Field label="Data type" required>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as ExportType)}
              disabled={loading}
            >
              {EXPORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required>
              <Input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field label="To" required>
              <Input
                type="date"
                value={to}
                min={from}
                max={todayStr()}
                onChange={(e) => setTo(e.target.value)}
                disabled={loading}
              />
            </Field>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setOpen(false)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors rounded-lg hover:bg-foreground/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={loading || !from || !to}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
