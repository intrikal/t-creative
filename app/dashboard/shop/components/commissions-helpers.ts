/** Status and category configuration for the commissions UI. */

import { Clock, CheckCircle2, XCircle, Scissors, Printer } from "lucide-react";
import type { CommissionCategory } from "@/lib/types/commission.types";

export const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  inquiry: {
    label: "Under Review",
    color: "text-[#a07040]",
    bg: "bg-[#d4a574]/10",
    border: "border-[#d4a574]/20",
    icon: Clock,
  },
  quoted: {
    label: "Quote Ready",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
    icon: Clock,
  },
  accepted: {
    label: "Confirmed",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
    icon: CheckCircle2,
  },
  in_progress: {
    label: "In Progress",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
    icon: Clock,
  },
  ready_for_pickup: {
    label: "Ready for Pickup",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    icon: XCircle,
  },
};

export const CAT_CONFIG: Record<
  CommissionCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  crochet: { label: "Custom Crochet", icon: Scissors, color: "text-[#4a7a7a]" },
  "3d_printing": { label: "3D Printing", icon: Printer, color: "text-[#5a5aaa]" },
};
