/**
 * Integrations tab — displays third-party service connections and calendar sync.
 *
 * Used by the Settings page. Shows a categorized list of integrations
 * (Payments, Business, Marketing) with connected/disconnected status badges,
 * plus a Calendar Sync card with a subscribable iCal feed URL.
 *
 * Square integration status is passed from the server component so the UI
 * reflects the real connection state. Other integrations are currently
 * display-only placeholders.
 *
 * @module settings/components/IntegrationsTab
 */
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type WebhookHealth = {
  lastSuccessfulWebhook: string | null;
  failureCountLastHour: number;
  status: "healthy" | "degraded" | "failing";
};

type IntegrationsTabProps = {
  squareConnected?: boolean;
  squareEnvironment?: string;
  squareLocationId?: string;
  calendarUrl?: string;
  webhookHealth?: WebhookHealth;
};

/**
 * buildIntegrations — constructs the integration list with live Square status.
 *
 * Returns a static array of integration objects. Square's description and
 * connected flag are dynamic (from server props); all others are hardcoded
 * until their OAuth flows are implemented.
 */
function buildIntegrations(
  squareConnected: boolean,
  squareEnvironment?: string,
  squareLocationId?: string,
) {
  return [
    {
      name: "Square",
      description: squareConnected
        ? `POS, payments, text reminders & appointments — ${squareEnvironment}${squareLocationId ? ` (${squareLocationId})` : ""}`
        : "POS, payments, text reminders & appointments",
      connected: squareConnected,
      icon: "💳",
      category: "Payments" as const,
      note: "Sales tax is calculated by Square based on your location and item categories. Configure tax settings in your Square Dashboard under Settings \u2192 Sales Tax.",
      noteUrl: "https://squareup.com/dashboard/sales/taxes",
    },
    {
      name: "Zoho",
      description: "Client CRM & email marketing",
      connected: true,
      icon: "🧩",
      category: "Business",
    },
    {
      name: "QuickBooks",
      description: "Accounting, expenses & tax prep",
      connected: false,
      icon: "📊",
      category: "Business",
    },
    {
      name: "Instagram",
      description: "Booking link in bio + story promotions",
      connected: true,
      icon: "📸",
      category: "Marketing",
    },
    {
      name: "TikTok",
      description: "Reach new clients through beauty content",
      connected: false,
      icon: "🎵",
      category: "Marketing",
    },
    {
      name: "Google Business",
      description: "Reviews, Google Maps & local search visibility",
      connected: false,
      icon: "🗺️",
      category: "Marketing" as const,
    },
  ];
}

/**
 * CalendarCard — iCal feed subscription card with copy-to-clipboard and
 * one-click Google/Apple Calendar subscription links.
 *
 * @param calendarUrl - The HTTPS iCal feed URL from the server.
 */
function CalendarCard({ calendarUrl }: { calendarUrl: string }) {
  /** Whether the "Copied!" confirmation is visible (auto-resets after 2s). */
  const [copied, setCopied] = useState(false);

  // Replace https:// with webcal:// so calendar apps recognize the protocol
  const webcalUrl = calendarUrl.replace(/^https?:\/\//, "webcal://");
  // Google Calendar expects the webcal:// URL encoded as a query param
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  function handleCopy() {
    navigator.clipboard.writeText(calendarUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-4">
          <span className="text-2xl shrink-0">📅</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Calendar Sync</p>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20">
                Active
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Subscribe to your bookings feed in any calendar app
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-surface border border-border px-3 py-2 flex items-center gap-2">
          <code className="flex-1 text-[11px] text-muted truncate font-mono">{calendarUrl}</code>
          <button
            onClick={handleCopy}
            className="shrink-0 p-1 rounded text-muted hover:text-foreground transition-colors"
            title="Copy URL"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#4e6b51]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Add to Google Calendar
          </a>
          <a
            href={webcalUrl}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-muted hover:text-foreground transition-colors"
          >
            Subscribe in Apple Calendar
          </a>
        </div>

        <p className="text-[10px] text-muted">
          Keep this URL private — anyone with it can view your upcoming bookings.
        </p>
      </CardContent>
    </Card>
  );
}

export function IntegrationsTab({
  squareConnected = false,
  squareEnvironment,
  squareLocationId,
  calendarUrl,
  webhookHealth,
}: IntegrationsTabProps = {}) {
  const integrations = buildIntegrations(squareConnected, squareEnvironment, squareLocationId);
  // Extract unique category names to render grouped sections.
  // Set preserves insertion order so categories appear in the same order as the array.
  const categories = [...new Set(integrations.map((i) => i.category))];

  return (
    <div className="space-y-5">
      {calendarUrl && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
            Calendar
          </p>
          <CalendarCard calendarUrl={calendarUrl} />
        </div>
      )}

      {webhookHealth && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
            Webhooks
          </p>
          <Card className="gap-0">
            <CardContent className="px-5 py-4">
              <div className="flex items-center gap-4">
                <span className="text-2xl shrink-0">🔔</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Square Webhooks</p>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                        webhookHealth.status === "healthy"
                          ? "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20"
                          : webhookHealth.status === "degraded"
                            ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20",
                      )}
                    >
                      {webhookHealth.status === "healthy"
                        ? "Healthy"
                        : webhookHealth.status === "degraded"
                          ? "Degraded"
                          : "Failing"}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {webhookHealth.failureCountLastHour > 0
                      ? `${webhookHealth.failureCountLastHour} signature verification failure${webhookHealth.failureCountLastHour === 1 ? "" : "s"} in the last hour`
                      : "No signature failures in the last hour"}
                  </p>
                  {webhookHealth.lastSuccessfulWebhook && (
                    <p className="text-[10px] text-muted/70 mt-1">
                      Last successful:{" "}
                      {new Date(webhookHealth.lastSuccessfulWebhook).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {webhookHealth.status === "failing" && (
                    <p className="text-[10px] text-destructive mt-1">
                      Check Square Dashboard → Webhooks → Signature Key
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">{cat}</p>
          <div className="space-y-2">
            {integrations
              .filter((i) => i.category === cat)
              .map((integration) => (
                <Card key={integration.name} className="gap-0">
                  <CardContent className="px-4 sm:px-5 py-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <span className="text-2xl shrink-0">{integration.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">
                            {integration.name}
                          </p>
                          <span
                            className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                              integration.connected
                                ? "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20"
                                : "bg-foreground/5 text-muted border-foreground/10",
                            )}
                          >
                            {integration.connected ? "Connected" : "Not connected"}
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">{integration.description}</p>
                        {"note" in integration && integration.note && (
                          <p className="text-[10px] text-muted/70 mt-1.5 leading-relaxed">
                            {integration.note}
                            {"noteUrl" in integration && integration.noteUrl && (
                              <>
                                {" "}
                                <a
                                  href={integration.noteUrl as string}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-foreground"
                                >
                                  Open Square tax settings
                                </a>
                              </>
                            )}
                          </p>
                        )}
                        <button
                          className={cn(
                            "mt-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors sm:hidden",
                            integration.connected
                              ? "bg-surface border border-border text-muted hover:text-destructive hover:border-destructive/30"
                              : "bg-accent text-white hover:bg-accent/90",
                          )}
                        >
                          {integration.connected ? "Disconnect" : "Connect"}
                        </button>
                      </div>
                      <button
                        className={cn(
                          "hidden sm:block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0",
                          integration.connected
                            ? "bg-surface border border-border text-muted hover:text-destructive hover:border-destructive/30"
                            : "bg-accent text-white hover:bg-accent/90",
                        )}
                      >
                        {integration.connected ? "Disconnect" : "Connect"}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
