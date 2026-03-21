/**
 * Website Content tab — edit all public-facing copy from the admin dashboard.
 *
 * Sections: Hero, About, Footer, SEO, Social Links, FAQ, Consulting, Events.
 * Each section saves independently via `saveSiteContent()`.
 *
 * @module settings/components/WebsiteContentTab
 * @see {@link ../settings-actions.ts} — `SiteContent` type + save action
 */
"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SiteContent } from "../settings-actions";
import { saveSiteContent } from "../settings-actions";
import { FieldRow, StatefulSaveButton, Toggle, INPUT_CLASS } from "./shared";

const TEXTAREA_CLASS = cn(INPUT_CLASS, "resize-none");

export function WebsiteContentTab({ initial }: { initial: SiteContent }) {
  /** Full site content object — all sections edited in one state blob. */
  const [data, setData] = useState(initial);
  /** Whether the global save is in flight. */
  const [saving, setSaving] = useState(false);
  /** Briefly true after save succeeds to show "Saved!" feedback. */
  const [saved, setSaved] = useState(false);
  /** Error message from save, if any. */
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * update — type-safe setter for any SiteContent field.
   * Uses a generic constraint so the value type must match the key's type.
   * Spread-merges the new value into the previous state object.
   */
  function update<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const result = await saveSiteContent(data);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setSaveError(result.error);
    }
  }

  return (
    <div className="space-y-5">
      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <span>{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}
      <div>
        <h2 className="text-base font-semibold text-foreground">Website Content</h2>
        <p className="text-xs text-muted mt-0.5">
          Edit the public-facing text on your website. Changes apply after saving.
        </p>
      </div>

      {/* Hero */}
      <SectionHeader title="Hero" description="Landing page headline and call-to-action" />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <FieldRow label="Headline">
            <input
              type="text"
              value={data.heroHeadline}
              onChange={(e) => update("heroHeadline", e.target.value)}
              className={INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Subheadline">
            <textarea
              rows={3}
              value={data.heroSubheadline}
              onChange={(e) => update("heroSubheadline", e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </FieldRow>
          <FieldRow label="CTA Button Text">
            <input
              type="text"
              value={data.heroCtaText}
              onChange={(e) => update("heroCtaText", e.target.value)}
              className={INPUT_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* About */}
      <SectionHeader title="About" description="Bio text shown on the About page" />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <FieldRow label="Bio">
            <textarea
              rows={6}
              value={data.aboutBio}
              onChange={(e) => update("aboutBio", e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Footer */}
      <SectionHeader title="Footer" description="Tagline shown in the site footer" />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <FieldRow label="Tagline">
            <textarea
              rows={2}
              value={data.footerTagline}
              onChange={(e) => update("footerTagline", e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* SEO */}
      <SectionHeader title="SEO" description="Meta title and description for search engines" />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <FieldRow label="Meta Title">
            <input
              type="text"
              value={data.seoTitle}
              onChange={(e) => update("seoTitle", e.target.value)}
              className={INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Meta Description">
            <textarea
              rows={2}
              value={data.seoDescription}
              onChange={(e) => update("seoDescription", e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Social Links */}
      <SectionHeader title="Social Links" description="Social media links shown on public pages" />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-3">
          {data.socialLinks.map((link, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                type="text"
                placeholder="Platform"
                value={link.platform}
                onChange={(e) => {
                  const updated = [...data.socialLinks];
                  updated[i] = { ...updated[i], platform: e.target.value };
                  update("socialLinks", updated);
                }}
                className={cn(INPUT_CLASS, "w-28")}
              />
              <input
                type="text"
                placeholder="Handle"
                value={link.handle}
                onChange={(e) => {
                  const updated = [...data.socialLinks];
                  updated[i] = { ...updated[i], handle: e.target.value };
                  update("socialLinks", updated);
                }}
                className={cn(INPUT_CLASS, "w-36")}
              />
              <input
                type="text"
                placeholder="URL"
                value={link.url}
                onChange={(e) => {
                  const updated = [...data.socialLinks];
                  updated[i] = { ...updated[i], url: e.target.value };
                  update("socialLinks", updated);
                }}
                className={cn(INPUT_CLASS, "flex-1")}
              />
              <button
                type="button"
                onClick={() =>
                  update(
                    "socialLinks",
                    data.socialLinks.filter((_, j) => j !== i),
                  )
                }
                className="text-muted hover:text-destructive transition-colors p-2"
                aria-label="Remove social link"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update("socialLinks", [...data.socialLinks, { platform: "", handle: "", url: "" }])
            }
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Link
          </button>
        </CardContent>
      </Card>

      {/* FAQ */}
      <SectionHeader
        title="FAQ"
        description="Frequently asked questions on the landing page. Use {depositPercent}, {cancelWindowHours}, {lateCancelFeePercent}, {noShowFeePercent} to auto-fill policy values."
      />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          {data.faqEntries.map((entry, i) => (
            <div key={i} className="border border-border/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Question"
                  value={entry.question}
                  onChange={(e) => {
                    const updated = [...data.faqEntries];
                    updated[i] = { ...updated[i], question: e.target.value };
                    update("faqEntries", updated);
                  }}
                  className={cn(INPUT_CLASS, "font-medium")}
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      const updated = [...data.faqEntries];
                      [updated[i - 1], updated[i]] = [updated[i], updated[i - 1]];
                      update("faqEntries", updated);
                    }}
                    className="p-1 text-muted hover:text-foreground disabled:opacity-30 transition-colors"
                    aria-label="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={i === data.faqEntries.length - 1}
                    onClick={() => {
                      const updated = [...data.faqEntries];
                      [updated[i], updated[i + 1]] = [updated[i + 1], updated[i]];
                      update("faqEntries", updated);
                    }}
                    className="p-1 text-muted hover:text-foreground disabled:opacity-30 transition-colors"
                    aria-label="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "faqEntries",
                        data.faqEntries.filter((_, j) => j !== i),
                      )
                    }
                    className="p-1 text-muted hover:text-destructive transition-colors"
                    aria-label="Remove FAQ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                placeholder="Answer"
                value={entry.answer}
                onChange={(e) => {
                  const updated = [...data.faqEntries];
                  updated[i] = { ...updated[i], answer: e.target.value };
                  update("faqEntries", updated);
                }}
                className={TEXTAREA_CLASS}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => update("faqEntries", [...data.faqEntries, { question: "", answer: "" }])}
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add FAQ Entry
          </button>
        </CardContent>
      </Card>

      {/* Consulting */}
      <SectionHeader title="Consulting" description="Consulting page content and visibility" />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <div className="flex items-center justify-between gap-4 py-0.5">
            <div>
              <p className="text-sm text-foreground">Show Consulting Page</p>
              <p className="text-xs text-muted mt-0.5">
                When off, the consulting page redirects to home
              </p>
            </div>
            <Toggle
              on={data.showConsultingPage}
              onChange={(v) => update("showConsultingPage", v)}
            />
          </div>

          <div className="border-t border-border/50 pt-4">
            <p className="text-xs font-medium text-muted mb-3">Services</p>
            {data.consultingServices.map((svc, i) => (
              <div key={i} className="border border-border/50 rounded-lg p-4 space-y-3 mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Title"
                    value={svc.title}
                    onChange={(e) => {
                      const updated = [...data.consultingServices];
                      updated[i] = { ...updated[i], title: e.target.value };
                      update("consultingServices", updated);
                    }}
                    className={cn(INPUT_CLASS, "flex-1")}
                  />
                  <input
                    type="text"
                    placeholder="Tag (e.g. Remote · All Industries)"
                    value={svc.tag}
                    onChange={(e) => {
                      const updated = [...data.consultingServices];
                      updated[i] = { ...updated[i], tag: e.target.value };
                      update("consultingServices", updated);
                    }}
                    className={cn(INPUT_CLASS, "w-48")}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "consultingServices",
                        data.consultingServices.filter((_, j) => j !== i),
                      )
                    }
                    className="p-1 text-muted hover:text-destructive transition-colors"
                    aria-label="Remove service"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Description"
                  value={svc.description}
                  onChange={(e) => {
                    const updated = [...data.consultingServices];
                    updated[i] = { ...updated[i], description: e.target.value };
                    update("consultingServices", updated);
                  }}
                  className={TEXTAREA_CLASS}
                />
                <div>
                  <p className="text-xs text-muted mb-2">Outcomes</p>
                  {svc.outcomes.map((outcome, oi) => (
                    <div key={oi} className="flex items-center gap-2 mb-1.5">
                      <input
                        type="text"
                        value={outcome}
                        onChange={(e) => {
                          const updated = [...data.consultingServices];
                          const outcomes = [...updated[i].outcomes];
                          outcomes[oi] = e.target.value;
                          updated[i] = { ...updated[i], outcomes };
                          update("consultingServices", updated);
                        }}
                        className={cn(INPUT_CLASS, "flex-1")}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...data.consultingServices];
                          updated[i] = {
                            ...updated[i],
                            outcomes: updated[i].outcomes.filter((_, j) => j !== oi),
                          };
                          update("consultingServices", updated);
                        }}
                        className="p-1 text-muted hover:text-destructive transition-colors"
                        aria-label="Remove outcome"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...data.consultingServices];
                      updated[i] = {
                        ...updated[i],
                        outcomes: [...updated[i].outcomes, ""],
                      };
                      update("consultingServices", updated);
                    }}
                    className="text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    + Add outcome
                  </button>
                </div>
                <FieldRow label="Ideal Client">
                  <textarea
                    rows={2}
                    value={svc.idealClient}
                    onChange={(e) => {
                      const updated = [...data.consultingServices];
                      updated[i] = { ...updated[i], idealClient: e.target.value };
                      update("consultingServices", updated);
                    }}
                    className={TEXTAREA_CLASS}
                  />
                </FieldRow>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                update("consultingServices", [
                  ...data.consultingServices,
                  { title: "", tag: "", description: "", outcomes: [], idealClient: "" },
                ])
              }
              className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Service
            </button>
          </div>

          <div className="border-t border-border/50 pt-4">
            <p className="text-xs font-medium text-muted mb-3">Benefits (Why Remote Consulting)</p>
            {data.consultingBenefits.map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <input
                  type="text"
                  value={benefit}
                  onChange={(e) => {
                    const updated = [...data.consultingBenefits];
                    updated[i] = e.target.value;
                    update("consultingBenefits", updated);
                  }}
                  className={cn(INPUT_CLASS, "flex-1")}
                />
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "consultingBenefits",
                      data.consultingBenefits.filter((_, j) => j !== i),
                    )
                  }
                  className="p-1 text-muted hover:text-destructive transition-colors"
                  aria-label="Remove benefit"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update("consultingBenefits", [...data.consultingBenefits, ""])}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              + Add benefit
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      <SectionHeader title="Events" description="Event type cards on the landing page" />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-3">
          {data.eventDescriptions.map((event, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                type="text"
                placeholder="Title"
                value={event.title}
                onChange={(e) => {
                  const updated = [...data.eventDescriptions];
                  updated[i] = { ...updated[i], title: e.target.value };
                  update("eventDescriptions", updated);
                }}
                className={cn(INPUT_CLASS, "w-44")}
              />
              <textarea
                rows={2}
                placeholder="Description"
                value={event.description}
                onChange={(e) => {
                  const updated = [...data.eventDescriptions];
                  updated[i] = { ...updated[i], description: e.target.value };
                  update("eventDescriptions", updated);
                }}
                className={cn(TEXTAREA_CLASS, "flex-1")}
              />
              <button
                type="button"
                onClick={() =>
                  update(
                    "eventDescriptions",
                    data.eventDescriptions.filter((_, j) => j !== i),
                  )
                }
                className="p-2 text-muted hover:text-destructive transition-colors"
                aria-label="Remove event"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update("eventDescriptions", [
                ...data.eventDescriptions,
                { title: "", description: "" },
              ])
            }
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Event Type
          </button>
        </CardContent>
      </Card>

      {/* Global Save */}
      <div className="flex justify-end pt-2">
        <StatefulSaveButton saving={saving} saved={saved} onSave={handleSave} />
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted mt-0.5">{description}</p>
    </div>
  );
}
