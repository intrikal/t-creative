/**
 * Financial dashboard route — `/dashboard/financial`.
 *
 * Server Component that fetches eight datasets in parallel from `payments`,
 * `invoices`, `expenses`, `gift_cards`, and `promotions` tables (via
 * `./actions.ts`) and passes them as serialised props to the
 * `<FinancialPage>` Client Component.
 *
 * @module financial/page
 * @see {@link ./actions.ts} — server actions
 * @see {@link ./FinancialPage.tsx} — client component
 */

import {
  getPayments,
  getRevenueStats,
  getCategoryRevenue,
  getWeeklyRevenue,
  getInvoices,
  getExpenses,
  getGiftCards,
  getPromotions,
  getProfitLoss,
  getTaxEstimate,
  getProductSales,
  getDepositStats,
  getTipTrends,
  getExpenseCategoryBreakdown,
} from "./actions";
import { FinancialPage } from "./FinancialPage";
import { getBookingsForPayment } from "./payment-actions";

export default async function Page() {
  // Batch queries to avoid exhausting the Supabase connection pool
  const [payments, stats, categoryRevenue, weeklyRevenue, invoices] = await Promise.all([
    getPayments(),
    getRevenueStats(),
    getCategoryRevenue(),
    getWeeklyRevenue(),
    getInvoices(),
  ]);

  const [expenses, giftCards, promotions, profitLoss, taxEstimate] = await Promise.all([
    getExpenses(),
    getGiftCards(),
    getPromotions(),
    getProfitLoss(),
    getTaxEstimate(),
  ]);

  const [productSales, depositStats, tipTrends, expenseCategories, bookingsForPayment] =
    await Promise.all([
      getProductSales(),
      getDepositStats(),
      getTipTrends(),
      getExpenseCategoryBreakdown(),
      getBookingsForPayment(),
    ]);

  return (
    <FinancialPage
      payments={payments}
      stats={stats}
      categoryRevenue={categoryRevenue}
      weeklyRevenue={weeklyRevenue}
      invoices={invoices}
      expenses={expenses}
      giftCards={giftCards}
      promotions={promotions}
      profitLoss={profitLoss}
      taxEstimate={taxEstimate}
      productSales={productSales}
      depositStats={depositStats}
      tipTrends={tipTrends}
      expenseCategories={expenseCategories}
      bookingsForPayment={bookingsForPayment}
    />
  );
}
