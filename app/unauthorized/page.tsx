import type { Metadata } from "next";
import { UnauthorizedPage } from "./UnauthorizedPage";

export const metadata: Metadata = {
  title: "Unauthorized | T Creative Studio",
  description: "You don't have permission to access this page.",
};

export default function Page() {
  return <UnauthorizedPage />;
}
