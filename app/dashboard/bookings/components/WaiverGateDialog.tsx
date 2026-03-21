/**
 * Waiver gate dialog — blocks booking confirmation when required waivers
 * are unsigned. Lists missing waivers and lets admin send the client
 * a waiver completion link via email. Shows success confirmation once sent.
 *
 * Parent: app/dashboard/bookings/BookingsPage.tsx
 *
 * State:
 *   sending — true while the sendWaiverLink server action is in flight
 *   sent    — flips to true on success, switches UI to confirmation view
 *   error   — error message if the email send fails
 *
 * Key operations:
 *   handleSendLink — calls sendWaiverLink server action, toggles sent/error
 *   handleClose    — resets sent/error state before closing so next open is clean
 *   missingWaivers.map() — renders each unsigned form as a row with icon + type badge
 */
"use client";

import { useState } from "react";
import { AlertTriangle, Send, FileText, CheckCircle2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { sendWaiverLink, type MissingWaiver } from "../waiver-actions";
import type { Booking } from "./helpers";

export function WaiverGateDialog({
  target,
  missingWaivers,
  onClose,
  onWaiversSent,
}: {
  target: Booking | null;
  missingWaivers: MissingWaiver[];
  onClose: () => void;
  onWaiversSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSendLink() {
    if (!target) return;
    setSending(true);
    setError("");

    try {
      const success = await sendWaiverLink(target.id);
      if (success) {
        setSent(true);
        onWaiversSent();
      } else {
        setError("Failed to send email. Check that the client has email notifications enabled.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setSent(false);
    setError("");
    onClose();
  }

  return (
    <Dialog
      open={!!target}
      onClose={handleClose}
      title="Waiver Required"
      description={
        target
          ? `${target.client} must complete required waivers before this booking can be confirmed.`
          : ""
      }
    >
      {sent ? (
        <div className="py-4 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-stone-900 mb-1">Waiver Link Sent</p>
          <p className="text-xs text-stone-500">
            {target?.client} will receive an email with a link to complete their waivers. Once
            signed, you can confirm this booking.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <p className="font-medium mb-1">
                This booking cannot be confirmed until all required waivers are signed.
              </p>
              <p>
                For services that apply chemicals near the eyes, signed consent is required for
                liability protection.
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Missing waivers ({missingWaivers.length})
            </p>
            {missingWaivers.map((w) => (
              <div
                key={w.formId}
                className="flex items-center gap-2.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
              >
                <FileText className="w-4 h-4 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-stone-900">{w.formName}</p>
                  <p className="text-[10px] text-stone-400 uppercase">{w.formType}</p>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200/50 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}
        </>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleClose}
          className="flex-1 py-2 rounded-xl border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
        >
          {sent ? "Done" : "Cancel"}
        </button>
        {!sent && (
          <button
            onClick={handleSendLink}
            disabled={sending}
            className="flex-1 py-2 rounded-xl bg-[#96604a] text-white text-sm font-medium hover:bg-[#7a4e3a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending..." : "Send Waiver Link"}
          </button>
        )}
      </div>
    </Dialog>
  );
}
