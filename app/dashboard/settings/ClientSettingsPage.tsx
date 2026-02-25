"use client";

/**
 * Client settings page — restyled to match the admin/assistant settings pattern.
 *
 * Uses a bare sticky sidebar nav on desktop and horizontal scrollable tabs
 * on mobile, matching the SettingsPage.tsx shell.
 *
 * Receives initial data from the server via props (fetched in page.tsx).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AccountSection } from "./client-components/AccountSection";
import { NotificationsSection } from "./client-components/NotificationsSection";
import { PaymentsSection } from "./client-components/PaymentsSection";
import { ProfileSection } from "./client-components/ProfileSection";
import type { ClientSettingsData } from "./client-settings-actions";
import { SECTIONS, type Section } from "./client-types";

export function ClientSettingsPage({ data }: { data: ClientSettingsData }) {
  const [section, setSection] = useState<Section>("profile");

  const PANELS: Record<Section, React.ReactNode> = {
    profile: <ProfileSection initial={data.profile} />,
    notifications: <NotificationsSection initial={data.notifications} />,
    payments: <PaymentsSection />,
    account: <AccountSection />,
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your profile and preferences</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Side nav — visible on md+ */}
        <nav className="hidden md:flex flex-col gap-0.5 w-48 shrink-0 sticky top-6">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full",
                section === id
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground hover:bg-foreground/5",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Mobile horizontal tabs */}
        <div className="md:hidden w-full">
          <div className="flex gap-0.5 border-b border-border mb-5 -mx-0">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
                  section === id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">{PANELS[section]}</div>
      </div>
    </div>
  );
}
