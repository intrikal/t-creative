/**
 * dialog.tsx — Custom modal dialog system for the dashboard.
 *
 * Provides a portal-rendered Dialog with backdrop blur, Escape-to-close,
 * body scroll lock, focus trapping, focus restore, and size variants.
 * Also exports form field primitives (Field, Input, Textarea, Select)
 * and a DialogFooter with cancel/confirm buttons.
 *
 * WCAG 2.1 AA compliance:
 * - role="dialog" + aria-modal="true" (WCAG 1.3.1)
 * - aria-labelledby pointing to title h2 (WCAG 1.3.1)
 * - aria-describedby pointing to description (WCAG 1.3.1)
 * - Focus trapping within dialog (WCAG 2.4.3)
 * - Focus restored to trigger element on close (WCAG 2.4.3)
 * - Initial focus on first focusable element (WCAG 2.4.3)
 */
"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Focus trap helper                                                   */
/* ------------------------------------------------------------------ */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(container: HTMLElement, e: KeyboardEvent) {
  if (e.key !== "Tab") return;

  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Custom Dialog — used by all dashboard dialog forms                  */
/* ------------------------------------------------------------------ */

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Max width class — default "max-w-lg" */
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

export function Dialog({ open, onClose, title, description, children, size = "md" }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Store the element that had focus before the dialog opened. */
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const descId = useId();

  // Close on Escape + focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (panelRef.current) {
        trapFocus(panelRef.current, e);
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Focus management: save previous focus, set initial focus, restore on close
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Delay to allow portal to mount before focusing
      requestAnimationFrame(() => {
        if (!panelRef.current) return;
        const firstFocusable = panelRef.current.querySelector<HTMLElement>(FOCUSABLE);
        if (firstFocusable) firstFocusable.focus();
        else panelRef.current.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop — clicking it closes the dialog */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full bg-background border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh] outline-none",
          SIZE[size],
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-foreground leading-tight">{title}</h2>
            {description && <p id={descId} className="text-sm text-muted mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted transition-colors shrink-0 -mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/*  Form field helpers                                                  */
/* ------------------------------------------------------------------ */

/** Reusable form field wrapper */
export function Field({
  label,
  required,
  children,
  hint,
  error,
  id: externalId,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  error?: string;
  id?: string;
}) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

/** Input */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition",
        className,
      )}
      {...props}
    />
  );
}

/** Textarea */
export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none transition",
        className,
      )}
      {...props}
    />
  );
}

/** Select */
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition appearance-none cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

/** Dialog footer with action buttons */
export function DialogFooter({
  onCancel,
  onConfirm,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  destructive = false,
  disabled = false,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 border-t border-border mt-4">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors rounded-lg hover:bg-foreground/5"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className={cn(
          "px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50",
          destructive
            ? "bg-destructive text-white hover:bg-destructive/90"
            : "bg-accent text-white hover:bg-accent/90",
        )}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
