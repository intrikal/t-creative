import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getMyPhotos } from "../bookings/client-photo-actions";
import { MyPhotosPage } from "./MyPhotosPage";

export const metadata: Metadata = {
  title: "My Photos — T Creative Studio",
  description: "View your before, after, and reference photos from past appointments.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard");

  const groups = await getMyPhotos();
  return <MyPhotosPage groups={groups} />;
}
