import Link from "next/link";
import {
  CalendarPlus,
  FileText,
  CalendarDays,
  MessageSquare,
  Image,
  Package,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "New Booking", icon: CalendarPlus, href: "/dashboard/bookings", color: "text-blush", bg: "bg-blush/10" },
  { label: "New Invoice", icon: FileText, href: "/dashboard/financial", color: "text-[#4e6b51]", bg: "bg-[#4e6b51]/10" },
  { label: "View Calendar", icon: CalendarDays, href: "/dashboard/calendar", color: "text-accent", bg: "bg-accent/10" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/messages", color: "text-[#5b8a8a]", bg: "bg-[#5b8a8a]/10" },
  { label: "Upload Media", icon: Image, href: "/dashboard/services", color: "text-[#d4a574]", bg: "bg-[#d4a574]/10" },
  { label: "Inventory", icon: Package, href: "/dashboard/marketplace", color: "text-[#7a5c10]", bg: "bg-[#7a5c10]/10" },
];

export function AdminHeaderSection({
  firstName,
  bookingSlug,
}: {
  firstName: string;
  bookingSlug: string | null;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted mt-0.5">{today}</p>
        </div>
        {bookingSlug && (
          <a
            href={`https://tcreative.studio/book/${bookingSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-surface text-foreground transition-colors shrink-0"
          >
            My booking site <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {QUICK_ACTIONS.map(({ label, icon: Icon, href, color, bg }) => (
          <Link
            key={label}
            href={href}
            className="relative group flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-surface border border-border hover:border-foreground/20 hover:shadow-sm transition-all text-center"
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", bg)}>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
            <span className="text-xs font-medium text-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
