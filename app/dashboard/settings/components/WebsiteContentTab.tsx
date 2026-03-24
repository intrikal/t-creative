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
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import type { SiteContent } from "@/lib/types/settings.types";
import { cn } from "@/lib/utils";
import { saveSiteContent } from "../settings-actions";
import { FieldRow, AutoSaveStatus, Toggle, INPUT_CLASS } from "./shared";

const TEXTAREA_CLASS = cn(INPUT_CLASS, "resize-none");

const SOCIAL_PLATFORMS: { label: string; urlPrefix: string | null }[] = [
  { label: "Instagram", urlPrefix: "https://www.instagram.com/" },
  { label: "TikTok", urlPrefix: "https://www.tiktok.com/@" },
  { label: "LinkedIn", urlPrefix: "https://www.linkedin.com/in/" },
  { label: "Facebook", urlPrefix: "https://www.facebook.com/" },
  { label: "YouTube", urlPrefix: "https://www.youtube.com/@" },
  { label: "X (Twitter)", urlPrefix: "https://x.com/" },
  { label: "Pinterest", urlPrefix: "https://www.pinterest.com/" },
  { label: "Yelp", urlPrefix: "https://www.yelp.com/biz/" },
  { label: "Google Business", urlPrefix: null },
  { label: "Other", urlPrefix: null },
];

function buildSocialUrl(platform: string, handle: string): string {
  const p = SOCIAL_PLATFORMS.find((sp) => sp.label === platform);
  if (!p?.urlPrefix || !handle) return "";
  const clean = handle.replace(/^@/, "");
  return `${p.urlPrefix}${clean}`;
}

