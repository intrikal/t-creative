import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Catalog — T Creative Studio",
  description: "Manage your services and marketplace products.",
  robots: { index: false, follow: false },
};

/**
 * Catalog — combined entry point for Services and Marketplace.
 * Temporarily redirects to /dashboard/services until the unified
 * catalog page is built.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  redirect("/dashboard/services");
}
