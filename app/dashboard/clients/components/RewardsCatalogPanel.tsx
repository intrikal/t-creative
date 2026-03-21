/**
 * Admin panel for managing the loyalty rewards catalog — CRUD for reward items
 * that clients can redeem with their loyalty points. Shows a table of all rewards
 * with category, points cost, dollar value, active status, and edit/deactivate actions.
 *
 * Parent: app/dashboard/clients/components/LoyaltyTab.tsx
 *
 * State:
 *   rewards     — local copy of reward rows for optimistic updates
 *   editTarget  — reward being edited (opens RewardFormDialog)
 *   showCreate  — controls the create RewardFormDialog
 *
 * Key operations:
 *   rewards.filter((r) => r.active).length — count of active rewards for header
 *   handleDelete — deactivates a reward via server action, then optimistically
 *                  sets active=false in local state using .map()
 *   rewards.map() — renders each reward as a table row with category icon lookup
 *                   from CATEGORY_ICON record, and category label via .replace("_", " ")
 *
 * Sub-component: RewardFormDialog
 *   Create/edit form for a single reward with label, category radio group,
 *   points cost, discount amount (for discount category), description, sort order,
 *   and active toggle.
 *
 *   State: form (FormData), isPending, error
 *   set()       — generic updater spreading a single key into form state
 *   handleSave  — validates inputs, calls createLoyaltyReward or updateLoyaltyReward
 *   formFromRow — converts a LoyaltyRewardRow to form state for editing
 */
"use client";

import { useState, useTransition } from "react";
import {
  Gift,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Scissors,
  Tag,
  Trash2,
  type LucideIcon,
  GripVertical,
} from "lucide-react";
import { Dialog, Field, Input, Textarea, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  type LoyaltyRewardRow,
  createLoyaltyReward,
  updateLoyaltyReward,
  deleteLoyaltyReward,
} from "../loyalty-rewards-actions";

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */

const CATEGORIES: {
  id: LoyaltyRewardRow["category"];
  label: string;
  Icon: LucideIcon;
}[] = [
  { id: "discount", label: "Discount", Icon: Tag },
  { id: "add_on", label: "Add-on", Icon: Sparkles },
  { id: "service", label: "Service", Icon: Scissors },
  { id: "product", label: "Product", Icon: ShoppingBag },
];

const CATEGORY_ICON: Record<string, LucideIcon> = {
  discount: Tag,
  add_on: Sparkles,
  service: Scissors,
  product: ShoppingBag,
};

/* ------------------------------------------------------------------ */
/*  RewardFormDialog                                                    */
/* ------------------------------------------------------------------ */

type FormData = {
  label: string;
  pointsCost: string;
  discountInCents: string;
  category: LoyaltyRewardRow["category"];
  description: string;
  sortOrder: string;
  active: boolean;
};

const EMPTY_FORM: FormData = {
  label: "",
  pointsCost: "",
  discountInCents: "",
  category: "discount",
  description: "",
  sortOrder: "0",
  active: true,
};

function formFromRow(row: LoyaltyRewardRow): FormData {
  return {
    label: row.label,
    pointsCost: String(row.pointsCost),
    discountInCents: row.discountInCents != null ? String(row.discountInCents) : "",
    category: row.category,
    description: row.description ?? "",
    sortOrder: String(row.sortOrder),
    active: row.active,
  };
}

