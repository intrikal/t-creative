"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BookingPhotoGroup } from "../bookings/client-photo-actions";
import type { ClientGalleryData } from "../gallery/actions";
import { ClientGalleryPage } from "../gallery/GalleryPage";
import { MyPhotosPage } from "./MyPhotosPage";

type Tab = "my-photos" | "gallery";

export function PhotosAndGalleryPage({
  groups,
  galleryData,
}: {
  groups: BookingPhotoGroup[];
  galleryData: ClientGalleryData;
}) {
  const [tab, setTab] = useState<Tab>("my-photos");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          Photos
        </h1>
        <p className="text-sm text-muted mt-0.5">Your photos and studio gallery</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            {
              key: "my-photos",
              label: `My Photos (${groups.reduce((n, g) => n + g.photos.length, 0)})`,
            },
            { key: "gallery", label: `Studio Gallery (${galleryData.portfolio.length})` },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "my-photos" && <MyPhotosPage groups={groups} embedded />}
      {tab === "gallery" && <ClientGalleryPage data={galleryData} embedded />}
    </div>
  );
}
