/**
 * EnrollModal.tsx
 * Confirmation modal for program enrollment or waitlist sign-up.
 * Used by the client-facing training page.
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientProgram } from "@/lib/types/training.types";
import { PROG_STYLE, FORMAT_LABEL } from "./client-helpers";

export function EnrollModal({
  program,
  isWaitlist,
  onClose,
  onConfirm,
  isPending,
}: {
  program: ClientProgram;
  isWaitlist: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const style = PROG_STYLE[program.type];
  const deposit = Math.round(program.price * 0.5);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">
            {isWaitlist ? "Join Waitlist" : "Enroll in Program"}
          </p>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className={cn("p-3 rounded-xl border", style.bg, style.border)}>
            <p className={cn("text-sm font-semibold", style.text)}>{program.name}</p>
            <p className="text-xs text-muted mt-0.5">
              ${program.price.toLocaleString()} · {program.modules.length} modules ·{" "}
              {FORMAT_LABEL[program.format] ?? program.format}
            </p>
          </div>
          {isWaitlist ? (
            <p className="text-xs text-muted leading-relaxed">
              This program is full. Join the waitlist and you&apos;ll be notified when a spot opens.
              No payment required now.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted leading-relaxed">
                A 50% deposit of{" "}
                <span className="font-semibold text-foreground">${deposit.toLocaleString()}</span>{" "}
                is required to secure your spot. The remaining balance is due before your first
                session.
              </p>
              <p className="text-xs text-muted leading-relaxed">
                T Creative Studio will reach out within 24–48 hours to confirm your enrollment and
                share prep details.
              </p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            {isWaitlist ? "Join Waitlist" : "Confirm & Pay Deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}
