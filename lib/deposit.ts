/**
 * lib/deposit.ts — Combo deposit calculation for multi-service bookings.
 *
 * Three modes (configured via `booking_settings.comboDepositType`):
 * - **sum**: Sum of all individual service deposits.
 * - **highest**: Only the highest individual deposit is charged.
 * - **fixed**: A single flat amount configured by the admin.
 *
 * For single-service bookings, all modes return the service's deposit.
 */

export type ComboDepositType = "sum" | "fixed" | "highest";

/**
 * Calculate the deposit for a multi-service booking.
 *
 * @param services - Array of services with their snapshotted depositInCents
 * @param comboDepositType - Admin-configured mode
 * @param fixedAmountInCents - Used only when mode is "fixed"
 */
export function calculateComboDeposit(
  services: { depositInCents: number }[],
  comboDepositType: ComboDepositType,
  fixedAmountInCents: number = 5000,
): number {
  if (services.length === 0) return 0;
  if (services.length === 1) return services[0].depositInCents;

  switch (comboDepositType) {
    case "sum":
      return services.reduce((sum, s) => sum + s.depositInCents, 0);
    case "fixed":
      return fixedAmountInCents;
    case "highest":
      return Math.max(...services.map((s) => s.depositInCents));
  }
}
