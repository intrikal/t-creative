/**
 * Inventory tab — low stock threshold and gift card code prefix.
 *
 * DB-wired via the `inventory_config` key in the `settings` table.
 *
 * @module settings/components/InventoryTab
 */
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { InventoryConfig } from "../settings-actions";
import { saveInventoryConfig } from "../settings-actions";
import { FieldRow, StatefulSaveButton, NUM_INPUT_CLASS, INPUT_CLASS } from "./shared";

export function InventoryTab({ initial }: { initial: InventoryConfig }) {
  /** Inventory config fields (low stock threshold, gift card prefix). */
  const [data, setData] = useState(initial);
  /** Whether the save action is in flight. */
  const [saving, setSaving] = useState(false);
  /** Briefly true after a successful save to show "Saved!" feedback. */
  const [saved, setSaved] = useState(false);
  /** Error message from save, if any. */
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const result = await saveInventoryConfig(data);
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
        <h2 className="text-base font-semibold text-foreground">Inventory & Gift Cards</h2>
        <p className="text-xs text-muted mt-0.5">
          Configure stock alerts and gift card code formatting
        </p>
      </div>

      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <FieldRow label="Low stock threshold">
            <input
              type="number"
              value={data.lowStockThreshold}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  lowStockThreshold: parseInt(e.target.value, 10) || 5,
                }))
              }
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Gift card code prefix">
            <input
              type="text"
              value={data.giftCardCodePrefix}
              onChange={(e) => setData((prev) => ({ ...prev, giftCardCodePrefix: e.target.value }))}
              placeholder="TC-GC"
              className={INPUT_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <StatefulSaveButton
          label="Save Inventory Config"
          saving={saving}
          saved={saved}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
