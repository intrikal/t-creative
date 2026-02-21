"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Droplets,
  Sparkles,
  Gem,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tab = "lash" | "jewelry";

interface AftercareTip {
  text: string;
  type: "do" | "dont";
}

const LASH_TIPS: AftercareTip[] = [
  { text: "Keep lashes dry for the first 24 hours after your appointment", type: "do" },
  { text: "Gently brush lashes daily with a clean spoolie wand", type: "do" },
  { text: "Sleep on your back or use a silk pillowcase", type: "do" },
  { text: "Come in for fills every 2–3 weeks to maintain fullness", type: "do" },
  { text: "Use lash-safe, oil-free makeup and cleanser", type: "do" },
  { text: "Avoid rubbing, picking, or pulling your lashes", type: "dont" },
  { text: "Avoid oil-based products near your eyes — they dissolve the bond", type: "dont" },
  { text: "Don't use a regular mascara on extensions", type: "dont" },
  { text: "Avoid steam rooms, saunas, and heavy sweating for 48 hours", type: "dont" },
  { text: "Don't sleep face-down — this will crimp and damage your lashes", type: "dont" },
];

const JEWELRY_TIPS: AftercareTip[] = [
  { text: "Keep the area clean and dry for the first 48 hours", type: "do" },
  { text: "Pat dry gently after showering — don't rub", type: "do" },
  { text: "Apply a small amount of unscented lotion if skin feels dry", type: "do" },
  {
    text: "Contact the studio if the clasp feels loose — do not attempt to re-weld at home",
    type: "do",
  },
  { text: "Avoid submerging in pools, hot tubs, or the ocean for 72 hours", type: "dont" },
  { text: "Don't use harsh soaps or scrubs directly on the chain", type: "dont" },
  { text: "Avoid applying perfume or lotion directly on the chain", type: "dont" },
  { text: "Don't try to remove or cut the chain yourself", type: "dont" },
];

const LASH_COPY_TEXT = `T Creative Studio — Lash Extension Aftercare

DO:
• Keep lashes dry for the first 24 hours
• Gently brush lashes daily with a spoolie
• Sleep on your back or use a silk pillowcase
• Come in for fills every 2–3 weeks
• Use lash-safe, oil-free products

DON'T:
• Rub, pick, or pull your lashes
• Use oil-based products near your eyes
• Use regular mascara on extensions
• Steam rooms or saunas for 48 hours
• Sleep face-down

Questions? Message us at T Creative Studio.`;

const JEWELRY_COPY_TEXT = `T Creative Studio — Permanent Jewelry Aftercare

DO:
• Keep the area clean and dry for 48 hours
• Pat dry gently after showering
• Contact us if the clasp feels loose

DON'T:
• Submerge in pools or hot tubs for 72 hours
• Use harsh soaps or scrubs on the chain
• Apply perfume directly on the chain
• Remove or cut the chain yourself

Questions? Message us at T Creative Studio.`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
        copied
          ? "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20"
          : "bg-surface border-border text-muted hover:text-foreground hover:border-foreground/20",
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy to share"}
    </button>
  );
}

