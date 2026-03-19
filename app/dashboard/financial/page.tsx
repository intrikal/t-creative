import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
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

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

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
