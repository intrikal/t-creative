import type { Metadata } from "next";
import { SuspendedPage } from "./SuspendedPage";

export const metadata: Metadata = {
  title: "Account Suspended | T Creative Studio",
  description: "Your account has been suspended.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SuspendedPage />;
}
