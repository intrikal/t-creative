import type { ProgramType, StudentStatus } from "../actions";

export const PROGRAM_STYLE: Record<
  ProgramType,
  { label: string; bg: string; text: string; border: string }
> = {
  lash: {
    label: "Lash",
    bg: "bg-[#c4907a]/12",
    text: "text-[#96604a]",
    border: "border-[#c4907a]/20",
  },
  jewelry: {
    label: "Jewelry",
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/20",
  },
  business: {
    label: "Business",
    bg: "bg-[#5b8a8a]/12",
    text: "text-[#3a6a6a]",
    border: "border-[#5b8a8a]/20",
  },
  crochet: {
    label: "Crochet",
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4a7a7a]",
    border: "border-[#7ba3a3]/20",
  },
};

export function studentStatusConfig(status: StudentStatus) {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "completed":
      return { label: "Completed", className: "bg-foreground/8 text-muted border-foreground/12" };
    case "paused":
      return { label: "Paused", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "waitlist":
      return { label: "Waitlist", className: "bg-accent/12 text-accent border-accent/20" };
  }
}
