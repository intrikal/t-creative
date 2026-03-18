import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getClientGallery } from "./actions";
import { ClientGalleryPage } from "./GalleryPage";

export const metadata: Metadata = {
  title: "Gallery — T Creative Studio",
  description: "View your personal gallery of past sessions and artwork.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard/media");

  const data = await getClientGallery();
  return <ClientGalleryPage data={data} />;
}
