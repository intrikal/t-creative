/**
 * client-helpers.ts
 * Shared constants for the client-facing training page components.
 * Kept separate from helpers.ts which serves the admin training page.
 */

import type { ProgramType } from "../client-actions";

export const PROG_STYLE: Record<
  ProgramType,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  lash: {
    label: "Lash",
    bg: "bg-[#c4907a]/12",
    text: "text-[#96604a]",
    border: "border-[#c4907a]/20",
    dot: "bg-[#c4907a]",
  },
  jewelry: {
    label: "Jewelry",
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/20",
    dot: "bg-[#d4a574]",
  },
  business: {
    label: "Business",
    bg: "bg-[#5b8a8a]/12",
    text: "text-[#3a6060]",
    border: "border-[#5b8a8a]/20",
    dot: "bg-[#5b8a8a]",
  },
  crochet: {
    label: "Crochet",
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4a7a7a]",
    border: "border-[#7ba3a3]/20",
    dot: "bg-[#7ba3a3]",
  },
};

export const FORMAT_LABEL: Record<string, string> = {
  in_person: "In-person",
  hybrid: "Hybrid",
  online: "Online",
};
