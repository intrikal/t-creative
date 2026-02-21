"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, FileText, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Data                                                                */
/* ------------------------------------------------------------------ */

interface AftercareSection {
  id: string;
  title: string;
  dos: string[];
  donts: string[];
}

interface Policy {
  id: string;
  title: string;
  content: string;
}

const AFTERCARE: AftercareSection[] = [
  {
    id: "lash",
    title: "Lash Extensions",
    dos: [
      "Keep lashes dry for the first 24–48 hours after your appointment.",
      "Cleanse lashes 3–4× per week with an oil-free lash cleanser.",
      "Brush lashes gently each morning with a clean spoolie.",
      "Sleep on your back or use a lash pillow to protect the shape.",
      "Book your fill every 2–3 weeks to maintain fullness.",
    ],
    donts: [
      "Do not use oil-based makeup removers or skincare near the eye area.",
      "Do not pick, pull, or rub your lashes — this causes premature shedding.",
      "Avoid steam rooms, saunas, or prolonged hot showers for 48 hours.",
      "Do not use a mechanical eyelash curler.",
      "Avoid waterproof mascara on extensions.",
    ],
  },
  {
    id: "jewelry",
    title: "Permanent Jewelry",
    dos: [
      "Your jewelry is safe to shower, swim, and sleep in — it's designed for everyday wear.",
      "Polish occasionally with a soft cloth to keep the shine.",
      "Visit the studio if the chain ever needs adjustment or re-welding.",
    ],
    donts: [
      "Avoid exposing to harsh chemicals like bleach, chlorine, or cleaning products.",
      "Do not apply lotions or perfumes directly onto the chain.",
      "Do not attempt to cut or remove at home — visit the studio for removal.",
    ],
  },
  {
    id: "crochet",
    title: "Crochet & Braids",
    dos: [
      "Moisturize your scalp with a lightweight oil 2–3× per week.",
      "Sleep with a satin bonnet or on a satin pillowcase to preserve style.",
      "Wash your style every 2–3 weeks using a diluted shampoo or co-wash.",
    ],
    donts: [
      "Do not leave crochet styles in longer than 8 weeks.",
      "Avoid excess moisture or product buildup on extensions.",
      "Do not scratch aggressively — use a rat-tail comb to relieve itching.",
    ],
  },
];

const POLICIES: Policy[] = [
  {
    id: "booking",
    title: "Booking & Deposits",
    content: `All appointments require a non-refundable deposit at the time of booking. Deposits are applied toward your service total.\n\nDeposit amounts:\n• Lash services: $30\n• Permanent Jewelry: $20\n• Crochet installs: $40\n• Events & parties: 25% of total\n• Training programs: $100`,
  },
  {
    id: "cancellation",
    title: "Cancellation & Rescheduling",
    content: `We kindly ask for at least 48 hours notice for cancellations or rescheduling.\n\n• Cancellations with 48+ hours notice: Deposit transferred to rescheduled appointment.\n• Cancellations within 24 hours: Deposit is forfeited.\n• No-shows: Deposit is forfeited and a $25 no-show fee applies to future bookings.`,
  },
  {
    id: "late",
    title: "Late Arrivals",
    content: `Please arrive on time or a few minutes early for your appointment.\n\n• Up to 10 minutes late: We will do our best to accommodate your full service.\n• 10–20 minutes late: Your service may be modified to fit the remaining time.\n• 20+ minutes late: Your appointment may be forfeited and your deposit may not be refunded.`,
  },
  {
    id: "health",
    title: "Health & Sensitivity",
    content: `Your health and safety are our top priority.\n\n• Please disclose any known allergies or sensitivities during booking.\n• If you experience irritation or an allergic reaction, contact us immediately.\n• Patch tests are available upon request for new clients with sensitive skin.`,
  },
  {
    id: "satisfaction",
    title: "Satisfaction & Returns",
    content: `Your satisfaction matters to us.\n\n• If you experience any concerns with your lash retention within 72 hours, contact us and we will assess and correct at no charge.\n• Products purchased in-studio can be exchanged within 7 days if unopened.\n• Training deposits are non-refundable once a start date is confirmed.`,
  },
];

/* ------------------------------------------------------------------ */
/*  Copy button                                                         */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-[11px] text-muted hover:text-accent transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-[#4e6b51]" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Aftercare card                                                      */
/* ------------------------------------------------------------------ */

function AftercareCard({ section }: { section: AftercareSection }) {
  const shareText = [
    `📋 ${section.title} Aftercare`,
    "",
    "✅ DO:",
    ...section.dos.map((d) => `• ${d}`),
    "",
    "❌ DON'T:",
    ...section.donts.map((d) => `• ${d}`),
    "",
    "— T Creative Studio",
  ].join("\n");

  return (
    <Card className="gap-0">
      <CardHeader className="pt-4 pb-3 px-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
          <CopyButton text={shareText} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4e6b51] mb-3 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> What to Do
            </p>
            <div className="space-y-2">
              {section.dos.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0 bg-[#4e6b51]" />
                  <span className="text-xs text-foreground/80 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> What NOT to Do
            </p>
            <div className="space-y-2">
              {section.donts.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0 bg-destructive/60" />
                  <span className="text-xs text-foreground/80 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function AssistantAftercarePage() {
  const [tab, setTab] = useState<"aftercare" | "policies">("aftercare");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Aftercare & Policies
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Studio care instructions and policies to share with clients
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setTab("aftercare")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            tab === "aftercare"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground",
          )}
        >
          <CheckCircle className="w-3.5 h-3.5" /> Aftercare
        </button>
        <button
          onClick={() => setTab("policies")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            tab === "policies"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground",
          )}
        >
          <FileText className="w-3.5 h-3.5" /> Policies
        </button>
      </div>

      {tab === "aftercare" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Use the <strong>Copy</strong> button on each card to grab ready-to-send aftercare
            instructions for clients.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {AFTERCARE.map((s) => (
              <AftercareCard key={s.id} section={s} />
            ))}
          </div>
        </div>
      )}

      {tab === "policies" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {POLICIES.map((p) => (
            <Card key={p.id} className="gap-0">
              <CardHeader className="pt-4 pb-2 px-5">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{p.title}</CardTitle>
                  <CopyButton text={`${p.title}\n\n${p.content}\n\n— T Creative Studio`} />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                  {p.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
