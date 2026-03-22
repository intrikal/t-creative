/**
 * Square SDK integration — barrel export.
 *
 * All consumers import from `@/lib/square` which resolves to this index.
 * Internal modules are split by Square API domain.
 *
 * @module lib/square
 */

// Client singleton + config
export {
  squareClient,
  isSquareConfigured,
  SQUARE_LOCATION_ID,
  SQUARE_WEBHOOK_SIGNATURE_KEY,
} from "./client";

// Orders API
export { createSquareOrder } from "./orders";

// Checkout API — Payment Links
export { createSquarePaymentLink, createSquareOrderPaymentLink } from "./checkout";

// Payments API
export { createSquarePayment, chargeCardOnFile } from "./payments";

// Customers API
export { getSquareCardOnFile, createSquareCustomer, linkSquareCustomer } from "./customers";

// Invoices API
export { createSquareInvoice } from "./invoices";

// Subscriptions API
export {
  createSquareSubscriptionPlan,
  createSquareSubscription,
  cancelSquareSubscription,
  pauseSquareSubscription,
  resumeSquareSubscription,
  getSquareSubscriptionStatus,
} from "./subscriptions";

// Gift Cards API
export {
  createSquareGiftCard,
  getSquareGiftCardBalance,
  redeemSquareGiftCard,
  linkGiftCardToCustomer,
} from "./gift-cards";

// Catalog API
export { upsertCatalogItem, syncCatalogFromSquare } from "./catalog";
