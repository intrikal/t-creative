import type { Metadata } from "next";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

export const metadata: Metadata = {
  title: "Reset Password | T Creative Studio",
  description: "Request a password reset link for your account.",
};

export default function Page() {
  return <ForgotPasswordPage />;
}
