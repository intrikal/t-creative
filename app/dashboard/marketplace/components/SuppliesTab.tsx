"use client";

import { Plus, Minus, Pencil, Trash2, AlertTriangle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupplyRow } from "../actions";

export function SuppliesTab({
  supplies,
  pendingIds,
  onNew,
  onEdit,
  onDelete,
  onAdjustStock,
}: {
  supplies: SupplyRow[];
  pendingIds: Set<string>;
  onNew: () => void;
  onEdit: (s: SupplyRow) => void;
  onDelete: (id: number) => void;
  onAdjustStock: (id: number, delta: number) => void;
}) {
  const lowCount = supplies.filter((c) => c.stock > 0 && c.stock <= c.reorder).length;
  const outCount = supplies.filter((c) => c.stock === 0).length;

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted">
        Track supplies used in services — glue, chains, cleanser, lash trays, etc.
      </div>

      {/* Low stock alert */}
      {(lowCount > 0 || outCount > 0) && (
        <div className="bg-[#c4907a]/8 border border-[#c4907a]/20 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-[#c4907a] shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">
              {lowCount + outCount} item
              {lowCount + outCount !== 1 ? "s" : ""}
            </span>
            {outCount > 0 && lowCount > 0
              ? ` (${outCount} out, ${lowCount} low)`
              : outCount > 0
                ? ` out of stock`
                : ` below reorder point`}{" "}
            — need restocking.
          </p>
        </div>
      )}

      {supplies.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Package className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">No supplies tracked yet.</p>
          <button onClick={onNew} className="mt-2 text-sm text-accent hover:underline">
            + Add your first supply
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface/40">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 py-2.5">
                  Item
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 hidden md:table-cell">
                  Category
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                  In Stock
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 hidden sm:table-cell">
                  Reorder At
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 hidden lg:table-cell">
                  Last Restocked
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                  Status
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 py-2.5">
                  Adjust
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 py-2.5 hidden md:table-cell">
                  Edit
                </th>
              </tr>
            </thead>
            <tbody>
              {supplies.map((item) => {
                const isOut = item.stock === 0;
                const isLow = !isOut && item.stock <= item.reorder;
                const statusColor = isOut
                  ? "text-destructive bg-destructive/10 border-destructive/20"
                  : isLow
                    ? "text-[#a07040] bg-[#a07040]/10 border-[#a07040]/20"
                    : "text-[#4e6b51] bg-[#4e6b51]/10 border-[#4e6b51]/20";
                const statusLabel = isOut ? "Out" : isLow ? "Low" : "OK";
                const pending = pendingIds.has(`s-${item.id}`);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors",
                      pending && "opacity-60",
                    )}
                  >
                    <td className="px-5 py-3.5 align-middle">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-[10px] text-muted">{item.unit}</p>
                    </td>
                    <td className="px-4 py-3.5 align-middle hidden md:table-cell">
                      <span className="text-xs text-muted">{item.category}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          isOut ? "text-destructive" : isLow ? "text-[#7a5c10]" : "text-foreground",
                        )}
                      >
                        {item.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle hidden sm:table-cell">
                      <span className="text-xs text-muted tabular-nums">{item.reorder}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle hidden lg:table-cell">
                      <span className="text-xs text-muted">{item.lastRestocked ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                          statusColor,
                        )}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onAdjustStock(item.id, -1)}
                          disabled={item.stock === 0}
                          className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:bg-foreground/5 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs tabular-nums w-6 text-center text-foreground font-medium">
                          {item.stock}
                        </span>
                        <button
                          onClick={() => onAdjustStock(item.id, 1)}
                          className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center hidden md:table-cell align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
