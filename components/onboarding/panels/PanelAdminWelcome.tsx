"use client";

/**
 * PanelAdminWelcome — the right-panel for step 1 (admin name step).
 *
 * ## Purpose
 * Shows a "before vs. after" interactive demo to viscerally communicate the
 * problem T Creative Studio solves: managing 4 Instagram accounts via DMs
 * leads to missed bookings, double-booking, and lost deposits.
 *
 * ## "Before" section — DM chaos
 * Four tab buttons represent the admin's four Instagram accounts
 * (`@tcreativestudio`, `@tcreative_lashes`, `@tcreative_jewelry`, `@tcreative_crochet`).
 * Each tab shows a realistic 3-message DM thread with a highlighted "what went
 * wrong" caption in red below the messages. A mock spreadsheet footer reinforces
 * the manual tracking pain.
 *
 * ## "After" section — one booking link
 * Shows the single booking URL with a working copy button (`handleCopy` writes
 * to the clipboard). Below the link, four Instagram bio tabs let the user click
 * through each account to see how the same booking URL appears in each bio.
 *
 * ## State
 * - `activeTab` — which "before" DM thread is displayed (index into ACCOUNTS)
 * - `activeBio` — which bio preview is displayed (index into BIO_PREVIEWS)
 * - `copied` — drives the copy button icon/text swap (resets after 2 seconds)
 *
 * ## Data
 * `ACCOUNTS` and `BIO_PREVIEWS` are hardcoded constants that represent the
 * studio's four real Instagram accounts. They are not connected to the form.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { FaInstagram } from "react-icons/fa";
import { LuX, LuCheckCheck, LuTable, LuLink, LuCopy, LuCheck } from "react-icons/lu";
import { fadeUp, stagger } from "./shared";

const ACCOUNTS = [
  {
    tab: "main",
    handle: "@tcreativestudio",
    color: "text-pink-500",
    thread: [
      { from: "client", text: "hiii can I book a full set for next Saturday?? 🖤" },
      { from: "you", text: "yes babe!! I have 1pm open — does that work?" },
      { from: "client", text: "perfect!! do I need to do anything to hold it??" },
    ],
    pending: "Said yes. Never sent a deposit link. Saturday is still unblocked.",
  },
  {
    tab: "lashes",
    handle: "@tcreative_lashes",
    color: "text-pink-400",
    thread: [
      { from: "client", text: "ur work is everything 😭 I need a set for my bday March 15!!" },
      { from: "you", text: "yesss happy early bday!! March 15 works 🎂🖤" },
      { from: "client", text: "ok confirmed?? or do I need to do smth else" },
    ],
    pending: "This DM sat 3 days. Trini was in the jewelry inbox. Date passed.",
  },
  {
    tab: "jewelry",
    handle: "@tcreative_jewelry",
    color: "text-amber-400",
    thread: [
      { from: "client", text: "obsessed w ur anklets 🥺 can I come this Sunday??" },
      { from: "you", text: "yes love!! anklets start at $65 — Sunday works 🥰" },
      { from: "client", text: "yay!! what time and where do I go??" },
    ],
    pending: "Someone else booked Sunday on the main page. Double booked.",
  },
  {
    tab: "crochet",
    handle: "@tcreative_crochet",
    color: "text-violet-400",
    thread: [
      { from: "client", text: "that butterfly braid reel 😭😭 how much and how do I book??" },
      { from: "you", text: "omg thank u!! $150, I still have April spots 🖤" },
      { from: "client", text: "I want April 12th!! can u hold it for me??" },
    ],
    pending: "Never saw the follow-up. April 12 went to someone else.",
  },
] as const;

const BOOKING_LINK = "tcreative.app/book/tcreativestudio";

const BIO_PREVIEWS = [
  {
    tab: "main",
    handle: "@tcreativestudio",
    followers: "12.4k",
    bio: "✨ Lash Artist  💎 Permanent Jewelry\n✂️ Crochet  💡 Business Consulting\nBooking open — link below 🖤",
  },
  {
    tab: "lashes",
    handle: "@tcreative_lashes",
    followers: "8.2k",
    bio: "✨ Lash Extensions · Volume & Classic\nFull sets, fills & removals\nBook your appointment below ↓",
  },
  {
    tab: "jewelry",
    handle: "@tcreative_jewelry",
    followers: "5.1k",
    bio: "💎 Permanent Jewelry\nSterling silver · Gold filled · 14k solid\nAnklets, bracelets & necklaces · Book below",
  },
  {
    tab: "crochet",
    handle: "@tcreative_crochet",
    followers: "3.8k",
    bio: "✂️ Crochet Braids & Styles\nButterfly braids · knotless · more\nSlots open — book the link below 🖤",
  },
] as const;

export function PanelAdminWelcome() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeBio, setActiveBio] = useState(0);
  const [copied, setCopied] = useState(false);
  const account = ACCOUNTS[activeTab];
  const bio = BIO_PREVIEWS[activeBio];

  function handleCopy() {
    navigator.clipboard.writeText(BOOKING_LINK).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col justify-center h-full px-6 py-4 overflow-y-auto">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[400px] space-y-3"
      >
        {/* Header — compact, no logo */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-accent uppercase tracking-[0.15em] mb-0.5">
            Built for T Creative Studio
          </p>
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            No more DMs. No more spreadsheets.
          </h2>
        </motion.div>

        {/* Before — multi-account chaos */}
        <motion.div variants={fadeUp} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <FaInstagram className="w-3 h-3 text-pink-400" />
            <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">
              The old way
            </span>
            <LuX className="w-2.5 h-2.5 text-foreground/20" />
          </div>

          <div className="rounded-2xl bg-surface border border-foreground/8 overflow-hidden">
            {/* Clickable account tabs */}
            <div className="flex border-b border-foreground/8">
              {ACCOUNTS.map((a, i) => (
                <button
                  key={a.tab}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold shrink-0 border-b-2 transition-colors duration-150 ${
                    activeTab === i
                      ? "border-pink-400 text-pink-400 bg-pink-400/5"
                      : "border-transparent text-muted/35 hover:text-muted/60"
                  }`}
                >
                  <FaInstagram
                    className={`w-2 h-2 ${activeTab === i ? "text-pink-400" : "text-muted/25"}`}
                  />
                  @{a.tab}
                </button>
              ))}
            </div>

            {/* 3-message DM thread */}
            <div className="px-3 py-2 space-y-1.5">
              {account.thread.map(({ from, text }, i) => (
                <div key={i} className={`flex ${from === "you" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] px-2 py-1 rounded-xl text-[11px] leading-snug ${
                      from === "you"
                        ? "bg-accent/15 text-foreground/70 rounded-br-sm"
                        : "bg-foreground/6 text-foreground/60 rounded-bl-sm"
                    }`}
                  >
                    {text}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-red-400/65 text-center font-medium">
                {account.pending}
              </p>
            </div>

            {/* Spreadsheet footer */}
            <div className="border-t border-foreground/6 px-3 py-1.5 flex items-center gap-2 bg-foreground/2">
              <LuTable className="w-3 h-3 text-muted/30 shrink-0" />
              <div className="flex gap-3 flex-1 overflow-hidden">
                {["Name", "Service", "Date", "Deposit", "Status"].map((col) => (
                  <span
                    key={col}
                    className="text-[9px] font-semibold text-muted/25 uppercase tracking-wider shrink-0"
                  >
                    {col}
                  </span>
                ))}
              </div>
              <span className="text-[9px] font-semibold text-amber-500/70 bg-amber-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                14 pending
              </span>
            </div>
          </div>
        </motion.div>

        {/* Divider */}
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="flex-1 h-px bg-foreground/8" />
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <LuCheckCheck className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">
              With T Creative
            </span>
          </div>
          <div className="flex-1 h-px bg-foreground/8" />
        </motion.div>

        {/* Booking link — interactive */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl bg-surface border border-foreground/8 overflow-hidden"
        >
          {/* Link + copy */}
          <div className="px-3 pt-2.5 pb-2 border-b border-foreground/6">
            <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-1.5">
              One link — paste in all 4 bios
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/8 border border-accent/15 min-w-0">
                <LuLink className="w-3 h-3 text-accent shrink-0" />
                <span className="text-[11px] text-accent font-medium truncate">{BOOKING_LINK}</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all duration-200 ${
                  copied
                    ? "bg-emerald-500/12 text-emerald-500 border border-emerald-500/20"
                    : "bg-foreground/6 text-muted/60 border border-foreground/8 hover:bg-foreground/10"
                }`}
              >
                {copied ? <LuCheck className="w-3 h-3" /> : <LuCopy className="w-3 h-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Bio preview tabs */}
          <div className="flex border-b border-foreground/6">
            {BIO_PREVIEWS.map((b, i) => (
              <button
                key={b.tab}
                type="button"
                onClick={() => setActiveBio(i)}
                className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold shrink-0 border-b-2 transition-colors duration-150 ${
                  activeBio === i
                    ? "border-pink-400 text-pink-400 bg-pink-400/5"
                    : "border-transparent text-muted/35 hover:text-muted/60"
                }`}
              >
                <FaInstagram
                  className={`w-2 h-2 ${activeBio === i ? "text-pink-400" : "text-muted/25"}`}
                />
                @{b.tab}
              </button>
            ))}
          </div>

          {/* Mini Instagram bio preview */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 via-rose-400 to-violet-500 flex items-center justify-center shrink-0">
                <FaInstagram className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground leading-tight">{bio.handle}</p>
                <p className="text-[10px] text-muted/45">{bio.followers} followers</p>
              </div>
            </div>
            <p className="text-[11px] text-foreground/65 leading-relaxed whitespace-pre-line mb-2">
              {bio.bio}
            </p>
            <div className="flex items-center gap-1">
              <LuLink className="w-2.5 h-2.5 text-accent shrink-0" />
              <span className="text-[11px] text-accent font-medium">{BOOKING_LINK}</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
