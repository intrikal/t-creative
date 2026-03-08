"use client";

import { useState } from "react";
import { Phone, Trash2, Plus, Bell, Calendar } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogFooter, Field, Input, Select, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getWaitlist,
  addToWaitlist,
  updateWaitlistStatus,
  removeFromWaitlistById,
} from "../actions";
import type { WaitlistRow, WaitlistInput } from "../actions";
import { categoryDot, type Booking, type ServiceCategory } from "../BookingsPage";

/* ------------------------------------------------------------------ */
/*  Status badge config                                                */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<WaitlistRow["status"], { label: string; className: string }> = {
  waiting: { label: "Waiting", className: "bg-amber-50 text-amber-700 border-amber-100" },
  notified: { label: "Notified", className: "bg-blue-50 text-blue-700 border-blue-100" },
  booked: { label: "Booked", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  expired: { label: "Expired", className: "bg-stone-50 text-stone-600 border-stone-100" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-100" },
};

/* ------------------------------------------------------------------ */
/*  Add to Waitlist Dialog                                             */
/* ------------------------------------------------------------------ */

function AddWaitlistDialog({
  open,
  onClose,
  clients,
  serviceOptions,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  serviceOptions: { id: number; name: string; category: string }[];
  onAdded: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [timePreference, setTimePreference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!clientId || !serviceId) return;
    setSaving(true);
    const input: WaitlistInput = {
      clientId,
      serviceId: Number(serviceId),
      preferredDateStart: dateStart || undefined,
      preferredDateEnd: dateEnd || undefined,
      timePreference: timePreference || undefined,
      notes: notes || undefined,
    };
    await addToWaitlist(input);
    setSaving(false);
    onAdded();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add to Waitlist" size="md">
      <div className="space-y-4">
        <Field label="Client" required>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Service" required>
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Select service…</option>
            {serviceOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Earliest Date">
            <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          </Field>
          <Field label="Latest Date">
            <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Time Preference" hint="e.g. weekends only, after 3pm">
          <Input
            placeholder="Any time"
            value={timePreference}
            onChange={(e) => setTimePreference(e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <Textarea
            rows={2}
            placeholder="Additional notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "Adding…" : "Add to Waitlist"}
        disabled={!clientId || !serviceId || saving}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  WaitlistTab                                                        */
/* ------------------------------------------------------------------ */

export function WaitlistTab({
  pendingBookings,
  onBook,
  onRemove,
  clients,
  serviceOptions,
}: {
  pendingBookings: Booking[];
  onBook: () => void;
  onRemove: (id: number) => void;
  clients: { id: string; name: string }[];
  serviceOptions: { id: number; name: string; category: string }[];
}) {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Load waitlist entries on first render
  if (!loaded) {
    setLoaded(true);
    getWaitlist().then(setWaitlistEntries);
  }

  function refreshWaitlist() {
    getWaitlist().then(setWaitlistEntries);
  }

  async function handleNotify(id: number) {
    await updateWaitlistStatus(id, "notified");
    refreshWaitlist();
  }

  async function handleRemoveEntry(id: number) {
    await removeFromWaitlistById(id);
    setWaitlistEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const activeEntries = waitlistEntries.filter(
    (e) => e.status === "waiting" || e.status === "notified",
  );

  return (
    <div className="space-y-4">
      {/* Pending booking requests (existing behavior) */}
      {pendingBookings.length > 0 && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4 md:px-5">
            <p className="text-sm font-semibold text-foreground">
              Pending Requests
              <span className="ml-2 text-xs text-muted font-normal">
                {pendingBookings.length} client{pendingBookings.length !== 1 ? "s" : ""}
              </span>
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Client
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                      Service
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Notes
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                      Requested
                    </th>
                    <th className="px-4 md:px-5 pb-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {pendingBookings.map((b) => {
                    const initials =
                      `${b.client.charAt(0)}${b.client.split(" ")[1]?.charAt(0) ?? ""}`.toUpperCase();
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors group"
                      >
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">{b.client}</p>
                              {b.clientPhone && (
                                <p className="text-[10px] text-muted flex items-center gap-0.5 mt-0.5">
                                  <Phone className="w-2.5 h-2.5" />
                                  {b.clientPhone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell align-middle">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                categoryDot(b.category),
                              )}
                            />
                            <span className="text-xs text-muted">{b.service}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span className="text-xs text-foreground line-clamp-2">
                            {b.notes || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell align-middle">
                          <span className="text-xs text-muted">{b.date}</span>
                        </td>
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              onClick={onBook}
                              className="text-[11px] text-accent hover:underline font-medium"
                            >
                              Book
                            </button>
                            <button
                              onClick={() => onRemove(b.id)}
                              className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-destructive transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* True waitlist from waitlist table */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-4 md:px-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              Waitlist
              <span className="ml-2 text-xs text-muted font-normal">
                {activeEntries.length} waiting
              </span>
            </p>
            <button
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-3">
          {activeEntries.length === 0 ? (
            <div className="text-center py-10 px-4">
              <p className="text-sm text-muted">No clients on the waitlist.</p>
              <p className="text-xs text-muted/60 mt-1">
                Add clients who want to be notified when a slot opens up.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Client
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                      Service
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                      Preferred Dates
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Notes
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 w-20">
                      Status
                    </th>
                    <th className="px-4 md:px-5 pb-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {activeEntries.map((entry) => {
                    const initials =
                      `${entry.clientName.charAt(0)}${entry.clientName.split(" ")[1]?.charAt(0) ?? ""}`.toUpperCase();
                    const statusCfg = STATUS_CONFIG[entry.status];
                    const dateRange =
                      entry.preferredDateStart || entry.preferredDateEnd
                        ? [entry.preferredDateStart, entry.preferredDateEnd]
                            .filter(Boolean)
                            .join(" – ")
                        : null;

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors group"
                      >
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {entry.clientName}
                              </p>
                              {entry.clientPhone && (
                                <p className="text-[10px] text-muted flex items-center gap-0.5 mt-0.5">
                                  <Phone className="w-2.5 h-2.5" />
                                  {entry.clientPhone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell align-middle">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                categoryDot(entry.serviceCategory as ServiceCategory),
                              )}
                            />
                            <span className="text-xs text-muted">{entry.serviceName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell align-middle">
                          {dateRange ? (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {dateRange}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">Any</span>
                          )}
                          {entry.timePreference && (
                            <p className="text-[10px] text-muted/70 mt-0.5">
                              {entry.timePreference}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span className="text-xs text-foreground line-clamp-2">
                            {entry.notes || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <Badge
                            className={cn("border text-[10px] px-1.5 py-0.5", statusCfg.className)}
                          >
                            {statusCfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            {entry.status === "waiting" && (
                              <button
                                onClick={() => handleNotify(entry.id)}
                                className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
                                title="Mark as notified"
                              >
                                <Bell className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveEntry(entry.id)}
                              className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-destructive transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {addDialogOpen && (
        <AddWaitlistDialog
          open
          onClose={() => setAddDialogOpen(false)}
          clients={clients}
          serviceOptions={serviceOptions}
          onAdded={refreshWaitlist}
        />
      )}
    </div>
  );
}
