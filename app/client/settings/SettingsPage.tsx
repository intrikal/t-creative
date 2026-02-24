"use client";

/**
 * app/client/settings/SettingsPage.tsx — Client settings page orchestrator.
 *
 * ## Architecture
 * This component owns only two things:
 *  1. The active section state (`profile | notifications | payments | account`).
 *  2. The sidebar nav and mobile tab bar used to switch between sections.
 *
 * All section content is delegated to focused sub-components in `./components/`:
 *
 * | Section         | Component               | Owns state for                    |
 * |-----------------|-------------------------|-----------------------------------|
 * | Profile         | `ProfileSection`        | name, email, phone, allergies     |
 * | Notifications   | `NotificationsSection`  | per-category enabled toggles      |
 * | Payments        | `PaymentsSection`       | saved cards list                  |
 * | Account         | `AccountSection`        | delete-confirm dialog visibility  |
 *
 * ## Phase 2
 * Each section currently uses local mock state. Phase 2 will convert this page
 * to a Server Component that fetches the authenticated user's profile and passes
 * initial values as props to each section.
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AccountSection } from "./components/AccountSection";
import { NotificationsSection } from "./components/NotificationsSection";
import { PaymentsSection } from "./components/PaymentsSection";
import { ProfileSection } from "./components/ProfileSection";
import { SECTIONS, type Section } from "./types";

/** Map of section id → rendered panel. Evaluated once per render cycle. */
const PANELS: Record<Section, React.ReactNode> = {
  profile: <ProfileSection />,
  notifications: <NotificationsSection />,
  payments: <PaymentsSection />,
  account: <AccountSection />,
};

export function ClientSettingsPage() {
  const [section, setSection] = useState<Section>("profile");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your profile and preferences</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* Sidebar nav — desktop */}
        <div className="sm:w-44 shrink-0">
          <Card className="gap-0 py-1">
            <CardContent className="px-1 py-1">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    section === id
                      ? "bg-foreground/8 text-foreground"
                      : "text-muted hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                  </span>
                  <ChevronRight className="w-3 h-3 text-muted/40" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Active section panel */}
        <div className="flex-1 min-w-0">{PANELS[section]}</div>
      </div>
    </div>
  );
}
