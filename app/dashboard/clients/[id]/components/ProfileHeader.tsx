/**
 * @module ProfileHeader
 * Header card displaying client avatar, name, badges, contact info,
 * key stats, and allergy/health alerts.
 */

import { Star, AlertTriangle, Phone, Mail, Users, Cake, Pin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  initials,
  avatarColor,
  formatDate,
  formatCents,
  lifecycleBadge,
  formatStage,
  getTier,
} from "./helpers";
import type { ClientDetailData } from "./types";

interface ProfileHeaderProps {
  data: ClientDetailData;
}

export function ProfileHeader({ data }: ProfileHeaderProps) {
  const { profile, preferences, loyaltyBalance } = data;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const av = avatarColor(fullName);
  const tier = getTier(loyaltyBalance);

  const totalSpent = data.bookings
    .filter((b) => b.status === "completed")
    .reduce((s, b) => s + b.totalInCents, 0);
  const completedBookings = data.bookings.filter((b) => b.status === "completed").length;

  const allergies =
    preferences?.allergies || (profile.onboardingData?.allergies as string | undefined) || null;

  return (
    <Card className="py-0">
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Avatar */}
          <Avatar className="w-16 h-16 shrink-0">
            <AvatarFallback className={cn("text-lg font-semibold", av)}>
              {initials(profile.firstName, profile.lastName)}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground">{fullName}</h1>
              {profile.isVip && <Star className="w-4 h-4 text-[#d4a574] fill-[#d4a574] shrink-0" />}
              {profile.lifecycleStage && (
                <Badge
                  className={cn(
                    "border text-[10px] px-1.5 py-0.5 font-medium",
                    lifecycleBadge(profile.lifecycleStage),
                  )}
                >
                  {formatStage(profile.lifecycleStage)}
                </Badge>
              )}
              <Badge
                className={cn("border text-[10px] px-1.5 py-0.5 font-medium", tier.bg, tier.color)}
              >
                {tier.label}
              </Badge>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {profile.email}
              </span>
              {profile.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {profile.phone}
                </span>
              )}
              {preferences?.birthday && (
                <span className="inline-flex items-center gap-1">
                  <Cake className="w-3.5 h-3.5" /> {preferences.birthday}
                </span>
              )}
            </div>

            {/* Quick info row */}
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
              {profile.source && (
                <span>
                  Source:{" "}
                  <span className="font-medium text-foreground capitalize">
                    {profile.source.replace("_", " ")}
                  </span>
                </span>
              )}
              {profile.referredByName && (
                <span>
                  Referred by{" "}
                  <span className="font-medium text-foreground">{profile.referredByName}</span>
                </span>
              )}
              {profile.referralCount > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                  <Users className="w-3 h-3" /> {profile.referralCount} referred
                </span>
              )}
              <span>Client since {formatDate(profile.createdAt)}</span>
            </div>
          </div>

          {/* Key stats */}
          <div className="flex gap-4 sm:gap-6 shrink-0 items-start pt-1">
            <div className="text-center">
              <p className="text-2xl font-semibold text-foreground">{completedBookings}</p>
              <p className="text-[10px] text-muted uppercase tracking-wide">Visits</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-foreground">{formatCents(totalSpent)}</p>
              <p className="text-[10px] text-muted uppercase tracking-wide">Total Spent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-foreground">{loyaltyBalance}</p>
              <p className="text-[10px] text-muted uppercase tracking-wide">Points</p>
            </div>
          </div>
        </div>

        {/* Pinned notes banner */}
        {data.pinnedNotes && data.pinnedNotes.length > 0 && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-[#7a5c10]/8 border border-[#7a5c10]/15">
            <Pin className="w-4 h-4 text-[#7a5c10] shrink-0 mt-0.5" />
            <div className="text-xs text-[#7a5c10] space-y-1">
              {data.pinnedNotes.map((note) => (
                <p key={note.id}>
                  <span className="font-semibold">{note.authorName}:</span> {note.content}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Allergy / health alert */}
        {(allergies || preferences?.healthNotes) && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-0.5">
              {allergies && (
                <p>
                  <span className="font-semibold">Allergies:</span> {allergies}
                </p>
              )}
              {preferences?.healthNotes && (
                <p>
                  <span className="font-semibold">Health notes:</span> {preferences.healthNotes}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
