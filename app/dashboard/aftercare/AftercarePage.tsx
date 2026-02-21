"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, FileText, Pencil, Save, X, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, Field, Input, Textarea, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & initial data                                                */
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

const INITIAL_AFTERCARE: AftercareSection[] = [
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

const INITIAL_POLICIES: Policy[] = [
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
    id: "photos",
    title: "Photo & Social Media",
    content: `We love sharing our work! By booking with T Creative Studio, you agree that:\n\n• We may take before/after photos during your appointment for portfolio purposes.\n• Photos may be shared on our Instagram, website, and other marketing materials.\n• If you do not wish to be photographed, please let us know at the start of your appointment.`,
  },
  {
    id: "satisfaction",
    title: "Satisfaction & Returns",
    content: `Your satisfaction matters to us.\n\n• If you experience any concerns with your lash retention within 72 hours, contact us and we will assess and correct at no charge.\n• Products purchased in-studio can be exchanged within 7 days if unopened.\n• Training deposits are non-refundable once a start date is confirmed.`,
  },
];

/* ------------------------------------------------------------------ */
/*  Inline item list with add / edit / delete                          */
/* ------------------------------------------------------------------ */

function ItemList({
  items,
  accent,
  onAdd,
  onEdit,
  onRemove,
}: {
  items: string[];
  accent: "green" | "red";
  onAdd: (val: string) => void;
  onEdit: (idx: number, val: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [newVal, setNewVal] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");

  const colors =
    accent === "green"
      ? {
          dot: "bg-[#4e6b51]",
          ring: "focus:ring-[#4e6b51]/40",
          addBtn: "bg-[#4e6b51]/10 text-[#4e6b51] hover:bg-[#4e6b51]/20",
        }
      : {
          dot: "bg-destructive/60",
          ring: "focus:ring-destructive/30",
          addBtn: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        };

  function commitAdd() {
    if (!newVal.trim()) return;
    onAdd(newVal.trim());
    setNewVal("");
  }

  function startEdit(i: number) {
    setEditIdx(i);
    setEditVal(items[i]);
  }

  function commitEdit() {
    if (editIdx === null) return;
    if (editVal.trim()) onEdit(editIdx, editVal.trim());
    setEditIdx(null);
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 group items-start">
          {editIdx === i ? (
            <div className="flex-1 flex gap-1.5">
              <input
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditIdx(null);
                }}
                className={cn(
                  "flex-1 text-xs px-2.5 py-1.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-1",
                  colors.ring,
                )}
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditIdx(null)}
                className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <span className={cn("w-1.5 h-1.5 rounded-full mt-[5px] shrink-0", colors.dot)} />
              <span
                onClick={() => startEdit(i)}
                className="flex-1 text-xs text-foreground/80 leading-relaxed cursor-text hover:text-foreground transition-colors"
                title="Click to edit"
              >
                {item}
              </span>
              <button
                onClick={() => onRemove(i)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/8 text-muted hover:text-destructive transition-all shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      ))}

      {/* Add row */}
      <div className="flex gap-1.5 pt-2 mt-1 border-t border-border/40">
        <input
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitAdd();
          }}
          placeholder="Add new item…"
          className={cn(
            "flex-1 text-xs px-2.5 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 placeholder:text-muted",
            colors.ring,
          )}
        />
        <button
          onClick={commitAdd}
          disabled={!newVal.trim()}
          className={cn(
            "flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-40",
            colors.addBtn,
          )}
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Aftercare section card                                              */
/* ------------------------------------------------------------------ */

