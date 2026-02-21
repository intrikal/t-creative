import type { Metadata } from "next";
import { RevenuePage } from "./RevenuePage";

export const metadata: Metadata = {
  title: "Revenue — T Creative Studio",
  description: "Revenue analytics and payment history.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RevenuePage />;
}
