/**
 * /book/claim/[token] — Waitlist slot claim page (server component).
 *
 * Validates the token server-side, then passes the slot data to the
 * interactive <ClaimUI> client component for the confirmation button.
 */

import type { Metadata } from "next";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { getClaimPageData } from "./actions";
import { ClaimUI } from "./ClaimUI";

export const metadata: Metadata = {
  title: "Claim Your Spot",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ClaimPage({ params }: Props) {
  const { token } = await params;
  const [data, business] = await Promise.all([getClaimPageData(token), getPublicBusinessProfile()]);

  return (
    <ClaimUI
      token={token}
      data={data}
      businessName={business.businessName}
      email={business.email}
    />
  );
}
