import { FinancialShell } from "./FinancialShell";
import { ExpensesSection } from "./sections/ExpensesSection";
import { GiftCardsSection } from "./sections/GiftCardsSection";
import { InvoicesSection } from "./sections/InvoicesSection";
import { OverviewSection } from "./sections/OverviewSection";
import { PromotionsSection } from "./sections/PromotionsSection";
import { TransactionsSection } from "./sections/TransactionsSection";

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