function RewardFormDialog({
  reward,
  onClose,
  onSaved,
}: {
  reward: LoyaltyRewardRow | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = reward !== null;
  const [form, setForm] = useState<FormData>(reward ? formFromRow(reward) : EMPTY_FORM);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    setError(null);
    const pointsCost = parseInt(form.pointsCost, 10);
    if (!form.label.trim()) return setError("Label is required");
    if (!pointsCost || pointsCost <= 0) return setError("Points cost must be positive");

    const discountInCents =
      form.category === "discount" && form.discountInCents
        ? parseInt(form.discountInCents, 10)
        : null;

    if (form.category === "discount" && (discountInCents == null || discountInCents <= 0)) {
      return setError("Discount amount is required for discount rewards");
    }

    startTransition(async () => {
      try {
        if (isEdit && reward) {
          await updateLoyaltyReward({
            id: reward.id,
            label: form.label.trim(),
            pointsCost,
            discountInCents,
            category: form.category,
            description: form.description.trim() || null,
            sortOrder: parseInt(form.sortOrder, 10) || 0,
            active: form.active,
          });
        } else {
          await createLoyaltyReward({
            label: form.label.trim(),
            pointsCost,
            discountInCents,
            category: form.category,
            description: form.description.trim() || null,
            sortOrder: parseInt(form.sortOrder, 10) || 0,
          });
        }
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open onClose={onClose} title={isEdit ? "Edit Reward" : "Add Reward"} size="md">
      <div className="space-y-4">
        {error && (
          <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Field label="Reward name">
          <Input
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="e.g. $10 Off Any Service"
            autoFocus
          />
        </Field>

        <fieldset>
          <legend className="text-xs font-medium text-muted mb-2">Category</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                role="radio"
                aria-checked={form.category === cat.id}
                onClick={() => set("category", cat.id)}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all",
                  form.category === cat.id
                    ? "border-accent bg-accent/8"
                    : "border-border hover:border-foreground/20 hover:bg-foreground/4",
                )}
              >
                <cat.Icon
                  className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    form.category === cat.id ? "text-accent" : "text-muted",
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium",
                    form.category === cat.id ? "text-accent" : "text-foreground",
                  )}
                >
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Points cost">
            <Input
              type="number"
              value={form.pointsCost}
              onChange={(e) => set("pointsCost", e.target.value)}
              placeholder="e.g. 200"
              min={1}
            />
          </Field>

          {form.category === "discount" && (
            <Field label="Discount (cents)">
              <Input
                type="number"
                value={form.discountInCents}
                onChange={(e) => set("discountInCents", e.target.value)}
                placeholder="e.g. 1000 = $10"
                min={1}
              />
            </Field>
          )}
        </div>

        <Field label="Description" hint="Optional — shown to clients">
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="e.g. Get $10 off your next lash appointment"
            rows={2}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sort order">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value)}
              placeholder="0"
              min={0}
            />
          </Field>

          {isEdit && (
            <Field label="Status">
              <button
                onClick={() => set("active", !form.active)}
                className={cn(
                  "w-full text-xs font-medium py-2 rounded-lg border transition-colors",
                  form.active
                    ? "text-[#4e6b51] bg-[#4e6b51]/10 border-[#4e6b51]/20"
                    : "text-muted bg-foreground/5 border-border",
                )}
              >
                {form.active ? "Active" : "Inactive"}
              </button>
            </Field>
          )}
        </div>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Reward"}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  RewardsCatalogPanel                                                */
/* ------------------------------------------------------------------ */

export function RewardsCatalogPanel({ initialRewards }: { initialRewards: LoyaltyRewardRow[] }) {
  const [rewards, setRewards] = useState(initialRewards);
  const [editTarget, setEditTarget] = useState<LoyaltyRewardRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    // Rewards will be refreshed via revalidatePath on next navigation
    // For immediate UI feedback, we optimistically update
  }

  function handleDelete(reward: LoyaltyRewardRow) {
    startTransition(async () => {
      await deleteLoyaltyReward(reward.id);
      setRewards((prev) => prev.map((r) => (r.id === reward.id ? { ...r, active: false } : r)));
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-accent" />
          <p className="text-xs font-semibold text-foreground">Rewards Catalog</p>
          <span className="text-[10px] text-muted">
            {rewards.filter((r) => r.active).length} active
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Reward
        </button>
      </div>

      {rewards.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-center">
          <Gift className="w-8 h-8 text-muted/30 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No rewards configured</p>
          <p className="text-xs text-muted mt-1">
            Add rewards that clients can redeem with their loyalty points.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                  Reward
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                  Category
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                  Points
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5 hidden md:table-cell">
                  Value
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                  Status
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((r) => {
                const CatIcon = CATEGORY_ICON[r.category] ?? Gift;
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-border/40 last:border-0 transition-colors",
                      r.active ? "hover:bg-surface/60" : "opacity-50",
                    )}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div>
                        <p className="text-sm font-medium text-foreground">{r.label}</p>
                        {r.description && (
                          <p className="text-[10px] text-muted mt-0.5 truncate max-w-[200px]">
                            {r.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted bg-foreground/5 px-2 py-0.5 rounded-full">
                        <CatIcon className="w-3 h-3" />
                        {r.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {r.pointsCost.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle hidden md:table-cell">
                      {r.discountInCents != null ? (
                        <span className="text-sm text-foreground tabular-nums">
                          ${(r.discountInCents / 100).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span
                        className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                          r.active
                            ? "text-[#4e6b51] bg-[#4e6b51]/10 border-[#4e6b51]/20"
                            : "text-muted bg-foreground/5 border-border",
                        )}
                      >
                        {r.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditTarget(r)}
                          className="p-1.5 rounded-md hover:bg-foreground/8 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted" />
                        </button>
                        {r.active && (
                          <button
                            onClick={() => handleDelete(r)}
                            disabled={isPending}
                            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-40"
                            title="Deactivate"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialogs */}
      {showCreate && (
        <RewardFormDialog
          reward={null}
          onClose={() => setShowCreate(false)}
          onSaved={handleRefresh}
        />
      )}
      {editTarget && (
        <RewardFormDialog
          reward={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleRefresh}
        />
      )}
    </div>
  );
}
