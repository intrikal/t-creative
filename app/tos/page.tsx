import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | T Creative Studio",
  description:
    "Terms of Service for T Creative Studio. Read our booking policies, service terms, and client agreement.",
  robots: { index: false, follow: false },
};

export default function TosRedirect() {
  redirect("/terms");
}
