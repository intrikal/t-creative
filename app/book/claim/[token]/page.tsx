/**
 * /book/claim/[token] — Waitlist slot claim page (server component).
 *
 * Validates the token server-side, then passes the slot data to the
 * interactive <ClaimUI> client component for the confirmation button.
 */

import type { Metadata } from "next";
import { getClaimPageData } from "./actions";
import { ClaimUI } from "./ClaimUI";

export const metadata: Metadata = { title: "Claim Your Spot — T Creative Studio" };

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ClaimPage({ params }: Props) {
  const { token } = await params;
  const data = await getClaimPageData(token);

  return <ClaimUI token={token} data={data} />;
}
