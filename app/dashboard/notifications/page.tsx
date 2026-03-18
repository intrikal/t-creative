import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getInboxPage } from "../notification-inbox";
import { NotificationsPage } from "./NotificationsPage";

export const metadata: Metadata = {
  title: "Notifications — T Creative Studio",
  description: "View your studio notifications and inbox.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));
  const type = params.type;

  const data = await getInboxPage({ page, pageSize: 20, type });
  return <NotificationsPage initialData={data} initialType={type} />;
}
