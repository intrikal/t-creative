"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  ClipboardList,
  Gift,
  MessageSquare,
  FileText,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientDetailData } from "./actions";
import { BookingsTab } from "./components/BookingsTab";
import { FormsTab } from "./components/FormsTab";
import { LoyaltyTab } from "./components/LoyaltyTab";
import { MessagesTab } from "./components/MessagesTab";
import { OverviewTab } from "./components/OverviewTab";
import { PaymentsTab } from "./components/PaymentsTab";
import { ProfileHeader } from "./components/ProfileHeader";
import { ServiceRecordsTab } from "./components/ServiceRecordsTab";

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "service-records", label: "Service Records", icon: StickyNote },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "loyalty", label: "Loyalty", icon: Gift },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "forms", label: "Forms", icon: FileText },
] as const;

type Tab = (typeof TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ClientDetailPage({ data }: { data: ClientDetailData }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
      {/* Back link */}
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to clients
      </Link>

      {/* Header card */}
      <ProfileHeader data={data} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === "messages" && data.threads.some((t) => t.unreadCount > 0) && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab data={data} />}
      {activeTab === "bookings" && <BookingsTab data={data} />}
      {activeTab === "service-records" && <ServiceRecordsTab data={data} />}
      {activeTab === "payments" && <PaymentsTab data={data} />}
      {activeTab === "loyalty" && <LoyaltyTab data={data} />}
      {activeTab === "messages" && <MessagesTab data={data} />}
      {activeTab === "forms" && <FormsTab data={data} />}
    </div>
  );
}
