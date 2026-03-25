import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getMyPhotos } from "../bookings/client-photo-actions";
import { getClientGallery } from "../gallery/actions";
import { PhotosAndGalleryPage } from "./PhotosAndGalleryPage";

export const metadata: Metadata = {
  title: "Photos & Gallery — T Creative Studio",
  description: "View your photos and browse the studio gallery.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard");

  const [groups, galleryData] = await Promise.all([getMyPhotos(), getClientGallery()]);
  return <PhotosAndGalleryPage groups={groups} galleryData={galleryData} />;
}
