/**
 * Integrations tab — connect/disconnect third-party services.
 *
 * **Currently hardcoded** — displays 7 integrations grouped by category:
 * - Payments: Square
 * - Business: Zoho, QuickBooks
 * - Calendar: Google Calendar
 * - Marketing: Instagram, TikTok, Google Business
 *
 * Each integration shows a connected/disconnected badge and a toggle button.
 * When real OAuth flows are implemented, the connect/disconnect buttons will
 * call server actions to manage tokens.
 *
 * @module settings/components/IntegrationsTab
 */
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type IntegrationsTabProps = {
  squareConnected?: boolean;
  squareEnvironment?: string;
  squareLocationId?: string;
};

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
      name: "Google Calendar",
      description: "Two-way sync with your studio calendar",
      connected: true,
      icon: "📅",
      category: "Calendar",
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

export function IntegrationsTab({
  squareConnected = false,
  squareEnvironment,
  squareLocationId,
}: IntegrationsTabProps = {}) {
  const integrations = buildIntegrations(squareConnected, squareEnvironment, squareLocationId);
  const categories = [...new Set(integrations.map((i) => i.category))];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Integrations</h2>
        <p className="text-xs text-muted mt-0.5">
          Connect your studio to the tools you already use
        </p>
      </div>

      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">{cat}</p>
          <div className="space-y-2">
            {integrations
              .filter((i) => i.category === cat)
              .map((integration) => (
                <Card key={integration.name} className="gap-0">
                  <CardContent className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl shrink-0">{integration.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
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
                      </div>
                      <button
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0",
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