export function ClientAftercarePage() {
  const [tab, setTab] = useState<Tab>("lash");

  const tips = tab === "lash" ? LASH_TIPS : JEWELRY_TIPS;
  const doTips = tips.filter((t) => t.type === "do");
  const dontTips = tips.filter((t) => t.type === "dont");
  const copyText = tab === "lash" ? LASH_COPY_TEXT : JEWELRY_COPY_TEXT;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Aftercare Guide</h1>
        <p className="text-sm text-muted mt-0.5">
          Follow these instructions to protect your results
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 w-fit">
        {(
          [
            { value: "lash", label: "Lash Extensions", icon: Sparkles },
            { value: "jewelry", label: "Permanent Jewelry", icon: Gem },
          ] as { value: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              tab === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Recovery Timeline</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3">
          <div className="space-y-0">
            {(tab === "lash"
              ? [
                  {
                    phase: "First 24 hours",
                    icon: Droplets,
                    color: "text-accent",
                    items: [
                      "Keep completely dry — no washing face, showering near lashes, or sweating",
                      "Avoid touching or rubbing the eye area",
                    ],
                  },
                  {
                    phase: "24 – 48 hours",
                    icon: Sparkles,
                    color: "text-[#c4907a]",
                    items: [
                      "Avoid steam rooms, saunas, and heavy cardio",
                      "Start gentle brushing with a spoolie once fully dry",
                    ],
                  },
                  {
                    phase: "Week 1+",
                    icon: CheckCircle2,
                    color: "text-[#4e6b51]",
                    items: [
                      "Brush lashes daily, morning and night",
                      "Use only oil-free products and lash-safe cleanser",
                      "Sleep on your back or use a silk pillowcase",
                    ],
                  },
                  {
                    phase: "Ongoing",
                    icon: CheckCircle2,
                    color: "text-muted",
                    items: [
                      "Book a fill every 2–3 weeks to maintain fullness",
                      "Avoid mascara on extensions — it shortens their life",
                    ],
                  },
                ]
              : [
                  {
                    phase: "First 48 hours",
                    icon: Droplets,
                    color: "text-accent",
                    items: [
                      "Keep the area completely dry — no pools, hot tubs, or ocean",
                      "Pat dry gently after any light water contact",
                    ],
                  },
                  {
                    phase: "Days 3 – 7",
                    icon: Sparkles,
                    color: "text-[#d4a574]",
                    items: [
                      "Mild soap is fine now — avoid scrubbing directly on the chain",
                      "Continue to pat dry rather than rubbing",
                    ],
                  },
                  {
                    phase: "Ongoing",
                    icon: CheckCircle2,
                    color: "text-muted",
                    items: [
                      "Avoid applying perfume or lotion directly on the chain",
                      "Contact the studio if the weld feels loose — do not cut it yourself",
                    ],
                  },
                ]
            ).map((step, i, arr) => (
              <div key={step.phase} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full border-2 border-border bg-surface flex items-center justify-center shrink-0`}
                  >
                    <step.icon className={`w-3.5 h-3.5 ${step.color}`} />
                  </div>
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-border/50 my-1" />}
                </div>
                <div className={`pb-4 flex-1 min-w-0 ${i < arr.length - 1 ? "pb-4" : ""}`}>
                  <p className="text-xs font-semibold text-foreground mb-1">{step.phase}</p>
                  <ul className="space-y-0.5">
                    {step.items.map((item, j) => (
                      <li key={j} className="text-xs text-muted leading-relaxed">
                        · {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Do & Don't cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Do's */}
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#4e6b51]" />
                <CardTitle className="text-sm font-semibold text-[#4e6b51]">Do</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3 space-y-2">
            {doTips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4e6b51] shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Don'ts */}
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                <CardTitle className="text-sm font-semibold text-destructive">Don&apos;t</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3 space-y-2">
            {dontTips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Share / copy */}
      <Card className="gap-0">
        <CardContent className="px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Share these instructions</p>
            <p className="text-xs text-muted mt-0.5">Copy a text summary to send to a friend</p>
          </div>
          <CopyButton text={copyText} />
        </CardContent>
      </Card>

      {/* Recommended products */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Recommended Products</p>
            <p className="text-xs text-muted mt-0.5">
              {tab === "lash"
                ? "Keep these on hand for the best lash care routine"
                : "Gentle products safe for your new jewelry"}
            </p>
          </div>
          <Link
            href="/client/shop"
            className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
          >
            View shop <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(tab === "lash"
            ? [
                {
                  name: "Lash Aftercare Kit",
                  desc: "Cleanser + spoolie set — everything you need post-appointment",
                  icon: Sparkles,
                  color: "bg-[#c4907a]/10 text-[#c4907a]",
                },
                {
                  name: "T Creative Lash Cleanser",
                  desc: "Oil-free foam cleanser formulated to protect lash bonds",
                  icon: Droplets,
                  color: "bg-accent/10 text-accent",
                },
                {
                  name: "Lash Spoolie Set (5-pack)",
                  desc: "Disposable spoolies for daily brushing and maintenance",
                  icon: Sparkles,
                  color: "bg-[#4e6b51]/10 text-[#4e6b51]",
                },
              ]
            : [
                {
                  name: "Jewelry Polishing Cloth",
                  desc: "Soft cloth to keep your chain bright and tarnish-free",
                  icon: Gem,
                  color: "bg-[#d4a574]/10 text-[#d4a574]",
                },
                {
                  name: "Unscented Gentle Lotion",
                  desc: "Fragrance-free lotion safe to apply near your jewelry",
                  icon: Droplets,
                  color: "bg-accent/10 text-accent",
                },
                {
                  name: "T Creative Gift Card",
                  desc: "Share the experience — perfect for a friend",
                  icon: ShoppingBag,
                  color: "bg-foreground/8 text-muted",
                },
              ]
          ).map((product) => (
            <Link
              key={product.name}
              href="/client/shop"
              className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-surface hover:bg-foreground/[0.03] transition-colors group"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${product.color}`}
              >
                <product.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors leading-snug">
                  {product.name}
                </p>
                <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{product.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
