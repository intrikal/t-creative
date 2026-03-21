"use client";

/**
 * AccountSection.tsx — Account management tab for the client settings page.
 *
 * Contains:
 * - Linked phone display
 * - Privacy policy link
 * - Download my data (CCPA right-to-know)
 * - Log out (POST to /auth/signout)
 * - Delete account (CCPA-compliant anonymization + auth deletion)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Download, LogOut, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { deleteClientAccount } from "../client-settings-actions";

export function AccountSection() {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadData() {
    setDownloading(true);
    try {
      const res = await fetch("/api/client-export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "my-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — user can retry
    } finally {
      setDownloading(false);
    }
  }

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

              {/* Download my data (CCPA) */}
              <button
                onClick={handleDownloadData}
                disabled={downloading}
                className="w-full flex items-center justify-between py-3 border-b border-border/40 text-left group disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {downloading ? "Preparing download..." : "Download My Data"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">Get a copy of all your personal data</p>
                </div>
                <Download className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </button>

              {/* Log out */}
              <form action="/auth/signout" method="POST" className="w-full">
                <button
                  type="submit"
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
              </form>
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
                Permanently removes your personal data from T Creative Studio.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <Dialog
          open
          title="Delete My Data"
          description="California Consumer Privacy Act (CCPA) — Right to Delete"
          onClose={() => setShowDeleteConfirm(false)}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-foreground">
                This action is permanent and cannot be reversed.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Requesting deletion will:
              </p>
              <ul className="space-y-1.5 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">&#x2022;</span>
                  <span>Anonymize your profile (name, email, phone, birthday)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">&#x2022;</span>
                  <span>Cancel any active memberships</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">&#x2022;</span>
                  <span>Void all loyalty points</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">&#x2022;</span>
                  <span>Permanently delete your gallery photos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">&#x2022;</span>
                  <span>Remove notification preferences and referral codes</span>
                </li>
              </ul>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg bg-foreground/[0.03] border border-border/60">
              <p className="text-xs font-medium text-foreground">Retained as required by law:</p>
              <p className="text-xs text-muted">
                Completed booking records (shown as &quot;Deleted User&quot;), payment and financial
                transaction records, and audit logs are retained for tax and regulatory compliance.
              </p>
            </div>

            <p className="text-xs text-muted">
              A confirmation email will be sent to your current email address before your data is
              removed.
            </p>
          </div>

          <DialogFooter
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={async () => {
              setDeleting(true);
              try {
                await deleteClientAccount();
                router.push("/auth/signed-out");
              } catch {
                setDeleting(false);
              }
            }}
            confirmLabel={deleting ? "Deleting..." : "Delete my data"}
            destructive
            disabled={deleting}
          />
        </Dialog>
      )}
    </>
  );
}
