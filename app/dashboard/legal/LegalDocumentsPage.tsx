"use client";

import { useState, useOptimistic, useTransition } from "react";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveLegalDoc, type LegalDocEntry, type LegalDocInput } from "./actions";
import { DocumentEditor } from "./components/DocumentEditor";

type TabType = "privacy_policy" | "terms_of_service";

const TABS: { key: TabType; label: string }[] = [
  { key: "privacy_policy", label: "Privacy Policy" },
  { key: "terms_of_service", label: "Terms of Service" },
];

interface LegalDocumentsPageProps {
  initialPrivacy: LegalDocEntry | null;
  initialTerms: LegalDocEntry | null;
  embedded?: boolean;
}

export function LegalDocumentsPage({
  initialPrivacy,
  initialTerms,
  embedded,
}: LegalDocumentsPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>("privacy_policy");
  const [, startTransition] = useTransition();

  const [privacyDoc, updatePrivacy] = useOptimistic<LegalDocEntry | null, LegalDocEntry>(
    initialPrivacy,
    (_state, updated) => updated,
  );

  const [termsDoc, updateTerms] = useOptimistic<LegalDocEntry | null, LegalDocEntry>(
    initialTerms,
    (_state, updated) => updated,
  );

  function handleSave(type: TabType, input: LegalDocInput) {
    const updated: LegalDocEntry = {
      id: (type === "privacy_policy" ? privacyDoc?.id : termsDoc?.id) ?? 0,
      type,
      version: input.version,
      intro: input.intro,
      sections: input.sections,
      effectiveDate: input.effectiveDate,
      changeNotes: input.changeNotes ?? null,
      isPublished: true,
      publishedAt: new Date().toISOString(),
    };
    startTransition(async () => {
      if (type === "privacy_policy") {
        updatePrivacy(updated);
      } else {
        updateTerms(updated);
      }
      await saveLegalDoc(type, input);
    });
  }

  const activeDoc = activeTab === "privacy_policy" ? privacyDoc : termsDoc;

  return (
    <div className={embedded ? "" : "p-6 md:p-8 max-w-4xl mx-auto"}>
      {/* Page header */}
      {!embedded && (
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-surface rounded-xl border border-border">
            <Scale className="w-5 h-5 text-muted" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Legal Documents</h1>
            <p className="text-sm text-muted">
              Edit your Privacy Policy and Terms of Service. Changes publish instantly to the live
              site.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <DocumentEditor
        key={activeTab}
        docType={activeTab}
        doc={activeDoc}
        saving={false}
        onSave={(input) => handleSave(activeTab, input)}
      />
    </div>
  );
}
