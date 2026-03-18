"use client";

/** MembershipsPage — Lash Club recurring subscriptions management with Members and Plans tabs. */

import { useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MembershipPlan, MembershipRow } from "./actions";
import { MembersTab } from "./components/MembersTab";
import { PlansTab } from "./components/PlansTab";

export function MembershipsPage({
  initialMemberships,
  plans,
  clients,
}: {
  initialMemberships: MembershipRow[];
  plans: MembershipPlan[];
  clients: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<"members" | "plans">("members");

  const TABS = [
    { id: "members" as const, label: "Members", icon: CreditCard },
    { id: "plans" as const, label: "Plans", icon: ShieldCheck },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Memberships</h1>
        <p className="text-sm text-muted mt-0.5">Lash Club recurring subscriptions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <MembersTab memberships={initialMemberships} plans={plans} clients={clients} />
      ) : (
        <PlansTab plans={plans} />
      )}
    </div>
  );
}
