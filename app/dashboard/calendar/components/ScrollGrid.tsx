/**
 * @file ScrollGrid.tsx
 * @description Scrollable wrapper for the time-grid body in week/day/staff views.
 */

export function ScrollGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-auto">{children}</div>;
}
