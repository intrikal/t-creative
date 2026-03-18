import type { Metadata } from "next";
import { FinancialShell } from "./FinancialShell";
import { ExpensesSection } from "./sections/ExpensesSection";
import { GiftCardsSection } from "./sections/GiftCardsSection";
import { InvoicesSection } from "./sections/InvoicesSection";
import { OverviewSection } from "./sections/OverviewSection";
import { PromotionsSection } from "./sections/PromotionsSection";
import { TransactionsSection } from "./sections/TransactionsSection";

export const metadata: Metadata = {
  title: "Financial — T Creative Studio",
  description: "Overview of studio finances including revenue, expenses, and transactions.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <FinancialShell
      overview={<OverviewSection />}
      transactions={<TransactionsSection />}
      invoices={<InvoicesSection />}
      expenses={<ExpensesSection />}
      giftCards={<GiftCardsSection />}
      promotions={<PromotionsSection />}
    />
  );
}
