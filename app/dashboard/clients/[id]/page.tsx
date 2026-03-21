import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getClientDetail } from "./actions";
import { ClientDetailPage } from "./ClientDetailPage";

export const metadata: Metadata = {
  title: "Client Detail — T Creative Studio",
  description: "View client history and details.",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role === "client") redirect("/dashboard");

  const { id } = await params;
  const data = await getClientDetail(id);
  if (!data) notFound();

  return <ClientDetailPage data={data} />;
}
