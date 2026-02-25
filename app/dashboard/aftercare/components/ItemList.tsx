"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ItemList({
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
