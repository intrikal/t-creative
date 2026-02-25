"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, FileText, Copy, Check, PackageOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AftercareSection, PolicyEntry } from "./actions";

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
    `${section.title} Aftercare`,
    "",
    "DO:",
    ...section.dos.map((d) => `- ${d}`),
    "",
    "DON'T:",
    ...section.donts.map((d) => `- ${d}`),
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
              {section.dos.length === 0 && (
                <p className="text-xs text-muted italic">No items yet.</p>
              )}
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
              {section.donts.length === 0 && (
                <p className="text-xs text-muted italic">No items yet.</p>
              )}
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

export function AssistantAftercarePage({
  initialSections,
  initialPolicies,
}: {
  initialSections: AftercareSection[];
  initialPolicies: PolicyEntry[];
}) {
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
          {initialSections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <PackageOpen className="w-8 h-8 text-foreground/15 mb-2" />
              <p className="text-sm text-muted">No aftercare instructions yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {initialSections.map((s) => (
                <AftercareCard key={s.id} section={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "policies" && (
        <>
          {initialPolicies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <PackageOpen className="w-8 h-8 text-foreground/15 mb-2" />
              <p className="text-sm text-muted">No policies yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {initialPolicies.map((p) => (
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
        </>
      )}
    </div>
  );
}
