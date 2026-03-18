/**
 * ProfileSection.tsx
 *
 * Profile form for assistant settings: first name, last name, phone, email,
 * instagram handle, bio, and save button.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ProfileSectionProps {
  profile: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    bio: string;
    instagram: string;
  };
  onChange: (update: Partial<ProfileSectionProps["profile"]>) => void;
  onSave: () => void;
  isPending: boolean;
  saved: boolean;
}

export function ProfileSection({
  profile,
  onChange,
  onSave,
  isPending,
  saved,
}: ProfileSectionProps) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <CardTitle className="text-sm font-semibold">Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">First name</label>
            <input
              value={profile.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Last name</label>
            <input
              value={profile.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Phone</label>
            <input
              value={profile.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Email</label>
            <input
              value={profile.email}
              readOnly
              className="w-full px-3 py-2 text-sm bg-surface/50 border border-border rounded-lg text-muted cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Instagram</label>
            <input
              value={profile.instagram}
              onChange={(e) => onChange({ instagram: e.target.value })}
              placeholder="@handle"
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Bio</label>
          <textarea
            value={profile.bio}
            onChange={(e) => onChange({ bio: e.target.value })}
            rows={3}
            placeholder="Tell clients about yourself…"
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none transition"
          />
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={onSave}
            disabled={isPending}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {saved ? "Saved!" : "Save changes"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
