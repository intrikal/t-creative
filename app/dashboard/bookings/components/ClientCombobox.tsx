"use client";

/**
 * ClientCombobox — Searchable client picker for the booking dialog.
 *
 * Replaces the plain <select> that loaded all clients upfront. Instead it
 * queries searchClients() server action on each keystroke (debounced 250ms)
 * so only a relevant subset is fetched. A selected client's name is always
 * shown even if it falls outside the current search results.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { searchClients } from "../select-actions";

type ClientOption = {
  id: string;
  name: string;
  phone: string | null;
  preferredRebookIntervalDays: number | null;
};

export function ClientCombobox({
  value,
  onChange,
  selectedName,
}: {
  value: string;
  onChange: (clientId: string, client: ClientOption | null) => void;
  /** Display name of the currently selected client (so it shows while query is blank). */
  selectedName?: string;
}) {
  const [query, setQuery] = useState(selectedName ?? "");
  const [results, setResults] = useState<ClientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync display value when a selected client changes externally (e.g. edit mode prefill)
  useEffect(() => {
    if (selectedName !== undefined) setQuery(selectedName);
  }, [selectedName]);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchClients(q)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);

    // Clear selection when user edits the field
    if (value) onChange("", null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 250);
  }

  function handleSelect(client: ClientOption) {
    setQuery(client.name);
    setOpen(false);
    setResults([]);
    onChange(client.id, client);
  }

  function handleBlur(e: React.FocusEvent) {
    // Close dropdown only if focus leaves the entire container
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
      // If nothing was selected and query doesn't match current value, clear it
      if (!value) setQuery("");
    }
  }

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <input
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && results.length > 0}
        aria-label="Search client"
        autoComplete="off"
        value={query}
        onChange={handleInput}
        onFocus={() => {
          if (query.trim()) {
            setOpen(true);
            runSearch(query);
          }
        }}
        placeholder="Type a name or email…"
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#96604a]/30 focus:border-[#96604a]"
      />

      {open && (loading || results.length > 0) && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-lg max-h-52 overflow-y-auto"
        >
          {loading && (
            <li className="px-3 py-2 text-xs text-stone-400">Searching…</li>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <li className="px-3 py-2 text-xs text-stone-400">No clients found</li>
          )}
          {results.map((c) => (
            <li
              key={c.id}
              role="option"
              aria-selected={c.id === value}
              onMouseDown={(e) => {
                // Prevent blur from firing before click
                e.preventDefault();
                handleSelect(c);
              }}
              className="flex flex-col px-3 py-2 text-sm cursor-pointer hover:bg-stone-50 aria-selected:bg-[#faf6f1]"
            >
              <span className="font-medium text-stone-900">{c.name}</span>
              {c.phone && (
                <span className="text-xs text-stone-400">{c.phone}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
