"use client";

import { motion } from "framer-motion";
import {
  LuMail,
  LuPhone,
  LuBell,
  LuShieldCheck,
  LuCalendarDays,
  LuClock,
  LuHeart,
  LuAward,
  LuInstagram,
} from "react-icons/lu";
import { TCLogo } from "@/components/TCLogo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AssistantOnboardingForm } from "./OnboardingFlow";

const CERT_LABELS: Record<string, string> = {
  tcreative_lash: "T Creative Lash",
  tcreative_jewelry: "T Creative Jewelry",
  external_lash: "Lash Certified",
  external_jewelry: "Jewelry Certified",
};

const WORK_STYLE_LABELS: Record<string, string> = {
  client_facing: "Client-facing",
  back_of_house: "Support",
  both: "Client & Support",
};

const SKILL_LABELS: Record<string, string> = {
  lash: "Lash Extensions",
  jewelry: "Permanent Jewelry",
  crochet: "Custom Crochet",
  consulting: "Business Consulting",
};

function formatTime(t: string): string {
  const h = parseInt(t.split(":")[0], 10);
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

interface Props {
  form: AssistantOnboardingForm;
}

export function PanelAssistantSummary({ form }: Props) {
  const firstName = form.getFieldValue("firstName");
  const preferredTitle = form.getFieldValue("preferredTitle");
  const skills = form.getFieldValue("skills");
  const availableDefaultStart = form.getFieldValue("availableDefaultStart") as string;
  const availableDefaultEnd = form.getFieldValue("availableDefaultEnd") as string;
  const availableDatesRaw = form.getFieldValue("availableDates") as string;
  const emergencyContactName = form.getFieldValue("emergencyContactName");
  const emergencyContactPhone = form.getFieldValue("emergencyContactPhone");
  const emergencyContactRelation = form.getFieldValue("emergencyContactRelation");
  const email = form.getFieldValue("email");
  const phone = form.getFieldValue("phone");
  const instagramHandle = form.getFieldValue("instagramHandle");
  const certifications = (form.getFieldValue("certifications") as string[]) ?? [];
  const workStyle = form.getFieldValue("workStyle");
  const notifications = form.getFieldValue("notifications");

  const selectedDateCount = (() => {
    try {
      return (JSON.parse(availableDatesRaw || "[]") as string[]).length;
    } catch {
      return 0;
    }
  })();

  const activeNotifications = Object.entries(notifications)
    .filter(([, v]) => v)
    .map(([k]) => (k === "sms" ? "SMS" : k === "email" ? "Email" : "Promos"));

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px]"
      >
        <Card className="border-foreground/5 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {/* Header: avatar + name + title */}
            <div className="bg-accent/5 px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <TCLogo size={26} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-foreground">{firstName}</p>
                <p className="text-xs text-muted">{preferredTitle || "New team member"}</p>
              </div>
            </div>

            {/* Skills + certs + work style */}
            {skills.length > 0 && (
              <div className="px-6 py-4 border-b border-foreground/5 space-y-2.5">
                <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
                  Skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((id) => (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="text-xs px-2.5 py-1 bg-accent/8 text-accent border-0 font-normal"
                    >
                      {SKILL_LABELS[id]}
                    </Badge>
                  ))}
                </div>
                {certifications.length > 0 && (
                  <div className="flex items-start gap-2">
                    <LuAward className="w-3.5 h-3.5 text-muted/60 shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {certifications.map((id) => (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="text-[11px] px-2 py-0.5 bg-surface text-foreground/70 border-0 font-normal"
                        >
                          {CERT_LABELS[id]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {workStyle && (
                  <p className="text-xs text-muted/70">{WORK_STYLE_LABELS[workStyle]}</p>
                )}
              </div>
            )}

            {/* Schedule */}
            <div className="px-6 py-4 border-b border-foreground/5 space-y-2.5">
              <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2.5">
                Schedule
              </p>
              {selectedDateCount > 0 && (
                <div className="flex items-center gap-3">
                  <LuCalendarDays className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                  <span className="text-sm text-foreground">
                    {selectedDateCount} {selectedDateCount === 1 ? "day" : "days"} selected
                  </span>
                </div>
              )}
              {availableDefaultStart && availableDefaultEnd && (
                <div className="flex items-center gap-3">
                  <LuClock className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                  <span className="text-sm text-foreground">
                    {formatTime(availableDefaultStart)} – {formatTime(availableDefaultEnd)}
                  </span>
                </div>
              )}
            </div>

            {/* Emergency contact */}
            {emergencyContactName && (
              <div className="px-6 py-4 border-b border-foreground/5 space-y-2.5">
                <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2.5">
                  Emergency Contact
                </p>
                <div className="flex items-center gap-3">
                  <LuHeart className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                  <span className="text-sm text-foreground">
                    {emergencyContactName}
                    {emergencyContactRelation ? ` (${emergencyContactRelation})` : ""}
                  </span>
                </div>
                {emergencyContactPhone && (
                  <div className="flex items-center gap-3">
                    <LuPhone className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                    <span className="text-sm text-foreground">{emergencyContactPhone}</span>
                  </div>
                )}
              </div>
            )}

            {/* Contact & notifications */}
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <LuMail className="w-3 h-3 text-muted/60" />
                  <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
                    Contact
                  </p>
                </div>
                <p className="text-xs text-foreground/80 truncate">{email}</p>
                {phone && <p className="text-xs text-foreground/80 mt-1">{phone}</p>}
                {instagramHandle && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <LuInstagram className="w-3 h-3 text-muted/50 shrink-0" />
                    <p className="text-xs text-foreground/80">@{instagramHandle}</p>
                  </div>
                )}
              </div>

              {activeNotifications.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <LuBell className="w-3 h-3 text-muted/60" />
                    <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
                      Notifications
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeNotifications.map((label) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="text-[11px] px-2 py-0.5 bg-surface text-foreground/80 border-0 font-normal"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-surface/50 flex items-center gap-2">
              <LuShieldCheck className="w-3 h-3 text-muted/50 shrink-0" />
              <p className="text-[10px] text-muted/50">Stored securely by T Creative Studio</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
