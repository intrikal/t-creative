/**
 * NotesTab — Communication history and internal notes for a client.
 *
 * Shows a chronological list of notes with type icons, author, and timestamps.
 * Includes an add-note form with type selector, text area, and pin toggle.
 * Filter bar: type dropdown, date range, author search.
 */
"use client";

import { useState, useTransition } from "react";
import {
  StickyNote,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Pin,
  PinOff,
  Trash2,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientNoteRow } from "../note-actions";
import {
  createClientNote,
  updateClientNote,
  deleteClientNote,
  getClientNotes,
} from "../note-actions";

const NOTE_TYPES = [
  { value: "note", label: "Note", icon: StickyNote },
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "in_person", label: "In Person", icon: Users },
] as const;

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  in_person: Users,
};

const TYPE_COLORS: Record<string, string> = {
  note: "bg-foreground/8 text-foreground",
  call: "bg-[#7ba3a3]/12 text-[#5b8a8a]",
  email: "bg-blush/12 text-[#96604a]",
  sms: "bg-[#4e6b51]/12 text-[#4e6b51]",
  in_person: "bg-[#d4a574]/12 text-[#96604a]",
};

export function NotesTab({
  profileId,
  initialNotes,
}: {
  profileId: string;
  initialNotes: ClientNoteRow[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [noteType, setNoteType] = useState<"note" | "call" | "email" | "sms" | "in_person">("note");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  function refreshNotes() {
    startTransition(async () => {
      const updated = await getClientNotes(profileId, {
        type: filterType !== "all" ? filterType : undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      });
      setNotes(updated);
    });
  }

  function handleSubmit() {
    if (!content.trim()) return;
    startTransition(async () => {
      const result = await createClientNote({
        profileId,
        type: noteType,
        content: content.trim(),
        isPinned: pinned,
      });
      if (result.success) {
        setContent("");
        setPinned(false);
        setShowForm(false);
        refreshNotes();
      }
    });
  }

  function handleTogglePin(noteId: number, currentlyPinned: boolean) {
    startTransition(async () => {
      await updateClientNote(noteId, { isPinned: !currentlyPinned });
      refreshNotes();
    });
  }

  function handleDelete(noteId: number) {
    startTransition(async () => {
      await deleteClientNote(noteId);
      refreshNotes();
    });
  }

  const filteredNotes = notes;

  function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters + Add button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              startTransition(async () => {
                const updated = await getClientNotes(profileId, {
                  type: e.target.value !== "all" ? e.target.value : undefined,
                  startDate: filterStartDate || undefined,
                  endDate: filterEndDate || undefined,
                });
                setNotes(updated);
              });
            }}
            className="px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground"
          >
            <option value="all">All types</option>
            {NOTE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => {
              setFilterStartDate(e.target.value);
              startTransition(async () => {
                const updated = await getClientNotes(profileId, {
                  type: filterType !== "all" ? filterType : undefined,
                  startDate: e.target.value || undefined,
                  endDate: filterEndDate || undefined,
                });
                setNotes(updated);
              });
            }}
            className="px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground"
            placeholder="From"
          />
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => {
              setFilterEndDate(e.target.value);
              startTransition(async () => {
                const updated = await getClientNotes(profileId, {
                  type: filterType !== "all" ? filterType : undefined,
                  startDate: filterStartDate || undefined,
                  endDate: e.target.value || undefined,
                });
                setNotes(updated);
              });
            }}
            className="px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground"
            placeholder="To"
          />
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Note
        </button>
      </div>

      {/* Add note form */}
      {showForm && (
        <Card className="gap-0">
          <CardContent className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              {NOTE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setNoteType(t.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    noteType === t.value
                      ? "bg-foreground text-background"
                      : "bg-surface text-muted hover:text-foreground",
                  )}
                >
                  <t.icon className="w-3 h-3" />
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a note..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition resize-none"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="rounded border-border"
                />
                <Pin className="w-3 h-3" />
                Pin to profile
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!content.trim() || isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Note"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes list */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Communication History</CardTitle>
          <p className="text-xs text-muted mt-0.5">
            {filteredNotes.length} note{filteredNotes.length !== 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-3">
          {filteredNotes.length === 0 ? (
            <div className="py-10 text-center">
              <StickyNote className="w-7 h-7 text-foreground/15 mx-auto mb-2" />
              <p className="text-sm text-muted">No notes yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredNotes.map((note) => {
                const Icon = TYPE_ICONS[note.type] ?? StickyNote;
                return (
                  <div
                    key={note.id}
                    className={cn(
                      "px-5 py-3 hover:bg-surface/60 transition-colors",
                      note.isPinned && "bg-[#7a5c10]/5",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center",
                            TYPE_COLORS[note.type] ?? "bg-surface",
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            className={cn("text-[9px] px-1.5 py-0 border", TYPE_COLORS[note.type])}
                          >
                            {note.type === "in_person"
                              ? "In Person"
                              : note.type.charAt(0).toUpperCase() + note.type.slice(1)}
                          </Badge>
                          {note.isPinned && <Pin className="w-3 h-3 text-[#7a5c10]" />}
                          <span className="text-[10px] text-muted ml-auto">
                            {note.authorName} · {fmtDate(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {note.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleTogglePin(note.id, note.isPinned)}
                          className="p-1 text-muted hover:text-foreground transition-colors"
                          title={note.isPinned ? "Unpin" : "Pin"}
                        >
                          {note.isPinned ? (
                            <PinOff className="w-3.5 h-3.5" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-1 text-muted hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
