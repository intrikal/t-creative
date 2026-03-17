"use client";

import { useState } from "react";
import type { PromotionRow } from "../actions";
import { FinancialModals } from "../components/FinancialModals";
import { PromotionsTab } from "../components/PromotionsTab";

export function PromotionsContent({ promotions }: { promotions: PromotionRow[] }) {
  const [modal, setModal] = useState<"promo" | null>(null);

  return (
    <>
      <PromotionsTab promotions={promotions} onNewPromo={() => setModal("promo")} />
      <FinancialModals modal={modal} onClose={() => setModal(null)} />
    </>
  );
}
