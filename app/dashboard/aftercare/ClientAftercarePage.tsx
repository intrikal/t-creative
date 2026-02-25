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
  Scissors,
  Users,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientAftercareSection } from "./client-actions";

type IconComponent = React.ComponentType<{ className?: string }>;

const CATEGORY_ICONS: Record<string, IconComponent> = {
  lash: Sparkles,
  jewelry: Gem,
  crochet: Scissors,
  consulting: Users,
};

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

export function ClientAftercarePage({ sections }: { sections: ClientAftercareSection[] }) {
  const categories = sections.map((s) => s.category).filter(Boolean) as string[];
  const uniqueCategories = [...new Set(categories)];
  const [activeCategory, setActiveCategory] = useState(uniqueCategories[0] ?? "lash");

  const activeSection = sections.find((s) => s.category === activeCategory);
  const doTips = activeSection?.dos ?? [];
  const dontTips = activeSection?.donts ?? [];
  const copyText = activeSection
    ? `T Creative Studio — ${activeSection.title} Aftercare\n\nDO:\n${activeSection.dos.map((d) => `• ${d}`).join("\n")}\n\nDON'T:\n${activeSection.donts.map((d) => `• ${d}`).join("\n")}\n\nQuestions? Message us at T Creative Studio.`
    : "";

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Aftercare Guide</h1>
        <p className="text-sm text-muted mt-0.5">
          Follow these instructions to protect your results
        </p>
      </div>

      {/* Tab toggle */}
      {uniqueCategories.length > 1 && (
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 w-fit">
          {sections
            .filter((s) => s.category)
            .map((section) => {
              const Icon = CATEGORY_ICONS[section.category!] ?? Sparkles;
              return (
                <button
                  key={section.category}
                  onClick={() => setActiveCategory(section.category!)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    activeCategory === section.category
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {section.title}
                </button>
              );
            })}
        </div>
      )}

      {/* Timeline */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Recovery Timeline</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3">
          <div className="space-y-0">
            {(activeCategory === "lash"
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
                <p className="text-xs text-foreground leading-relaxed">{tip}</p>
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
                <p className="text-xs text-foreground leading-relaxed">{tip}</p>
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
              {activeCategory === "lash"
                ? "Keep these on hand for the best lash care routine"
                : "Gentle products safe for your new jewelry"}
            </p>
          </div>
          <Link
            href="/dashboard/shop"
            className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
          >
            View shop <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(activeCategory === "lash"
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
              href="/dashboard/shop"
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
