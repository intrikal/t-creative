import type { Metadata } from "next";
import { AuthErrorPage } from "./AuthErrorPage";

export const metadata: Metadata = {
  title: "Error | T Creative Studio",
  description: "An error occurred during authentication.",
};

export default function Page() {
  return <AuthErrorPage />;
}
