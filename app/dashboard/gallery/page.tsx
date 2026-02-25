import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientGallery } from "./actions";
import { ClientGalleryPage } from "./GalleryPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard/media");

  const data = await getClientGallery();
  return <ClientGalleryPage data={data} />;
}
