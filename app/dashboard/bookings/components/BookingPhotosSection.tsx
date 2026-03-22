"use client";

import { useState, useRef, useEffect } from "react";
import { ImagePlus, Trash2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientPhoto } from "../client-photo-actions";
import { getBookingPhotos, deleteClientPhoto } from "../client-photo-actions";

const PHOTO_TYPES = ["before", "after", "reference"] as const;

export function BookingPhotosSection({
  bookingId,
  clientId,
}: {
  bookingId: number;
  clientId: string;
}) {
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<(typeof PHOTO_TYPES)[number]>("before");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getBookingPhotos(bookingId).then(setPhotos);
  }, [bookingId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("bookingId", String(bookingId));
        fd.append("profileId", clientId);
        fd.append("photoType", selectedType);

        const res = await fetch("/api/upload-client-photo", { method: "POST", body: fd });
        if (!res.ok) continue;

        const { id, url } = (await res.json()) as { id: number; url: string };
        setPhotos((prev) => [
          {
            id,
            bookingId,
            photoType: selectedType,
            url,
            notes: null,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(photoId: number) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    await deleteClientPhoto(photoId);
  }

  const grouped = {
    before: photos.filter((p) => p.photoType === "before"),
    after: photos.filter((p) => p.photoType === "after"),
    reference: photos.filter((p) => p.photoType === "reference"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Client Photos</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as typeof selectedType)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
          >
            <option value="before">Before</option>
            <option value="after">After</option>
            <option value="reference">Reference</option>
          </select>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
              uploading
                ? "bg-muted text-muted-foreground cursor-wait"
                : "bg-accent text-white hover:bg-accent/90",
            )}
          >
            <ImagePlus className="w-3.5 h-3.5" />
            {uploading ? "Uploading..." : "Add Photo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="py-6 text-center border border-dashed border-border rounded-xl">
          <Camera className="w-6 h-6 text-muted mx-auto mb-2" />
          <p className="text-xs text-muted">
            No photos yet. Add before, after, or reference photos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(["before", "after", "reference"] as const).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            return (
              <div key={type}>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted mb-1.5">
                  {type}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={`${type} photo`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleDelete(photo.id)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
