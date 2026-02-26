/** Shared currency formatting for email templates. */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