export function WebsiteContentTab({ initial }: { initial: SiteContent }) {
  /** Full site content object — all sections edited in one state blob. */
  const [data, setData] = useState(initial);

  const { status, error, dismissError } = useAutoSave({
    data,
    onSave: async (d) => {
      // Filter out incomplete entries that would fail server validation
      const cleaned: SiteContent = {
        ...d,
        faqEntries: d.faqEntries.filter((e) => e.question.trim() && e.answer.trim()),
        socialLinks: d.socialLinks.filter((l) => l.platform && (l.url || l.handle)),
        eventDescriptions: d.eventDescriptions.filter((e) => e.title.trim()),
        consultingServices: d.consultingServices.filter((s) => s.title.trim()),
        consultingBenefits: d.consultingBenefits.filter((b) => b.trim()),
      };
      return saveSiteContent(cleaned);
    },
  });

  /**
   * update — type-safe setter for any SiteContent field.
   * Uses a generic constraint so the value type must match the key's type.
   * Spread-merges the new value into the previous state object.
   */
  function update<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-5">
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
          {data.socialLinks.map((link, i) => {
            const platformInfo = SOCIAL_PLATFORMS.find((p) => p.label === link.platform);
            const urlPrefix = platformInfo?.urlPrefix;

            return (
              <div key={i} className="border border-border/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
                        Platform
                      </label>
                      <select
                        value={link.platform}
                        onChange={(e) => {
                          const updated = [...data.socialLinks];
                          const newPlatform = e.target.value;
                          const newUrl = buildSocialUrl(newPlatform, updated[i].handle);
                          updated[i] = {
                            ...updated[i],
                            platform: newPlatform,
                            url: newUrl || updated[i].url,
                          };
                          update("socialLinks", updated);
                        }}
                        className={INPUT_CLASS}
                      >
                        <option value="" disabled>
                          Select…
                        </option>
                        {SOCIAL_PLATFORMS.map((p) => (
                          <option key={p.label} value={p.label}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
                        {urlPrefix ? "Handle" : "URL"}
                      </label>
                      {urlPrefix ? (
                        <div className={cn(INPUT_CLASS, "flex items-center gap-0 !px-0")}>
                          <span className="text-xs text-muted/50 pl-3 shrink-0">{urlPrefix}</span>
                          <input
                            type="text"
                            placeholder="your-handle"
                            value={link.handle}
                            onChange={(e) => {
                              const updated = [...data.socialLinks];
                              const handle = e.target.value.replace(/^@/, "");
                              const newUrl = buildSocialUrl(link.platform, handle);
                              updated[i] = { ...updated[i], handle, url: newUrl };
                              update("socialLinks", updated);
                            }}
                            className="bg-transparent text-sm text-foreground flex-1 min-w-0 py-2 pr-3 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => {
                            const updated = [...data.socialLinks];
                            updated[i] = { ...updated[i], url: e.target.value };
                            update("socialLinks", updated);
                          }}
                          className={INPUT_CLASS}
                        />
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "socialLinks",
                        data.socialLinks.filter((_, j) => j !== i),
                      )
                    }
                    className="text-muted hover:text-destructive transition-colors p-2 shrink-0 mt-5"
                    aria-label="Remove social link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
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
      <SectionHeader title="FAQ" description="Frequently asked questions on the landing page" />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <p className="text-[11px] text-muted/70 bg-surface/60 rounded-md px-3 py-2">
            <span className="font-medium text-muted">Tip:</span> Use{" "}
            <code className="text-[10px] bg-foreground/5 px-1 py-0.5 rounded">
              {"{depositPercent}"}
            </code>
            ,{" "}
            <code className="text-[10px] bg-foreground/5 px-1 py-0.5 rounded">
              {"{cancelWindowHours}"}
            </code>
            ,{" "}
            <code className="text-[10px] bg-foreground/5 px-1 py-0.5 rounded">
              {"{lateCancelFeePercent}"}
            </code>
            ,{" "}
            <code className="text-[10px] bg-foreground/5 px-1 py-0.5 rounded">
              {"{noShowFeePercent}"}
            </code>{" "}
            in answers to auto-fill policy values.
          </p>
          {data.faqEntries.map((entry, i) => (
            <div key={i} className="border border-border/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
                    Question
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. What is your cancellation policy?"
                    value={entry.question}
                    onChange={(e) => {
                      const updated = [...data.faqEntries];
                      updated[i] = { ...updated[i], question: e.target.value };
                      update("faqEntries", updated);
                    }}
                    className={cn(INPUT_CLASS, "font-medium")}
                  />
                </div>
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
              <div>
                <label className="block text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
                  Answer
                </label>
                <textarea
                  rows={3}
                  placeholder="Answer text (supports template variables)"
                  value={entry.answer}
                  onChange={(e) => {
                    const updated = [...data.faqEntries];
                    updated[i] = { ...updated[i], answer: e.target.value };
                    update("faqEntries", updated);
                  }}
                  className={TEXTAREA_CLASS}
                />
              </div>
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
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Brand Launch Strategy"
                        value={svc.title}
                        onChange={(e) => {
                          const updated = [...data.consultingServices];
                          updated[i] = { ...updated[i], title: e.target.value };
                          update("consultingServices", updated);
                        }}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
                        Tag
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Remote · All Industries"
                        value={svc.tag}
                        onChange={(e) => {
                          const updated = [...data.consultingServices];
                          updated[i] = { ...updated[i], tag: e.target.value };
                          update("consultingServices", updated);
                        }}
                        className={cn(INPUT_CLASS, "sm:w-48")}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "consultingServices",
                        data.consultingServices.filter((_, j) => j !== i),
                      )
                    }
                    className="p-1 text-muted hover:text-destructive transition-colors shrink-0 mt-5"
                    aria-label="Remove service"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What this service includes"
                    value={svc.description}
                    onChange={(e) => {
                      const updated = [...data.consultingServices];
                      updated[i] = { ...updated[i], description: e.target.value };
                      update("consultingServices", updated);
                    }}
                    className={TEXTAREA_CLASS}
                  />
                </div>
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
            <div key={i} className="border border-border/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Private Lash Parties"
                    value={event.title}
                    onChange={(e) => {
                      const updated = [...data.eventDescriptions];
                      updated[i] = { ...updated[i], title: e.target.value };
                      update("eventDescriptions", updated);
                    }}
                    className={INPUT_CLASS}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "eventDescriptions",
                      data.eventDescriptions.filter((_, j) => j !== i),
                    )
                  }
                  className="p-2 text-muted hover:text-destructive transition-colors shrink-0 self-end"
                  aria-label="Remove event"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted uppercase tracking-wide mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="What this event type includes"
                  value={event.description}
                  onChange={(e) => {
                    const updated = [...data.eventDescriptions];
                    updated[i] = { ...updated[i], description: e.target.value };
                    update("eventDescriptions", updated);
                  }}
                  className={TEXTAREA_CLASS}
                />
              </div>
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

      {/* Stats Overrides */}
      <SectionHeader
        title="Stats"
        description="Override the live-computed numbers on the landing page. Leave blank to use real data."
      />
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <FieldRow label="Clients Served">
            <input
              type="text"
              placeholder="e.g. 500+ (blank = live count)"
              value={data.statsOverrides.clientsServed ?? ""}
              onChange={(e) =>
                update("statsOverrides", {
                  ...data.statsOverrides,
                  clientsServed: e.target.value || undefined,
                })
              }
              className={INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Average Rating">
            <input
              type="text"
              placeholder="e.g. 4.9 (blank = live average)"
              value={data.statsOverrides.averageRating ?? ""}
              onChange={(e) =>
                update("statsOverrides", {
                  ...data.statsOverrides,
                  averageRating: e.target.value || undefined,
                })
              }
              className={INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Rebooking Rate">
            <input
              type="text"
              placeholder="e.g. 98% (blank = live rate)"
              value={data.statsOverrides.rebookingRate ?? ""}
              onChange={(e) =>
                update("statsOverrides", {
                  ...data.statsOverrides,
                  rebookingRate: e.target.value || undefined,
                })
              }
              className={INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Services Count">
            <input
              type="text"
              placeholder="e.g. 4 (blank = live count)"
              value={data.statsOverrides.servicesCount ?? ""}
              onChange={(e) =>
                update("statsOverrides", {
                  ...data.statsOverrides,
                  servicesCount: e.target.value || undefined,
                })
              }
              className={INPUT_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Auto-save status */}
      <div className="flex justify-end pt-2">
        <AutoSaveStatus status={status} error={error} onDismissError={dismissError} />
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
