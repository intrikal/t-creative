import type { Metadata } from "next";
import { GiftCardPurchasePage } from "./GiftCardPurchasePage";

export const metadata: Metadata = {
  title: "Gift Cards — T Creative Studio",
  description:
    "Give the gift of lash extensions, permanent jewelry, crochet, or consulting. Gift cards valid for any service or product at T Creative Studio.",
};

export default function Page() {
  return <GiftCardPurchasePage />;
}
