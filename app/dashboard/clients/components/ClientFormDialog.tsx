"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Dialog, Field, Input, Select, Textarea, DialogFooter } from "@/components/ui/dialog";
import type { ClientSource } from "../ClientsPage";

export interface ClientFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: ClientSource;
  referredBy: string;
  tags: string;
  notes: string;
  vip: boolean;
}

export const BLANK_FORM: ClientFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  source: "instagram",
  referredBy: "",
  tags: "",
  notes: "",
  vip: false,
};

export function ClientFormDialog({
  open,
  title,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial: ClientFormState;
  onClose: () => void;
  onSave: (f: ClientFormState) => void;
}) {
  const [form, setForm] = useState<ClientFormState>(initial);
  const set = (k: keyof ClientFormState) => (v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <Input
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              placeholder="e.g. Amara"
              autoFocus
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              placeholder="e.g. Johnson"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              placeholder="email@example.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </Field>
        </div>

        <Field label="How did they find you?">
          <Select
            value={form.source}
            onChange={(e) => set("source")(e.target.value as ClientSource)}
          >
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="pinterest">Pinterest</option>
            <option value="word_of_mouth">Word of Mouth</option>
            <option value="google_search">Google Search</option>
            <option value="referral">Referral</option>
            <option value="website_direct">Website Direct</option>
          </Select>
        </Field>

        {form.source === "referral" && (
          <Field label="Referred by">
            <Input
              value={form.referredBy}
              onChange={(e) => set("referredBy")(e.target.value)}
              placeholder="e.g. Sarah Mitchell"
            />
          </Field>
        )}

        <Field label="Tags" hint="Comma-separated: lash, jewelry, crochet, consulting">
          <Input
            value={form.tags}
            onChange={(e) => set("tags")(e.target.value)}
            placeholder="lash, jewelry"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes")(e.target.value)}
            placeholder="Allergies, preferences, etc."
            rows={2}
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.vip}
            onChange={(e) => set("vip")(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          <span className="text-sm text-foreground">Mark as VIP client</span>
          <Star className="w-3.5 h-3.5 text-[#d4a574] fill-[#d4a574]" />
        </label>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={() => onSave(form)}
        confirmLabel="Save"
        disabled={!form.firstName.trim() || !form.lastName.trim()}
      />
    </Dialog>
  );
}
