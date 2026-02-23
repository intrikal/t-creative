"use client";

/**
 * StepAdminSocials — step 3 of the admin onboarding wizard.
 *
 * ## Responsibility
 * Collects the admin's social media handles across 11 platforms. All inputs live
 * in a single scrollable card so the admin can quickly scan what they've entered.
 *
 * ## Platform groups
 * - **PRIMARY** (always visible): 4 Instagram slots + TikTok — the most
 *   common channels for beauty and lifestyle businesses.
 * - **EXTRA**: Facebook, YouTube, Pinterest, LinkedIn, Google Business, Website —
 *   shown inline after the primary slots in the same card.
 *
 * ## clean() — prefix stripping
 * Users often paste full URLs or handles with leading `@` characters. `clean()`
 * normalizes the input before it reaches the form:
 * - `website` → strips `https://` / `http://`
 * - `linkedin` → strips the full profile URL prefix (`linkedin.com/in/`)
 * - `google` → strips `g.page/`
 * - All others → strips leading `@` and `/` characters
 *
 * This keeps the stored values as bare handles/slugs (e.g. "tcreativestudio"
 * not "@tcreativestudio") so they can be reconstructed with the correct prefix
 * per platform when displayed.
 *
 * ## Keyboard handling
 * Enter in any input calls `onNext()` directly (each input has its own onKeyDown).
 * The global window listener only fires when no input is focused.
 *
 * ## Props
 * @prop form - the TanStack Form instance (AdminOnboardingForm)
 * @prop onNext - advances to step 4
 * @prop stepNum - displayed as the step badge number
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  FaInstagram,
  FaTiktok,
  FaFacebook,
  FaYoutube,
  FaPinterest,
  FaLinkedinIn,
  FaGoogle,
} from "react-icons/fa";
import { LuGlobe } from "react-icons/lu";
import type { AdminOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AdminOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

// Primary platforms — always visible, compact single list
const PRIMARY = [
  {
    key: "instagram" as const,
    icon: FaInstagram,
    prefix: "@",
    placeholder: "tcreativestudio",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    key: "instagram2" as const,
    icon: FaInstagram,
    prefix: "@",
    placeholder: "tcreative_lashes",
    color: "text-pink-400",
    bg: "bg-pink-400/8",
  },
  {
    key: "instagram3" as const,
    icon: FaInstagram,
    prefix: "@",
    placeholder: "tcreative_jewelry",
    color: "text-pink-400",
    bg: "bg-pink-400/8",
  },
  {
    key: "instagram4" as const,
    icon: FaInstagram,
    prefix: "@",
    placeholder: "tcreative_crochet",
    color: "text-pink-400",
    bg: "bg-pink-400/8",
  },
  {
    key: "tiktok" as const,
    icon: FaTiktok,
    prefix: "@",
    placeholder: "tcreativestudio",
    color: "text-foreground",
    bg: "bg-foreground/8",
  },
] as const;

const EXTRA = [
  {
    key: "facebook" as const,
    label: "Facebook",
    icon: FaFacebook,
    prefix: "fb.com/",
    placeholder: "tcreativestudio",
    color: "text-blue-500",
    bg: "bg-blue-500/8",
  },
  {
    key: "youtube" as const,
    label: "YouTube",
    icon: FaYoutube,
    prefix: "@",
    placeholder: "tcreativestudio",
    color: "text-red-500",
    bg: "bg-red-500/8",
  },
  {
    key: "pinterest" as const,
    label: "Pinterest",
    icon: FaPinterest,
    prefix: "@",
    placeholder: "tcreativestudio",
    color: "text-rose-600",
    bg: "bg-rose-600/8",
  },
  {
    key: "linkedin" as const,
    label: "LinkedIn",
    icon: FaLinkedinIn,
    prefix: "in/",
    placeholder: "tcreativestudio",
    color: "text-blue-600",
    bg: "bg-blue-600/8",
  },
  {
    key: "google" as const,
    label: "Google Business",
    icon: FaGoogle,
    prefix: "g.page/",
    placeholder: "tcreativestudio",
    color: "text-foreground",
    bg: "bg-foreground/6",
  },
  {
    key: "website" as const,
    label: "Website",
    icon: LuGlobe,
    prefix: "https://",
    placeholder: "tcreativestudio.com",
    color: "text-foreground",
    bg: "bg-foreground/6",
  },
] as const;

function clean(key: string, raw: string) {
  if (key === "website") return raw.replace(/^https?:\/\//, "");
  if (key === "linkedin")
    return raw.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/(in\/)?/, "").replace(/^[@/]+/, "");
  if (key === "google") return raw.replace(/^(https?:\/\/)?g\.page\//, "").replace(/^[@/]+/, "");
  return raw.replace(/^[@/]+/, "");
}

export function StepAdminSocials({ form, onNext, stepNum }: StepProps) {
  const inputFocusedRef = useRef(false);
  const firstName = form.getFieldValue("firstName");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && !inputFocusedRef.current) onNext();
    },
    [onNext],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-3">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/12 text-accent text-xs font-bold">
            {stepNum}
          </span>
          <span className="text-xs font-medium text-muted/50 uppercase tracking-wider">of 9</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground leading-snug">
          Your audience is already out there{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="text-sm text-foreground/60 mt-0.5 leading-relaxed">
          One booking link in each bio — followers go straight to you, no DMs needed.
        </p>
      </motion.div>

      {/* All platforms — one combined card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[340px]"
      >
        <div className="rounded-xl border border-foreground/10 overflow-hidden divide-y divide-foreground/6">
          {[...PRIMARY, ...EXTRA].map(({ key, icon: Icon, prefix, placeholder, color, bg }) => (
            <form.Field key={key} name={`socials.${key}`}>
              {(field) => (
                <div className="flex items-center gap-2.5 px-3 py-2 bg-surface focus-within:bg-accent/3 transition-colors">
                  <div
                    className={`w-5 h-5 rounded ${bg} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={`w-2.5 h-2.5 ${color}`} />
                  </div>
                  <span className="text-xs text-muted/35 shrink-0 select-none">{prefix}</span>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(clean(key, e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onNext();
                      }
                    }}
                    onFocus={() => (inputFocusedRef.current = true)}
                    onBlur={() => {
                      inputFocusedRef.current = false;
                      field.handleBlur();
                    }}
                    className="flex-1 text-sm bg-transparent text-foreground placeholder:text-muted/20 focus:outline-none"
                  />
                </div>
              )}
            </form.Field>
          ))}
        </div>
      </motion.div>

      {/* Continue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-3"
      >
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md bg-accent text-white hover:brightness-110 transition-all duration-200 cursor-pointer"
        >
          Done
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 8.5L6.5 11L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-xs text-muted/50">
          press <strong className="text-muted/70">Enter &crarr;</strong>
        </span>
      </motion.div>
    </div>
  );
}
