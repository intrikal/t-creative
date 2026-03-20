"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Send,
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogFooter, Field, Input, Select, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getNotifications, sendNotification } from "../notification-actions";
import type {
  NotificationRow,
  NotificationInput,
  NotificationType,
  NotificationChannel,
} from "../notification-actions";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const TYPE_CONFIG: Record<NotificationType, { label: string; className: string }> = {
  booking_reminder: {
    label: "Reminder",
    className: "bg-purple-50 text-purple-700 border-purple-100",
  },
  booking_confirmation: {
    label: "Confirmation",
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  booking_cancellation: {
    label: "Cancellation",
    className: "bg-red-50 text-red-600 border-red-100",
  },
  review_request: { label: "Review", className: "bg-amber-50 text-amber-700 border-amber-100" },
  waitlist_alert: { label: "Waitlist", className: "bg-blue-50 text-blue-700 border-blue-100" },
  promotion: { label: "Promo", className: "bg-pink-50 text-pink-700 border-pink-100" },
  form_request: { label: "Form", className: "bg-stone-50 text-stone-600 border-stone-100" },
  general: { label: "General", className: "bg-foreground/8 text-muted border-foreground/12" },
};

const STATUS_ICON: Record<string, { icon: typeof CheckCircle; className: string }> = {
  pending: { icon: Clock, className: "text-amber-500" },
  sent: { icon: Send, className: "text-blue-500" },
  delivered: { icon: CheckCircle, className: "text-emerald-500" },
  failed: { icon: AlertCircle, className: "text-destructive" },
  clicked: { icon: CheckCircle, className: "text-accent" },
};

const CHANNEL_ICON: Record<NotificationChannel, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  internal: Bell,
};

/* ------------------------------------------------------------------ */
/*  Send Notification Dialog                                           */
/* ------------------------------------------------------------------ */

function SendNotificationDialog({
  open,
  onClose,
  clients,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  onSent: () => void;
}) {
  const [profileId, setProfileId] = useState("");
  const [type, setType] = useState<NotificationType>("general");
  const [channel, setChannel] = useState<NotificationChannel>("email");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSend() {
    if (!profileId || !title) return;
    setSaving(true);
    const input: NotificationInput = {
      profileId,
      type,
      channel,
      title,
      body: body || undefined,
    };
    await sendNotification(input);
    setSaving(false);
    onSent();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Send Notification" size="md">
      <div className="space-y-4">
        <Field label="Recipient" required>
          <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as NotificationType)}>
              {Object.entries(TYPE_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Channel">
            <Select
              value={channel}
              onChange={(e) => setChannel(e.target.value as NotificationChannel)}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="internal">Internal</option>
            </Select>
          </Field>
        </div>
        <Field label="Title" required>
          <Input
            placeholder="Notification subject…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Body">
          <Textarea
            rows={3}
            placeholder="Notification message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSend}
        confirmLabel={saving ? "Sending…" : "Send"}
        disabled={!profileId || !title || saving}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Notifications Panel                                                */
/* ------------------------------------------------------------------ */

export function NotificationsPanel({ clients }: { clients: { id: string; name: string }[] }) {
  const [entries, setEntries] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);

  // Fix: load data in useEffect instead of during render
  useEffect(() => {
    getNotifications().then((rows) => {
      setEntries(rows);
      setLoading(false);
    });
  }, []);

  function refresh() {
    getNotifications().then(setEntries);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
        <p className="text-xs text-muted">{loading ? "Loading..." : `${entries.length} notifications`}</p>
        <button
          onClick={() => setSendOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Send
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 py-3">Recipient</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-3">Title</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-3 hidden md:table-cell">Type</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-3 w-20">Status</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-3 hidden lg:table-cell">Sent</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="px-5 py-3.5"><div className="h-4 w-24 rounded bg-surface animate-pulse" /></td>
                    <td className="px-3 py-3.5"><div className="h-4 w-36 rounded bg-surface animate-pulse" /></td>
                    <td className="px-3 py-3.5 hidden md:table-cell"><div className="h-5 w-16 rounded-full bg-surface animate-pulse" /></td>
                    <td className="px-3 py-3.5"><div className="h-4 w-14 rounded bg-surface animate-pulse" /></td>
                    <td className="px-3 py-3.5 hidden lg:table-cell"><div className="h-4 w-20 rounded bg-surface animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
              <Bell className="w-6 h-6 text-muted/40" />
            </div>
            <p className="text-sm font-medium text-foreground">No notifications sent yet</p>
            <p className="text-xs text-muted mt-1.5 max-w-xs">
              Booking reminders, confirmations, and other notifications will appear here once sent.
            </p>
            <button
              onClick={() => setSendOpen(true)}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Send First Notification
            </button>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 py-3">
                    Recipient
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-3">
                    Title
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-3 hidden md:table-cell">
                    Type
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-3 hidden lg:table-cell">
                    Channel
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-3 w-20">
                    Status
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-3 hidden lg:table-cell">
                    Sent
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((n) => {
                  const typeCfg = TYPE_CONFIG[n.type];
                  const statusCfg = STATUS_ICON[n.status] ?? STATUS_ICON.pending;
                  const StatusIcon = statusCfg.icon;
                  const ChannelIcon = CHANNEL_ICON[n.channel];

                  return (
                    <tr
                      key={n.id}
                      className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      title={n.errorMessage ?? undefined}
                    >
                      <td className="px-5 py-3.5 align-middle">
                        <p className="text-sm font-medium text-foreground truncate max-w-[140px]">
                          {n.recipientName}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <p className="text-xs text-foreground truncate max-w-[200px]">
                          {n.title}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 align-middle hidden md:table-cell">
                        <Badge
                          className={cn("border text-[10px] px-1.5 py-0.5", typeCfg.className)}
                        >
                          {typeCfg.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-3.5 align-middle hidden lg:table-cell">
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <ChannelIcon className="w-3 h-3" />
                          {n.channel}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <span className="flex items-center gap-1">
                          <StatusIcon className={cn("w-3.5 h-3.5", statusCfg.className)} />
                          <span className="text-xs text-muted capitalize">{n.status}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5 align-middle hidden lg:table-cell">
                        <span className="text-xs text-muted">
                          {n.sentAt ? formatDate(n.sentAt) : formatDate(n.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sendOpen && (
        <SendNotificationDialog
          open
          onClose={() => setSendOpen(false)}
          clients={clients}
          onSent={refresh}
        />
      )}
    </div>
  );
}
