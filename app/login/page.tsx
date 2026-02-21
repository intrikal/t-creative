import type { Metadata } from "next";
import { LoginPage } from "./LoginPage";

export const metadata: Metadata = {
  title: "Sign In | T Creative Studio",
  description: "Sign in to your T Creative Studio account.",
  alternates: { canonical: "/login" },
};

export default function Page() {
  return <LoginPage />;
}
