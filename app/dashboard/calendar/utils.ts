import type { CalEvent } from "./components/types";

export function groupEventsByDate(events: CalEvent[]): Record<string, CalEvent[]> {
  const map: Record<string, CalEvent[]> = {};
  for (const ev of events) {
    if (!map[ev.date]) map[ev.date] = [];
    map[ev.date].push(ev);
  }
  return map;
}
