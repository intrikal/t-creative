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
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import type { InventoryConfig } from "@/lib/types/settings.types";
import { saveInventoryConfig } from "../settings-actions";
import { FieldRow, AutoSaveStatus, NUM_INPUT_CLASS, INPUT_CLASS } from "./shared";

export function InventoryTab({ initial }: { initial: InventoryConfig }) {
  /** Inventory config fields (low stock threshold, gift card prefix). */
  const [data, setData] = useState(initial);

  const { status, error, dismissError } = useAutoSave({ data, onSave: saveInventoryConfig });

  return (
    <div className="space-y-5">
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
        <AutoSaveStatus status={status} error={error} onDismissError={dismissError} />
      </div>
    </div>
  );
}
