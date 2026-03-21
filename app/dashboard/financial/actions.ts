/**
 * app/dashboard/financial/actions.ts — Barrel re-export for financial actions.
 *
 * All financial functions have been split into domain-specific modules.
 * This file re-exports everything for backward compatibility so that
 * existing imports like `import { getPayments } from "./actions"` still work.
 *
 * No queries live here — see the individual sub-modules for SQL-level docs:
 *   - payment-queries.ts          — payments list, revenue stats, category revenue,
 *                                    weekly revenue, deposits, tips, product sales,
 *                                    tax estimates, P&L, expense breakdowns
 *   - invoice-expense-actions.ts  — invoice CRUD, expense CRUD
 *   - promo-gift-actions.ts       — gift card CRUD, promotion CRUD, redemption, validation
 *
 * @module financial/actions
 * @see {@link ./FinancialPage.tsx} — client component consuming this data
 */
// Payment & revenue queries
export type {
  PaymentRow,
  RevenueStats,
  ProfitLossRow,
  TaxEstimate,
  CategoryRevenue,
  DailyRevenue,
  ProductSalesStats,
  PendingDeposit,
  DepositStats,
  TipTrendItem,
  TipStats,
  ExpenseCategoryBreakdown,
  ExpenseStats,
  MonthlyExpense,
} from "./payment-queries";
export {
  getPayments,
  getRevenueStats,
  getCategoryRevenue,
  getWeeklyRevenue,
  getDepositStats,
  getTipTrends,
  getProductSales,
  getTaxEstimate,
  getProfitLoss,
  getExpenseCategoryBreakdown,
  getExpenseStats,
  getMonthlyExpenses,
} from "./payment-queries";

// Invoice & expense actions
export type { InvoiceRow, ExpenseRow } from "./invoice-expense-actions";
export { getInvoices, createInvoice, getExpenses, createExpense } from "./invoice-expense-actions";

// Gift card & promotion actions
export type { GiftCardRow, PromotionRow, GiftCardTxRow } from "./promo-gift-actions";
export {
  getGiftCards,
  createGiftCard,
  getPromotions,
  createPromotion,
  redeemGiftCard,
  getGiftCardHistory,
  recordRedemption,
  validatePromoCode,
  applyPromoCode,
} from "./promo-gift-actions";
