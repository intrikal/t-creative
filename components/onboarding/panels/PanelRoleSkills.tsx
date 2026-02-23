"use client";

/**
 * PanelRoleSkills — right-panel live preview for StepRoleSkills (step 2).
 *
 * ## What it shows
 * A live assistant profile card that mirrors every field the user fills in on
 * the left: name, preferred title, bio, experience level, work style, skills,
 * certifications, and the training toggle with selected formats.
 *
 * All sections appear progressively — empty / default states are shown until
 * the user types or selects something, at which point the card updates
 * immediately thanks to TanStack Form's `form.Subscribe` selector.
 *
 * ## Layout
 * - Header: avatar icon · name · title · experience pill
 * - Bio: italic quote line, shown only when non-empty
 * - Skills: accent-tinted badges
 * - Certifications: slate-tinted badges, shown when at least one is selected
 * - Work style: single chip, shown when selected
 * - Training: shown when offersTraining is true; lists selected format pills
 *
 * ## Props
 * @prop firstName        — from form field "firstName"
 * @prop preferredTitle   — from form field "preferredTitle"
 * @prop bio              — from form field "bio"
 * @prop experienceLevel  — from form field "experienceLevel"
 * @prop workStyle        — from form field "workStyle"
 * @prop skills           — from form field "skills"
 * @prop certifications   — from form field "certifications"
 * @prop offersTraining   — from form field "offersTraining"
 * @prop trainingFormats  — from form field "trainingFormats"
 */
import { motion } from "framer-motion";
import { LuUser, LuStar, LuGraduationCap } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const SKILL_LABELS: Record<string, string> = {
  lash: "Lash Extensions",
  jewelry: "Permanent Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
};

const CERT_LABELS: Record<string, string> = {
  tcreative_lash: "T Creative Lash",
  tcreative_jewelry: "T Creative Jewelry",
  external_lash: "Lash (external)",
  external_jewelry: "Jewelry (external)",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
};

const WORK_STYLE_LABELS: Record<string, string> = {
  client_facing: "Client-facing",
  back_of_house: "Support",
  both: "Both",
};

const TRAINING_FORMAT_LABELS: Record<string, string> = {
  one_on_one: "1-on-1",
  group: "Group",
  online: "Online",
  in_person: "In-person",
};

interface PanelRoleSkillsProps {
  firstName?: string;
  preferredTitle?: string;
  bio?: string;
  experienceLevel?: string;
  workStyle?: string;
  skills?: string[];
  certifications?: string[];
  offersTraining?: boolean;
  trainingFormats?: string[];
}

export function PanelRoleSkills({
  firstName,
  preferredTitle,
  bio,
  experienceLevel,
  workStyle,
  skills,
  certifications,
  offersTraining,
  trainingFormats,
}: PanelRoleSkillsProps) {
  const displayName = firstName?.trim() || "Your Name";
  const displayTitle = preferredTitle?.trim() || "Your title";
  const hasBio = bio && bio.trim().length > 0;
  const hasSkills = skills && skills.length > 0;
  const hasCerts = certifications && certifications.length > 0;
  const hasWorkStyle = workStyle && workStyle.length > 0;
  const hasExperience = experienceLevel && experienceLevel.length > 0;
  const hasTrainingFormats = trainingFormats && trainingFormats.length > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
          Profile preview
        </p>

        {/* Live assistant card */}
        <Card className="border-foreground/5 overflow-hidden">
          <CardContent className="p-0">
            {/* Header: avatar · name/title · experience */}
            <div className="px-5 py-4 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-accent-geo flex items-center justify-center shrink-0">
                <LuUser className="w-5 h-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted">{displayTitle}</p>
              </div>
              {hasExperience ? (
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                  {EXPERIENCE_LABELS[experienceLevel!] ?? experienceLevel}
                </span>
              ) : (
                <div className="ml-auto flex items-center gap-0.5 text-accent/70">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <LuStar
                      key={i}
                      className={`w-3 h-3 ${i <= 4 ? "fill-accent/30 text-accent/70" : "text-foreground/10"}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Bio */}
            {hasBio && (
              <div className="px-5 pb-3">
                <p className="text-xs text-muted italic leading-relaxed line-clamp-2">
                  &ldquo;{bio}&rdquo;
                </p>
              </div>
            )}

            {/* Skills */}
            <div className="px-5 pb-3">
              <p className="text-[9px] font-medium text-muted/60 uppercase tracking-widest mb-1.5">
                Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {hasSkills ? (
                  skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="text-[11px] px-2.5 py-0.5 bg-accent/8 text-accent border-0 font-normal"
                    >
                      {SKILL_LABELS[skill] ?? skill}
                    </Badge>
                  ))
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-[11px] px-2.5 py-0.5 bg-foreground/5 text-muted border-0 font-normal"
                  >
                    + your skills
                  </Badge>
                )}
              </div>
            </div>

            {/* Certifications */}
            {hasCerts && (
              <div className="px-5 pb-3">
                <p className="text-[9px] font-medium text-muted/60 uppercase tracking-widest mb-1.5">
                  Certifications
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {certifications.map((cert) => (
                    <Badge
                      key={cert}
                      variant="secondary"
                      className="text-[11px] px-2.5 py-0.5 bg-foreground/6 text-foreground/60 border border-foreground/8 font-normal"
                    >
                      {CERT_LABELS[cert] ?? cert}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Work style */}
            {hasWorkStyle && (
              <div className="px-5 pb-4">
                <p className="text-[9px] font-medium text-muted/60 uppercase tracking-widest mb-1.5">
                  Work Style
                </p>
                <span className="inline-flex text-[11px] px-2.5 py-0.5 rounded-full bg-foreground/6 text-foreground/60 border border-foreground/8">
                  {WORK_STYLE_LABELS[workStyle] ?? workStyle}
                </span>
              </div>
            )}

            {/* Training */}
            {offersTraining && (
              <div className="px-5 pb-4 border-t border-foreground/5 pt-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <LuGraduationCap className="w-3 h-3 text-accent/70" />
                  <p className="text-[9px] font-medium text-muted/60 uppercase tracking-widest">
                    Offers Training
                  </p>
                </div>
                {hasTrainingFormats ? (
                  <div className="flex flex-wrap gap-1">
                    {trainingFormats.map((fmt) => (
                      <span
                        key={fmt}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-accent/8 text-accent"
                      >
                        {TRAINING_FORMAT_LABELS[fmt] ?? fmt}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted/50">Select preferred formats</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How profile is used */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
        >
          <LuStar className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            Your profile helps clients know what you specialize in and find the right fit.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