function AftercareCard({
  section,
  onUpdate,
  onDelete,
}: {
  section: AftercareSection;
  onUpdate: (updated: AftercareSection) => void;
  onDelete: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);

  function saveTitle() {
    if (titleDraft.trim()) onUpdate({ ...section, title: titleDraft.trim() });
    setEditingTitle(false);
  }

  return (
    <Card className="gap-0">
      {/* Card header */}
      <CardHeader className="pt-5 pb-3 px-5">
        <div className="flex items-center justify-between gap-2">
          {editingTitle ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="text-sm font-semibold bg-surface border border-border rounded-lg px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-accent/40"
                autoFocus
              />
              <button
                onClick={saveTitle}
                className="flex items-center gap-1 text-xs text-[#4e6b51] px-2 py-1 rounded-lg bg-[#4e6b51]/8 hover:bg-[#4e6b51]/15 transition-colors"
              >
                <Save className="w-3 h-3" /> Save
              </button>
              <button
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(section.title);
                }}
                className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingTitle(true)}
                  className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-foreground/5"
                >
                  <Pencil className="w-3 h-3" /> Rename
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg hover:bg-destructive/8 text-muted hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </CardHeader>

      {/* Dos / Don'ts */}
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Do's */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4e6b51] mb-3 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> What to Do
            </p>
            <ItemList
              items={section.dos}
              accent="green"
              onAdd={(val) => onUpdate({ ...section, dos: [...section.dos, val] })}
              onEdit={(i, val) =>
                onUpdate({ ...section, dos: section.dos.map((d, idx) => (idx === i ? val : d)) })
              }
              onRemove={(i) =>
                onUpdate({ ...section, dos: section.dos.filter((_, idx) => idx !== i) })
              }
            />
          </div>

          {/* Don'ts */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> What NOT to Do
            </p>
            <ItemList
              items={section.donts}
              accent="red"
              onAdd={(val) => onUpdate({ ...section, donts: [...section.donts, val] })}
              onEdit={(i, val) =>
                onUpdate({
                  ...section,
                  donts: section.donts.map((d, idx) => (idx === i ? val : d)),
                })
              }
              onRemove={(i) =>
                onUpdate({ ...section, donts: section.donts.filter((_, idx) => idx !== i) })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Policy card (inline editable)                                      */
/* ------------------------------------------------------------------ */

function PolicyCard({
  policy,
  onUpdate,
  onDelete,
}: {
  policy: Policy;
  onUpdate: (updated: Policy) => void;
  onDelete: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(policy.title);
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState(policy.content);

  function commitTitle() {
    onUpdate({ ...policy, title: titleDraft.trim() || policy.title });
    setEditingTitle(false);
  }

  function commitContent() {
    onUpdate({ ...policy, content: contentDraft });
    setEditingContent(false);
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pt-4 pb-2 px-5">
        <div className="flex items-center justify-between gap-2">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleDraft(policy.title);
                  setEditingTitle(false);
                }
              }}
              className="text-sm font-semibold bg-surface border border-border rounded-lg px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          ) : (
            <CardTitle
              className="text-sm font-semibold cursor-text hover:text-foreground/70 transition-colors"
              onClick={() => setEditingTitle(true)}
              title="Click to edit title"
            >
              {policy.title}
            </CardTitle>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/8 text-muted hover:text-destructive transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {editingContent ? (
          <textarea
            autoFocus
            value={contentDraft}
            onChange={(e) => setContentDraft(e.target.value)}
            onBlur={commitContent}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setContentDraft(policy.content);
                setEditingContent(false);
              }
            }}
            rows={7}
            className="w-full resize-y bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        ) : (
          <div
            onClick={() => setEditingContent(true)}
            className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line cursor-text hover:text-foreground transition-colors"
            title="Click to edit"
          >
            {policy.content}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  New aftercare section dialog                                        */
/* ------------------------------------------------------------------ */

function NewSectionDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (section: AftercareSection) => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="New Aftercare Section" size="sm">
      <div className="space-y-4" key={String(open)}>
        <Field label="Service / section title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sugaring Aftercare"
            autoFocus
          />
        </Field>
        <p className="text-xs text-muted">
          You can add do&apos;s and don&apos;ts inline after creating the section.
        </p>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!title.trim()) return;
            onAdd({ id: Date.now().toString(), title: title.trim(), dos: [], donts: [] });
            onClose();
          }}
          confirmLabel="Create section"
          disabled={!title.trim()}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  New policy dialog                                                   */
/* ------------------------------------------------------------------ */

function NewPolicyDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (policy: Policy) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="New Policy" size="md">
      <div className="space-y-4" key={String(open)}>
        <Field label="Policy title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Gift Card Policy"
            autoFocus
          />
        </Field>
        <Field label="Policy content" required>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Write the policy text here…"
          />
        </Field>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!title.trim()) return;
            onAdd({ id: Date.now().toString(), title: title.trim(), content });
            onClose();
          }}
          confirmLabel="Add policy"
          disabled={!title.trim()}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function AftercarePage() {
  const [tab, setTab] = useState<"aftercare" | "policies">("aftercare");
  const [sections, setSections] = useState<AftercareSection[]>(INITIAL_AFTERCARE);
  const [policies, setPolicies] = useState<Policy[]>(INITIAL_POLICIES);
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newPolicyOpen, setNewPolicyOpen] = useState(false);

  function updateSection(updated: AftercareSection) {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  function updatePolicy(updated: Policy) {
    setPolicies((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Aftercare & Policies
          </h1>
          <p className="text-sm text-muted mt-0.5">Client care instructions and studio policies</p>
        </div>
        <button
          onClick={() => (tab === "aftercare" ? setNewSectionOpen(true) : setNewPolicyOpen(true))}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {tab === "aftercare" ? "New Section" : "New Policy"}
        </button>
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
            Hover any item to edit or remove it. Use the <strong>+ Add</strong> button at the bottom
            of each list to add new instructions.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {sections.map((s) => (
              <AftercareCard
                key={s.id}
                section={s}
                onUpdate={updateSection}
                onDelete={() => setSections((prev) => prev.filter((sec) => sec.id !== s.id))}
              />
            ))}
            {sections.length === 0 && (
              <div className="col-span-full text-center py-12 border border-dashed border-border rounded-xl">
                <p className="text-sm text-muted">No aftercare sections yet.</p>
                <button
                  onClick={() => setNewSectionOpen(true)}
                  className="mt-2 text-sm text-accent hover:underline"
                >
                  + Add your first section
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "policies" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Click <strong>Edit</strong> on any policy to update it inline.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {policies.map((p) => (
              <PolicyCard
                key={p.id}
                policy={p}
                onUpdate={updatePolicy}
                onDelete={() => setPolicies((prev) => prev.filter((pol) => pol.id !== p.id))}
              />
            ))}
            {policies.length === 0 && (
              <div className="col-span-full text-center py-12 border border-dashed border-border rounded-xl">
                <p className="text-sm text-muted">No policies yet.</p>
                <button
                  onClick={() => setNewPolicyOpen(true)}
                  className="mt-2 text-sm text-accent hover:underline"
                >
                  + Add your first policy
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <NewSectionDialog
        key={`section-${newSectionOpen}`}
        open={newSectionOpen}
        onClose={() => setNewSectionOpen(false)}
        onAdd={(s) => setSections((prev) => [...prev, s])}
      />
      <NewPolicyDialog
        key={`policy-${newPolicyOpen}`}
        open={newPolicyOpen}
        onClose={() => setNewPolicyOpen(false)}
        onAdd={(p) => setPolicies((prev) => [...prev, p])}
      />
    </div>
  );
}
