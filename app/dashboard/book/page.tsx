import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ClientBookPage } from "./BookPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard");

  return <ClientBookPage />;
}
