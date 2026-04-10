/**
 * Tests for the useBulkSelect hook.
 *
 * Verifies toggle, selectAll, clearSelection, and stale-ID pruning
 * when the item list changes (e.g. after filtering or search).
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useBulkSelect } from "./use-bulk-select";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("useBulkSelect", () => {
  it("starts with nothing selected", () => {
    const { result } = renderHook(() => useBulkSelect(items));

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isPartialSelected).toBe(false);
  });

  it("toggle adds an ID to the selection", () => {
    const { result } = renderHook(() => useBulkSelect(items));

    act(() => result.current.toggle("a"));

    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isPartialSelected).toBe(true);
  });

  it("toggle removes an already-selected ID", () => {
    const { result } = renderHook(() => useBulkSelect(items));

    act(() => result.current.toggle("b"));
    act(() => result.current.toggle("b"));

    expect(result.current.isSelected("b")).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it("toggle works with numeric IDs", () => {
    const numericItems = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const { result } = renderHook(() => useBulkSelect(numericItems));

    act(() => result.current.toggle(2));

    expect(result.current.isSelected(2)).toBe(true);
    expect(result.current.selectedIds.has("2")).toBe(true);
  });

  it("selectAll selects every item", () => {
    const { result } = renderHook(() => useBulkSelect(items));

    act(() => result.current.selectAll());

    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.isPartialSelected).toBe(false);
  });

  it("clearSelection empties the set", () => {
    const { result } = renderHook(() => useBulkSelect(items));

    act(() => result.current.selectAll());
    act(() => result.current.clearSelection());

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it("prunes stale IDs when items change", () => {
    let currentItems = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const { result, rerender } = renderHook(() => useBulkSelect(currentItems));

    act(() => result.current.selectAll());
    expect(result.current.selectedCount).toBe(3);

    currentItems = [{ id: "a" }, { id: "c" }];
    rerender();

    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isSelected("b")).toBe(false);
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.isSelected("c")).toBe(true);
  });

  it("isAllSelected is false when items list is empty", () => {
    const { result } = renderHook(() => useBulkSelect([]));

    expect(result.current.isAllSelected).toBe(false);
  });
});
