/**
 * useBulkSelect — Reusable hook for multi-row selection on dashboard tables.
 *
 * Manages a Set<string> of selected IDs with select/deselect/toggle/selectAll/clear.
 * Returns state + helpers for checkbox columns and bulk action bars.
 */
"use client";

import { useMemo, useState } from "react";

interface BulkSelectable {
  id: string | number;
}

interface BulkSelectReturn {
  selectedIds: Set<string>;
  isSelected: (id: string | number) => boolean;
  toggle: (id: string | number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isAllSelected: boolean;
  isPartialSelected: boolean;
  selectedCount: number;
}

export function useBulkSelect<T extends BulkSelectable>(items: T[]): BulkSelectReturn {
  const [rawSelectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const validIds = useMemo(() => new Set(items.map((item) => String(item.id))), [items]);

  // Derive pruned selection so stale IDs from previous filter/search results
  // are excluded without calling setState inside an effect.
  const selectedIds = useMemo(() => {
    if (rawSelectedIds.size === 0) return rawSelectedIds;
    let allValid = true;
    for (const id of rawSelectedIds) {
      if (!validIds.has(id)) {
        allValid = false;
        break;
      }
    }
    if (allValid) return rawSelectedIds;
    const pruned = new Set<string>();
    for (const id of rawSelectedIds) {
      if (validIds.has(id)) pruned.add(id);
    }
    return pruned;
  }, [rawSelectedIds, validIds]);

  function toggle(id: string | number) {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(validIds));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function isSelected(id: string | number) {
    return selectedIds.has(String(id));
  }

  const selectedCount = selectedIds.size;
  const isAllSelected = selectedCount === items.length && items.length > 0;
  const isPartialSelected = selectedCount > 0 && selectedCount < items.length;

  return {
    selectedIds,
    isSelected,
    toggle,
    selectAll,
    clearSelection,
    isAllSelected,
    isPartialSelected,
    selectedCount,
  };
}
