/**
 * Financial dashboard shell — header, stat cards, charts, tab bar + active tab.
 *
 * All tabs are DB-wired via props from `page.tsx`:
 * - Stat cards, daily bar chart, category breakdown, transactions
 * - Invoices, expenses, gift cards, promotions
 *
 * Each tab is extracted into its own component under `./components/`.
 *
 * @module financial/FinancialPage
 * @see {@link ./actions.ts} — server actions providing props
 * @see {@link ./page.tsx} — Server Component data fetcher
 */
"use client";

import { useState } from "react";
import { TrendingUp, DollarSign, CreditCard, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  PaymentRow,
  RevenueStats,
  CategoryRevenue,
  DailyRevenue,
  InvoiceRow,
  ExpenseRow,
  GiftCardRow,
  PromotionRow,
  ProfitLossRow,
  TaxEstimate,
  ProductSalesStats,
  DepositStats,
  TipStats,
  ExpenseCategoryBreakdown,
} from "./actions";
import { DepositTrackingSection } from "./components/DepositTrackingSection";
import { ExpenseCategoriesSection } from "./components/ExpenseCategoriesSection";
import { ExpensesTab } from "./components/ExpensesTab";
import { FinancialModals } from "./components/FinancialModals";
import { GiftCardsTab } from "./components/GiftCardsTab";
import { InvoicesTab } from "./components/InvoicesTab";
import { PaymentLinkDialog } from "./components/PaymentLinkDialog";
import { ProductSalesSection } from "./components/ProductSalesSection";
import { ProfitLossSection } from "./components/ProfitLossSection";
import { PromotionsTab } from "./components/PromotionsTab";
import { RecordPaymentDialog } from "./components/RecordPaymentDialog";
import { RefundDialog } from "./components/RefundDialog";
import { TipTrendsSection } from "./components/TipTrendsSection";
import { TransactionsTab } from "./components/TransactionsTab";
import type { BookingForPayment } from "./payment-actions";

/** Color for each category bar in the revenue breakdown chart. */
const CATEGORY_COLORS: Record<string, string> = {
  "Lash Services": "bg-[#c4907a]",
  Jewelry: "bg-[#d4a574]",
  Consulting: "bg-[#5b8a8a]",
  Crochet: "bg-[#7ba3a3]",
};

const FINANCIAL_TABS = [
  "Transactions",
  "Invoices",
  "Expenses",
  "Gift Cards",
  "Promotions",
] as const;
type FinancialTab = (typeof FINANCIAL_TABS)[number];

