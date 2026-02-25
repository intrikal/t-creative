"use client";

/**
 * AccountSection.tsx — Account management tab for the client settings page.
 *
 * Contains:
 * - Change password (navigates to Supabase auth flow in Phase 2)
 * - Linked phone display
 * - Privacy policy link
 * - Log out (calls `supabase.auth.signOut()` in Phase 2)
 * - Delete account with confirmation dialog
 */

import { useState } from "react";
import { AlertTriangle, ChevronRight, LogOut, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";

export function AccountSection() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Account</h2>
          <p className="text-xs text-muted mt-0.5">Security, privacy, and account management</p>
        </div>

        <Card className="gap-0">
          <CardContent className="px-5 pb-5 pt-5 space-y-4">
            <div className="space-y-0">
              {/* Change password */}
              <div className="flex items-center justify-between py-3 border-b border-border/40">
                <div>
                  <p className="text-sm font-medium text-foreground">Change Password</p>
                  <p className="text-xs text-muted mt-0.5">Update your login password</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </div>

              {/* Linked phone */}
              <div className="flex items-center justify-between py-3 border-b border-border/40">
                <div>
                  <p className="text-sm font-medium text-foreground">Linked Phone</p>
                  <p className="text-xs text-muted mt-0.5">Verified</p>
                </div>
                <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 border border-[#4e6b51]/20 px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              </div>

              {/* Privacy policy */}
              <div className="flex items-center justify-between py-3 border-b border-border/40">
                <div>
                  <p className="text-sm font-medium text-foreground">Privacy Policy</p>
                  <p className="text-xs text-muted mt-0.5">How we handle your data</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </div>

              {/* Log out */}
              <button
                onClick={() => {}}
                className="w-full flex items-center justify-between py-3 border-b border-border/40 text-left group"
              >
                <div>
                  <p className="text-sm font-medium text-foreground group-hover:text-destructive transition-colors">
                    Log Out
                  </p>
                  <p className="text-xs text-muted mt-0.5">Sign out of your account</p>
                </div>
                <LogOut className="w-4 h-4 text-muted group-hover:text-destructive transition-colors" />
              </button>
            </div>

            {/* Delete account */}
            <div className="pt-1">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account
              </button>
              <p className="text-[11px] text-muted mt-1">
                Permanently removes all your data from T Creative Studio.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <Dialog
          open
          title="Delete Account"
          description="This action cannot be undone."
          onClose={() => setShowDeleteConfirm(false)}
          size="sm"
        >
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              Your profile, booking history, loyalty points, and all personal data will be
              permanently deleted. This cannot be reversed.
            </p>
          </div>
          <DialogFooter
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={() => setShowDeleteConfirm(false)}
            confirmLabel="Delete my account"
            destructive
          />
        </Dialog>
      )}
    </>
  );
}
