import type { Metadata } from "next";
import { ResetPasswordPage } from "./ResetPasswordPage";

export const metadata: Metadata = {
  title: "Set New Password | T Creative Studio",
  description: "Choose a new password for your account.",
};

export default function Page() {
  return <ResetPasswordPage />;
}
