"use client";

import { useState } from "react";
import {
  User,
  Bell,
  Shield,
  ChevronRight,
  CreditCard,
  Camera,
  LogOut,
  Trash2,
  AlertTriangle,
  Plus,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Section = "profile" | "notifications" | "payments" | "account";

const SECTIONS: {
  id: Section;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "account", label: "Account", icon: Shield },
];

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
}

const INITIAL_CARDS: PaymentMethod[] = [
  { id: "1", brand: "Visa", last4: "4830", expiry: "09/27", isDefault: true },
];

interface NotifPref {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const INITIAL_NOTIFS: NotifPref[] = [
  {
    id: "booking_confirm",
    label: "Booking Confirmations",
    description: "Get notified when your appointment is confirmed",
    enabled: true,
  },
  {
    id: "booking_reminder",
    label: "Appointment Reminders",
    description: "Reminder 24 hours before your appointment",
    enabled: true,
  },
  {
    id: "studio_messages",
    label: "Studio Messages",
    description: "Messages from T Creative Studio",
    enabled: true,
  },
  {
    id: "loyalty",
    label: "Loyalty Rewards",
    description: "Notify me when I earn a reward",
    enabled: true,
  },
  {
    id: "promotions",
    label: "Promotions & Offers",
    description: "Special deals and seasonal offers",
    enabled: false,
  },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "relative w-10 h-5.5 rounded-full transition-colors shrink-0",
        enabled ? "bg-accent" : "bg-foreground/15",
      )}
      style={{ height: "22px", minWidth: "40px" }}
    >
      <span
        className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
          enabled ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function ClientSettingsPage() {
  const [section, setSection] = useState<Section>("profile");
  const [notifs, setNotifs] = useState<NotifPref[]>(INITIAL_NOTIFS);
  const [cards, setCards] = useState<PaymentMethod[]>(INITIAL_CARDS);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Profile fields
  const [name, setName] = useState("Maya Rodriguez");
  const [email, setEmail] = useState("maya.r@email.com");
  const [phone, setPhone] = useState("(555) 210-4830");
  const [allergies, setAllergies] = useState("No known allergies. Prefer natural curl styles.");

  function toggleNotif(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n)));
  }

  function setDefaultCard(id: string) {
    setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function saveProfile() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your profile and preferences</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* Section nav */}
        <div className="sm:w-44 shrink-0">
          <Card className="gap-0 py-1">
            <CardContent className="px-1 py-1">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    section === id
                      ? "bg-foreground/8 text-foreground"
                      : "text-muted hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                  </span>
                  <ChevronRight className="w-3 h-3 text-muted/40" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Section content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* ── Profile ── */}
          {section === "profile" && (
            <Card className="gap-0">
              <CardContent className="px-5 py-5 space-y-5">
                {/* Profile photo */}
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
                      <span className="text-xl font-bold text-accent">MR</span>
                    </div>
                    <button className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center border-2 border-background hover:bg-foreground/80 transition-colors">
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted mt-0.5">{email}</p>
                    <button className="text-xs text-accent hover:underline mt-1">
                      Upload photo
                    </button>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-4">
                  <p className="text-sm font-semibold text-foreground">Profile Information</p>
                  {[
                    { label: "Full Name", value: name, onChange: setName, type: "text" },
                    { label: "Email", value: email, onChange: setEmail, type: "email" },
                    { label: "Phone", value: phone, onChange: setPhone, type: "tel" },
                  ].map(({ label, value, onChange, type }) => (
                    <div key={label} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted">{label}</label>
                      <input
                        type={type}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full text-sm text-foreground bg-surface border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/40"
                      />
                    </div>
                  ))}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={saveProfile}
                      className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
                    >
                      Save Changes
                    </button>
                    {saved && (
                      <span className="text-xs text-[#4e6b51] font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Saved!
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-medium text-foreground mb-2">Allergies & Notes</p>
                  <textarea
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    rows={3}
                    className="w-full text-sm text-foreground bg-surface border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent/40"
                  />
                  <p className="text-[11px] text-muted mt-1.5">
                    This info is shared with your stylist before each appointment.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Notifications ── */}
          {section === "notifications" && (
            <Card className="gap-0">
              <CardContent className="px-5 py-5 space-y-1">
                <p className="text-sm font-semibold text-foreground mb-3">
                  Notification Preferences
                </p>
                {notifs.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-center justify-between gap-4 py-3 border-b border-border/40 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{notif.label}</p>
                      <p className="text-xs text-muted mt-0.5">{notif.description}</p>
                    </div>
                    <Toggle enabled={notif.enabled} onChange={() => toggleNotif(notif.id)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Payments ── */}
          {section === "payments" && (
            <Card className="gap-0">
              <CardContent className="px-5 py-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">Payment Methods</p>

                {cards.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-xl">
                    <CreditCard className="w-6 h-6 text-muted/40 mx-auto mb-2" />
                    <p className="text-sm text-muted">No payment methods saved</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cards.map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface"
                      >
                        <div className="w-9 h-6 rounded bg-foreground/8 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4 text-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {card.brand} •••• {card.last4}
                          </p>
                          <p className="text-xs text-muted mt-0.5">Expires {card.expiry}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {card.isDefault ? (
                            <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 border border-[#4e6b51]/20 px-1.5 py-0.5 rounded-full">
                              Default
                            </span>
                          ) : (
                            <button
                              onClick={() => setDefaultCard(card.id)}
                              className="text-[10px] text-muted hover:text-foreground transition-colors"
                            >
                              Set default
                            </button>
                          )}
                          <button
                            onClick={() => removeCard(card.id)}
                            className="p-1 rounded-md text-muted hover:text-destructive hover:bg-destructive/8 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-colors">
                  <Plus className="w-4 h-4" />
                  Add payment method
                </button>

                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted leading-relaxed">
                    Payment methods are used for shop orders, training deposits, and service
                    add-ons. Card data is encrypted and stored securely.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Account ── */}
          {section === "account" && (
            <Card className="gap-0">
              <CardContent className="px-5 py-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">Account</p>

                <div className="space-y-0">
                  <div className="flex items-center justify-between py-3 border-b border-border/40">
                    <div>
                      <p className="text-sm font-medium text-foreground">Change Password</p>
                      <p className="text-xs text-muted mt-0.5">Update your login password</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-border/40">
                    <div>
                      <p className="text-sm font-medium text-foreground">Linked Phone</p>
                      <p className="text-xs text-muted mt-0.5">(555) 210-4830 · Verified</p>
                    </div>
                    <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 border border-[#4e6b51]/20 px-1.5 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-border/40">
                    <div>
                      <p className="text-sm font-medium text-foreground">Privacy Policy</p>
                      <p className="text-xs text-muted mt-0.5">How we handle your data</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </div>
                  <button
                    onClick={() => {}}
                    className="w-full flex items-center justify-between py-3 border-b border-border/40 text-left group"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-destructive transition-colors">
                        Log Out
                      </p>
                      <p className="text-xs text-muted mt-0.5">Sign out of your account</p>
                    </div>
                    <LogOut className="w-4 h-4 text-muted group-hover:text-destructive transition-colors" />
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Account
                  </button>
                  <p className="text-[11px] text-muted mt-1">
                    Permanently removes all your data from T Creative Studio.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <Dialog
          open
          title="Delete Account"
          description="This action cannot be undone."
          onClose={() => setShowDeleteConfirm(false)}
          size="sm"
        >
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              Your profile, booking history, loyalty points, and all personal data will be
              permanently deleted. This cannot be reversed.
            </p>
          </div>
          <DialogFooter
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={() => setShowDeleteConfirm(false)}
            confirmLabel="Delete my account"
            destructive
          />
        </Dialog>
      )}
    </div>
  );
}
