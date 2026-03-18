/**
 * Cadence ↔ RRULE mapping — shared between client booking form,
 * admin dashboard, and backend actions.
 *
 * Human-readable labels ("Every 3 weeks") map to iCal RRULE strings
 * ("FREQ=WEEKLY;INTERVAL=3") used by the recurring-booking engine.
 *
 * @module lib/cadence
 */

export const CADENCE_OPTIONS = [
  { value: "", label: "Does not repeat", rrule: "" },
  { value: "FREQ=WEEKLY;INTERVAL=1", label: "Every week", rrule: "FREQ=WEEKLY;INTERVAL=1" },
  { value: "FREQ=WEEKLY;INTERVAL=2", label: "Every 2 weeks", rrule: "FREQ=WEEKLY;INTERVAL=2" },
  { value: "FREQ=WEEKLY;INTERVAL=3", label: "Every 3 weeks", rrule: "FREQ=WEEKLY;INTERVAL=3" },
  { value: "FREQ=MONTHLY;INTERVAL=1", label: "Every month", rrule: "FREQ=MONTHLY;INTERVAL=1" },
  { value: "FREQ=WEEKLY;INTERVAL=6", label: "Every 6 weeks", rrule: "FREQ=WEEKLY;INTERVAL=6" },
  { value: "FREQ=WEEKLY;INTERVAL=8", label: "Every 8 weeks", rrule: "FREQ=WEEKLY;INTERVAL=8" },
] as const;

/** Map a human-readable cadence label to an RRULE string. Returns "" if not found. */
export function cadenceLabelToRRule(label: string): string {
  return CADENCE_OPTIONS.find((o) => o.label === label)?.rrule ?? "";
}

/** Map an RRULE string to a human-readable label. Returns the RRULE itself if not found. */
export function rruleToCadenceLabel(rrule: string): string {
  if (!rrule) return "";
  return CADENCE_OPTIONS.find((o) => o.rrule === rrule)?.label ?? rrule;
}
