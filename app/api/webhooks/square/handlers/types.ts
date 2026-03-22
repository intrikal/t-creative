/**
 * Shared types for Square webhook handlers.
 * @module api/webhooks/square/handlers/types
 */
import type { Payment, Tender } from "square";

/** Square tender type → our payment method enum. */
export type PaymentMethod =
  | "square_card"
  | "square_cash"
  | "square_wallet"
  | "square_gift_card"
  | "square_other";

export function mapTenderType(tenderType?: string): PaymentMethod {
  switch (tenderType) {
    case "CARD":
      return "square_card";
    case "CASH":
      return "square_cash";
    case "WALLET":
      return "square_wallet";
    case "SQUARE_GIFT_CARD":
      return "square_gift_card";
    default:
      return "square_other";
  }
}

/**
 * Square webhook payments may include fields not present in the SDK's Payment type:
 * - `tenders`: Terminal payments still populate it for payment method detection.
 * - `taxMoney`: Sales tax collected. Tax calculation is handled by Square, not this app.
 */
export interface SquareWebhookPayment extends Payment {
  tenders?: Tender[];
  taxMoney?: { amount?: bigint; currency?: string };
}
