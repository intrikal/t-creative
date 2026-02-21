import type { Metadata } from "next";
import { SignedOutPage } from "./SignedOutPage";

export const metadata: Metadata = {
  title: "Signed Out | T Creative Studio",
  description: "You have been signed out of your account.",
};

export default function Page() {
  return <SignedOutPage />;
}
