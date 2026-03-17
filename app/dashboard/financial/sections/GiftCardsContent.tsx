"use client";

import { useState } from "react";
import type { GiftCardRow } from "../actions";
import { FinancialModals } from "../components/FinancialModals";
import { GiftCardsTab } from "../components/GiftCardsTab";

export function GiftCardsContent({ giftCards }: { giftCards: GiftCardRow[] }) {
  const [modal, setModal] = useState<"giftcard" | null>(null);

  return (
    <>
      <GiftCardsTab giftCards={giftCards} onIssueGiftCard={() => setModal("giftcard")} />
      <FinancialModals modal={modal} onClose={() => setModal(null)} />
    </>
  );
}
