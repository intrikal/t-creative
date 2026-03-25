"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, X, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BookingPhotoGroup, ClientPhoto } from "../bookings/client-photo-actions";

const TYPE_LABEL: Record<string, string> = {
  before: "Before",
  after: "After",
  reference: "Reference",
};

const TYPE_COLOR: Record<string, string> = {
  before: "bg-amber-50 text-amber-700",
  after: "bg-emerald-50 text-emerald-700",
  reference: "bg-blue-50 text-blue-700",
};

export function MyPhotosPage({
  groups,
  embedded,
}: {
  groups: BookingPhotoGroup[];
  embedded?: boolean;
}) {
  const [lightbox, setLightbox] = useState<ClientPhoto | null>(null);

  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            My Photos
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Before, after, and reference photos from your appointments.
          </p>
        </div>
      )}

      {groups.length === 0 ? (
        <Card className="gap-0">
          <CardContent className="py-12 text-center">
            <Camera className="w-8 h-8 text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-muted">No photos yet.</p>
            <p className="text-xs text-muted mt-1">
              Your stylist will add photos during your appointments.
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.bookingId} className="gap-0">
            <CardHeader className="pt-5 pb-0 px-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <CardTitle className="text-sm font-semibold">{group.serviceName}</CardTitle>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {new Date(group.bookingDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3">
              <div className="flex flex-wrap gap-3">
                {group.photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setLightbox(photo)}
                    className="relative w-24 h-24 rounded-xl overflow-hidden border border-border group hover:ring-2 hover:ring-accent/30 transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`${photo.photoType} photo`}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute bottom-1 left-1 text-[9px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLOR[photo.photoType]}`}
                    >
                      {TYPE_LABEL[photo.photoType]}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-3xl max-h-[85vh] relative" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={`${lightbox.photoType} photo`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${TYPE_COLOR[lightbox.photoType]}`}
              >
                {TYPE_LABEL[lightbox.photoType]}
              </span>
              {lightbox.notes && (
                <span className="text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
                  {lightbox.notes}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