export function FinancialPage({
  payments,
  stats,
  categoryRevenue,
  weeklyRevenue,
  invoices,
  expenses,
  giftCards,
  promotions,
  profitLoss,
  taxEstimate,
  productSales,
  depositStats,
  tipTrends,
  expenseCategories,
  bookingsForPayment,
}: {
  payments: PaymentRow[];
  stats: RevenueStats;
  categoryRevenue: CategoryRevenue[];
  weeklyRevenue: DailyRevenue[];
  invoices: InvoiceRow[];
  expenses: ExpenseRow[];
  giftCards: GiftCardRow[];
  promotions: PromotionRow[];
  profitLoss: ProfitLossRow[];
  taxEstimate: TaxEstimate;
  productSales: ProductSalesStats;
  depositStats: DepositStats;
  tipTrends: TipStats;
  expenseCategories: ExpenseCategoryBreakdown[];
  bookingsForPayment: BookingForPayment[];
}) {
  const [range, setRange] = useState("7d");
  const [tab, setTab] = useState<FinancialTab>("Transactions");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [modal, setModal] = useState<"invoice" | "expense" | "giftcard" | "promo" | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentLinkBooking, setPaymentLinkBooking] = useState<BookingForPayment | null>(null);
  const [refundPayment, setRefundPayment] = useState<PaymentRow | null>(null);

  const maxBar = Math.max(...weeklyRevenue.map((b) => b.amount), 1);
  const gridLines = [2000, 1500, 1000, 500].filter((g) => g <= maxBar * 1.1);
  const totalWeek = weeklyRevenue.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Financial</h1>
          <p className="text-sm text-muted mt-0.5">Payments, transactions, and earnings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (bookingsForPayment.length > 0) setPaymentLinkBooking(bookingsForPayment[0]);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface text-foreground border border-border hover:bg-foreground/5 transition-colors"
          >
            Send Payment Link
          </button>
          <button
            onClick={() => setPaymentDialogOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Record Payment
          </button>
          <div className="flex gap-1">
            {["7d", "30d", "90d"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  range === r
                    ? "bg-foreground text-background"
                    : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Total Revenue
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.totalRevenue.toLocaleString()}
            </p>
            {stats.revenueVsPriorPeriodPct !== null ? (
              <p
                className={cn(
                  "text-xs mt-1 flex items-center gap-0.5",
                  stats.revenueVsPriorPeriodPct >= 0 ? "text-[#4e6b51]" : "text-destructive",
                )}
              >
                {stats.revenueVsPriorPeriodPct >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(stats.revenueVsPriorPeriodPct)}% vs prior month
              </p>
            ) : (
              <p className="text-xs text-muted mt-1">No prior data</p>
            )}
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                This Week
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">${totalWeek.toLocaleString()}</p>
            <p className="text-xs text-muted mt-1">7-day rolling</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Tips</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.totalTips.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">gratuity collected</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Avg Ticket
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.avgTicket.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">per transaction</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Est. Tax ({taxEstimate.quarterLabel})
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${taxEstimate.estimatedTax.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">
              {taxEstimate.taxRate}% of ${taxEstimate.netIncome.toLocaleString()} net
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Bar chart */}
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Daily Revenue — This Week</CardTitle>
              <span className="text-xs text-muted">${totalWeek.toLocaleString()} total</span>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            <div className="relative h-44">
              {gridLines.map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${(line / maxBar) * 100}%` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-10 text-right shrink-0">
                    ${(line / 1000).toFixed(1)}k
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
              <div className="absolute inset-0 pl-12 flex items-end gap-2">
                {weeklyRevenue.map((bar, i) => (
                  <div
                    key={bar.day}
                    className="relative flex-1 flex flex-col items-center justify-end h-full"
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {hoveredBar === i && (
                      <div className="absolute bottom-full mb-1.5 z-10 pointer-events-none">
                        <div className="bg-foreground text-background text-[10px] font-semibold rounded-md px-2 py-1 whitespace-nowrap shadow-sm">
                          ${bar.amount.toLocaleString()}
                        </div>
                        <div className="w-1.5 h-1.5 bg-foreground rotate-45 mx-auto -mt-1" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "w-full rounded-t transition-all cursor-default",
                        i === 4 ? "bg-[#c4907a]" : "bg-[#e8c4b8]",
                        hoveredBar === i && "brightness-90",
                      )}
                      style={{ height: `${(bar.amount / maxBar) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pl-12 mt-1.5">
              {weeklyRevenue.map((bar) => (
                <div key={bar.day} className="flex-1 text-center">
                  <span className="text-[10px] text-muted">{bar.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3 space-y-3.5">
            {categoryRevenue.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-foreground">{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">{cat.pct}%</span>
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      ${cat.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      CATEGORY_COLORS[cat.category] ?? "bg-[#8fa89c]",
                    )}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Product vs Service Revenue */}
      <ProductSalesSection productSales={productSales} totalRevenue={stats.totalRevenue} />

      {/* Tip Trends */}
      <TipTrendsSection data={tipTrends} />

      {/* Profit & Loss + Expense Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProfitLossSection data={profitLoss} />
        <ExpenseCategoriesSection data={expenseCategories} />
      </div>

      {/* Deposit Collection */}
      <DepositTrackingSection data={depositStats} />

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {FINANCIAL_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      {tab === "Transactions" && (
        <TransactionsTab payments={payments} onRefund={setRefundPayment} />
      )}
      {tab === "Invoices" && (
        <InvoicesTab invoices={invoices} onNewInvoice={() => setModal("invoice")} />
      )}
      {tab === "Expenses" && (
        <ExpensesTab expenses={expenses} onLogExpense={() => setModal("expense")} />
      )}
      {tab === "Gift Cards" && (
        <GiftCardsTab giftCards={giftCards} onIssueGiftCard={() => setModal("giftcard")} />
      )}
      {tab === "Promotions" && (
        <PromotionsTab promotions={promotions} onNewPromo={() => setModal("promo")} />
      )}

      {/* Modals */}
      <FinancialModals modal={modal} onClose={() => setModal(null)} />
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        bookings={bookingsForPayment}
      />
      <RefundDialog
        open={!!refundPayment}
        onClose={() => setRefundPayment(null)}
        payment={refundPayment}
      />
      <PaymentLinkDialog
        open={!!paymentLinkBooking}
        onClose={() => setPaymentLinkBooking(null)}
        booking={paymentLinkBooking}
      />
    </div>
  );
}
