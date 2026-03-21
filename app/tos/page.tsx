import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Terms of Service | T Creative Studio",
  description:
    "Terms of Service for T Creative Studio. Read our booking policies, service terms, and client agreement.",
};

export default function TosRedirect() {
  redirect("/terms");
}
