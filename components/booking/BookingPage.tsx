/**
 * components/booking/BookingPage.tsx — Public-facing studio storefront UI.
 *
 * ## Responsibility
 * Renders the complete client-visible booking page for T Creative Studio at
 * `/book/[slug]`. All data is received as props from the Server Component
 * (`app/book/[slug]/page.tsx`) — this file contains no data fetching.
 *
 * ## Architecture: Server Component → Client Component split
 * The page uses the "data-down" pattern:
 *
 *   Server Component (page.tsx)
 *     ├── runs on server, fetches DB data, builds props
 *     └── renders → <BookingPage> (this file, "use client")
 *                      ├── handles scroll, clipboard, animations (needs browser APIs)
 *                      └── renders sub-components:
 *                            ServiceCard, CopyLinkButton, ReviewCard, SectionHeading
 *
 * This split is intentional — Framer Motion, navigator.clipboard, and scroll
 * imperatives require a browser context, so the entire presentational layer
 * must be a Client Component. The data layer stays server-only so DB credentials
 * never reach the browser.
 *
 * ## Co-located modules
 * | Module                    | Contains                                      |
 * |---------------------------|-----------------------------------------------|
 * | `./types.ts`              | All TypeScript interfaces / BookingPageProps  |
 * | `./constants.ts`          | CATEGORIES, CATEGORY_META, HOW_IT_WORKS, etc. |
 * | `./helpers.ts`            | formatPrice, getInitials, formatTime, etc.    |
 * | `./components/SectionHeading` | Two-line section label component          |
 * | `./components/ServiceCard`    | Bookable service card with CTAs           |
 * | `./components/CopyLinkButton` | Clipboard copy + Instagram share          |
 * | `./components/ReviewCard`     | Star rating + review body card            |
 *
 * ## Layout
 * Two-column on desktop (lg+), single-column stacked on mobile:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  Mobile sticky header (lg:hidden)           │
 *   ├──────────────┬──────────────────────────────┤
 *   │  Sidebar     │  Main content                │
 *   │  (lg only,   │  ─ New client callout        │
 *   │   sticky)    │  ─ Services (category tabs)  │
 *   │              │  ─ Gallery (placeholder)     │
 *   │  Logo        │  ─ Reviews (conditional)     │
 *   │  Avatar      │  ─ About                     │
 *   │  Bio         │  ─ How it works              │
 *   │  Hours       │  ─ Rewards (conditional)     │
 *   │  Socials     │  ─ Referral                  │
 *   │  CTA         │  ─ Policies (conditional)    │
 *   │              │  ─ FAQ (conditional)         │
 *   │              │  ─ Contact CTA               │
 *   └──────────────┴──────────────────────────────┘
 *   │  Footer                                      │
 *   └──────────────────────────────────────────────┘
 *
 * ## Conditional sections
 * - Reviews:  only rendered if `featuredReviews.length > 0`
 * - Rewards:  only rendered if `studio.rewardsEnabled === true`
 * - Policies: only rendered if at least one fee/window field is set
 * - FAQ:      only rendered if at least one category has `intake[cat].prep` text
 * - Hours:    only shown when `schedule.startTime` or `endTime` is configured
 *
 * ## Phase 2 integration points
 * - ServiceCard CTAs currently show a placeholder alert. Phase 2 wires these to
 *   a calendar modal or Square API.
 * - Gallery section is a placeholder grid. Phase 2 adds Supabase Storage images.
 * - CopyLinkButton URL can be personalised with a `?ref=CLIENT_ID` query param.
 */

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  LuInstagram,
  LuMapPin,
  LuClock,
  LuCamera,
  LuShieldCheck,
  LuMessageCircle,
  LuCalendarCheck,
  LuGift,
  LuSparkles,
  LuCalendar,
  LuUsers,
  LuInfo,
} from "react-icons/lu";
import { SiTiktok, SiFacebook } from "react-icons/si";
import { fadeUp, stagger } from "@/components/onboarding/panels/shared";
import { TCLogo } from "@/components/TCLogo";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CopyLinkButton } from "./components/CopyLinkButton";
import { ReviewCard } from "./components/ReviewCard";
import { SectionHeading } from "./components/SectionHeading";
import { ServiceCard } from "./components/ServiceCard";
import { CATEGORIES, CATEGORY_META, HOW_IT_WORKS } from "./constants";
import { formatPrice, getInitials, formatLocationType, formatTime } from "./helpers";
import type { BookingPageProps } from "./types";

/**
 * BookingPage — root client component for the public booking storefront.
 *
 * Derives all display state from props — no internal data fetching.
 * Local UI state (clipboard animation) lives in CopyLinkButton.
 */
export function BookingPage({
  studio,
  services,
  featuredReviews,
  reviewStats,
  addOnsByService,
  slug,
}: BookingPageProps) {
  /** Smoothly scrolls to the services section when a header/sidebar CTA is clicked. */
  const scrollToServices = () => {
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
  };

  // Strip the leading "@" once so all downstream href and display uses are consistent.
  const instagramHandle = studio.socials.instagram?.replace("@", "") || null;

  // Only render tabs for categories that have at least one active service.
  const activeCategories = CATEGORIES.filter((cat) => services.some((s) => s.category === cat));
  const defaultTab = activeCategories[0] ?? "lash";

  // Build FAQ items from intake prep text. Categories without prep text are skipped.
  const faqItems = CATEGORIES.filter((cat) => studio.intake[cat]?.prep).map((cat) => ({
    question: CATEGORY_META[cat].faqQuestion,
    answer: studio.intake[cat].prep,
  }));

  // Gate the Policies section — only show when at least one policy field is set.
  const hasPolicies =
    studio.policies.cancellationWindowHours !== null ||
    studio.policies.cancellationFeeInCents !== null ||
    studio.policies.noShowFeeInCents !== null;

  // Combine location type + area into a single display string.
  const locationLabel = [formatLocationType(studio.locationType), studio.locationArea]
    .filter(Boolean)
    .join(" · ");

  // Build social links array, filtering out platforms with no handle configured.
  const socialLinks = [
    {
      key: "instagram",
      handle: studio.socials.instagram,
      icon: LuInstagram,
      color: "#E1306C",
      href: (h: string) => `https://instagram.com/${h.replace("@", "")}`,
    },
    {
      key: "tiktok",
      handle: studio.socials.tiktok,
      icon: SiTiktok,
      color: "#000000",
      href: (h: string) => `https://tiktok.com/@${h.replace("@", "")}`,
    },
    {
      key: "facebook",
      handle: studio.socials.facebook,
      icon: SiFacebook,
      color: "#1877F2",
      href: (h: string) => `https://facebook.com/${h.replace("@", "")}`,
    },
  ].filter((s) => s.handle && s.handle.trim() !== "");

  const nowBookingMonth = new Date().toLocaleString("en-US", { month: "long" });

  const hasHours = studio.schedule.startTime || studio.schedule.endTime;
  const hoursLabel =
    studio.schedule.startTime && studio.schedule.endTime
      ? `${formatTime(studio.schedule.startTime)} – ${formatTime(studio.schedule.endTime)}`
      : studio.schedule.startTime
        ? `Opens at ${formatTime(studio.schedule.startTime)}`
        : studio.schedule.endTime
          ? `Closes at ${formatTime(studio.schedule.endTime)}`
          : null;

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-stone-900">
      {/* ── Mobile-only sticky header ── */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-stone-700">
            <TCLogo size={20} />
            <span className="text-sm font-medium tracking-wide">{studio.name}</span>
          </div>
          <button
            onClick={scrollToServices}
            className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-95"
          >
            Book a session
          </button>
        </div>
      </header>

      {/* ── Layout wrapper ── */}
      <div className="mx-auto max-w-5xl px-5 lg:flex lg:items-start lg:gap-10 lg:py-12">
        {/* ── Desktop sticky sidebar ── */}
        <aside className="hidden lg:block lg:w-60 lg:shrink-0 xl:w-64">
          <div className="sticky top-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
            <div className="h-2 bg-gradient-to-r from-rose-400 via-amber-300 to-violet-400" />

            <div className="p-6">
              <div className="mb-5 flex justify-center">
                <TCLogo size={32} className="text-stone-700" />
              </div>

              <div className="mb-4 flex justify-center">
                <Avatar className="h-20 w-20 ring-4 ring-rose-50 shadow-sm">
                  <AvatarImage src={studio.avatarUrl ?? undefined} alt={studio.name} />
                  <AvatarFallback className="bg-rose-100 text-xl font-semibold text-rose-400">
                    {getInitials(studio.name)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="mb-3 text-center">
                <h1 className="font-display text-xl font-light text-stone-900">{studio.name}</h1>
                {studio.bio && (
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">{studio.bio}</p>
                )}
                {locationLabel && (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-stone-400">
                    <LuMapPin className="h-3 w-3 text-rose-400" />
                    {locationLabel}
                  </p>
                )}
              </div>

              <div className="mb-4 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-500 ring-1 ring-rose-100">
                  <LuCalendar className="h-3 w-3" />
                  Now booking {nowBookingMonth}
                </span>
              </div>

              {reviewStats.count > 0 && (
                <>
                  <Separator className="mb-4" />
                  <div className="mb-4 flex justify-around text-center">
                    <div>
                      <p className="text-base font-semibold text-stone-900">{reviewStats.count}+</p>
                      <p className="text-[10px] text-stone-400">clients</p>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-stone-900">{reviewStats.avg}★</p>
                      <p className="text-[10px] text-stone-400">rating</p>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-stone-900">4</p>
                      <p className="text-[10px] text-stone-400">services</p>
                    </div>
                  </div>
                </>
              )}

              {hasHours && hoursLabel && (
                <>
                  <Separator className="mb-4" />
                  <div className="mb-4 flex items-center gap-2 text-xs text-stone-500">
                    <LuClock className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                    <span>{hoursLabel}</span>
                  </div>
                </>
              )}

              {socialLinks.length > 0 && (
                <>
                  <Separator className="mb-4" />
                  <div className="mb-4 flex flex-col gap-2">
                    {socialLinks.map(({ key, handle, icon: Icon, color, href }) => (
                      <a
                        key={key}
                        href={href(handle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800"
                      >
                        <Icon style={{ color }} className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {handle.startsWith("@") ? handle : `@${handle}`}
                        </span>
                      </a>
                    ))}
                  </div>
                </>
              )}

              <Separator className="mb-4" />

              <button
                onClick={scrollToServices}
                className="w-full rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-[0.98]"
              >
                Book a session
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="min-w-0 flex-1 pb-24">
          {/* ── Mobile hero (lg:hidden) ── */}
          <motion.section
            variants={stagger}
            initial="hidden"
            animate="show"
            className="bg-gradient-to-b from-rose-50/80 via-amber-50/30 to-transparent pb-8 pt-10 text-center lg:hidden"
          >
            <motion.div variants={fadeUp} className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-stone-100">
                <TCLogo size={30} className="text-stone-800" />
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="mb-4 flex justify-center">
              <Avatar className="h-24 w-24 shadow-lg ring-4 ring-white">
                <AvatarImage src={studio.avatarUrl ?? undefined} alt={studio.name} />
                <AvatarFallback className="bg-rose-100 text-2xl font-semibold text-rose-400">
                  {getInitials(studio.name)}
                </AvatarFallback>
              </Avatar>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-display mb-1 text-3xl font-light tracking-wide text-stone-900"
            >
              {studio.name}
            </motion.h1>

            <motion.div variants={fadeUp} className="mb-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-500 ring-1 ring-rose-100">
                <LuCalendar className="h-3 w-3" />
                Now booking {nowBookingMonth}
              </span>
            </motion.div>

            {studio.bio && (
              <motion.p
                variants={fadeUp}
                className="mx-auto mb-4 max-w-xs text-sm leading-relaxed text-stone-500"
              >
                {studio.bio}
              </motion.p>
            )}

            {locationLabel && (
              <motion.div variants={fadeUp} className="mb-3 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-stone-500 shadow-sm ring-1 ring-stone-100">
                  <LuMapPin className="h-3 w-3 text-rose-400" />
                  {locationLabel}
                </span>
              </motion.div>
            )}

            {hoursLabel && (
              <motion.div variants={fadeUp} className="mb-5 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-stone-500 shadow-sm ring-1 ring-stone-100">
                  <LuClock className="h-3 w-3 text-stone-400" />
                  {hoursLabel}
                </span>
              </motion.div>
            )}

            {reviewStats.count > 0 && (
              <motion.div variants={fadeUp} className="mb-6 flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-lg font-semibold text-stone-900">{reviewStats.count}+</p>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">clients</p>
                </div>
                <div className="h-6 w-px bg-stone-200" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-stone-900">{reviewStats.avg}★</p>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">rating</p>
                </div>
                <div className="h-6 w-px bg-stone-200" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-stone-900">4</p>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">services</p>
                </div>
              </motion.div>
            )}

            {socialLinks.length > 0 && (
              <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-2">
                {socialLinks.map(({ key, handle, icon: Icon, color, href }) => (
                  <a
                    key={key}
                    href={href(handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600 shadow-sm transition-colors hover:bg-stone-50"
                  >
                    <Icon style={{ color }} className="h-3.5 w-3.5" />
                    {handle.startsWith("@") ? handle : `@${handle}`}
                  </a>
                ))}
              </motion.div>
            )}
          </motion.section>

          {/*
           * New client callout — always shown, not gated by auth or prior-visit state.
           * Reduces abandoned booking requests by setting expectations upfront.
           */}
          <div className="mt-8 mb-2 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 lg:mt-0">
            <LuInfo className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p className="text-sm font-medium text-stone-800">First time? Welcome!</p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                All bookings are request-based and personally reviewed by Trini. Once you submit,
                expect a response within 24 hours. A deposit may be required to hold your spot.
              </p>
            </div>
          </div>

          {/* ── Services ── */}
          <section id="services" className="mt-8 lg:pt-0">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-rose-400">
                  Services
                </p>
                <h2 className="font-display text-2xl font-light text-stone-900">
                  Book your appointment
                </h2>
              </div>
              <p className="shrink-0 text-[11px] text-stone-400 pb-1">Book 1–2 weeks ahead</p>
            </div>

            {activeCategories.length > 0 ? (
              <Tabs defaultValue={defaultTab}>
                <TabsList
                  variant="line"
                  className="mb-6 w-full justify-start border-b border-stone-200 bg-transparent pb-0"
                >
                  {activeCategories.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const Icon = meta.icon;
                    return (
                      <TabsTrigger
                        key={cat}
                        value={cat}
                        className={`shrink-0 gap-1.5 px-3 pb-3 ${meta.tabActive}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                        <span className="text-sm">{meta.shortLabel}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {activeCategories.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const catServices = services.filter((s) => s.category === cat);
                  return (
                    <TabsContent key={cat} value={cat} className="mt-0">
                      <p className="mb-4 text-sm text-stone-500 leading-relaxed">
                        {meta.description}
                      </p>
                      {meta.note && (
                        <p className="mb-4 text-xs text-stone-400 italic">{meta.note}</p>
                      )}
                      <div className="flex flex-col gap-3">
                        {catServices.map((service, index) => (
                          <ServiceCard
                            key={service.id}
                            service={service}
                            meta={meta}
                            addOns={addOnsByService[service.id] ?? []}
                            isPopular={index === 0 && catServices.length > 1}
                          />
                        ))}
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <p className="text-sm text-stone-400">No services available at this time.</p>
            )}
          </section>

          <Separator className="my-10" />

          {/* ── Gallery — placeholder until Supabase Storage integration ── */}
          <section>
            <SectionHeading eyebrow="Portfolio" title="Our work" />
            <div
              className="mb-4 grid grid-cols-3 gap-2 overflow-hidden rounded-2xl"
              style={{ gridTemplateRows: "140px 100px" }}
            >
              <div className="col-span-2 row-span-1 flex items-center justify-center bg-rose-50">
                <LuCamera className="h-6 w-6 text-rose-200" />
              </div>
              <div className="col-span-1 row-span-2 flex items-center justify-center bg-amber-50">
                <LuCamera className="h-6 w-6 text-amber-200" />
              </div>
              <div className="flex items-center justify-center bg-violet-50">
                <LuCamera className="h-5 w-5 text-violet-200" />
              </div>
              <div className="flex items-center justify-center bg-teal-50">
                <LuCamera className="h-5 w-5 text-teal-200" />
              </div>
            </div>
            <p className="mb-3 text-center text-xs text-stone-400">
              Portfolio photos coming soon — follow us for our latest work
            </p>
            {instagramHandle && (
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full border border-stone-200 bg-white py-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
              >
                <LuInstagram className="h-4 w-4 text-rose-500" />@{instagramHandle}
              </a>
            )}
          </section>

          {/* ── Reviews — only rendered when featured reviews exist ── */}
          {featuredReviews.length > 0 && (
            <>
              <Separator className="my-10" />
              <section>
                <SectionHeading eyebrow="Client Love" title="What they're saying" />
                <div className="flex flex-col gap-4">
                  {featuredReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              </section>
            </>
          )}

          <Separator className="my-10" />

          {/* ── About ── */}
          <section>
            <SectionHeading eyebrow="About" title={`Meet ${studio.firstName}`} />
            <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-100">
              <div className="absolute top-0 right-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-rose-50/60" />
              <div className="relative flex gap-4">
                <Avatar className="h-12 w-12 shrink-0 ring-2 ring-rose-100">
                  <AvatarImage src={studio.avatarUrl ?? undefined} alt={studio.firstName} />
                  <AvatarFallback className="bg-rose-50 text-sm font-semibold text-rose-400">
                    {studio.firstName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-stone-900">{studio.firstName}</p>
                  {locationLabel && <p className="text-xs text-stone-400">{locationLabel}</p>}
                </div>
              </div>
              <p className="relative mt-4 text-sm leading-relaxed text-stone-600">
                {studio.bio ||
                  `Hi, I'm ${studio.firstName} — welcome to ${studio.name}. Every appointment is personalized to you.`}
              </p>
              <div className="relative mt-4 flex flex-wrap gap-2">
                {["Lash Certified", "Permanent Jewelry", "Crochet Styles", "Consulting"].map(
                  (tag) => (
                    <Badge key={tag} variant="outline" className="text-stone-500">
                      <LuSparkles className="h-3 w-3 text-rose-400" />
                      {tag}
                    </Badge>
                  ),
                )}
              </div>
            </div>
          </section>

          <Separator className="my-10" />

          {/* ── How it works ── */}
          <section>
            <SectionHeading eyebrow="Process" title="How it works" />
            <div className="flex flex-col gap-3">
              {HOW_IT_WORKS.map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100"
                >
                  <span className="font-display mt-0.5 text-2xl font-light leading-none text-rose-200">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-medium text-stone-900">{item.title}</p>
                    <p className="mt-0.5 text-sm text-stone-500">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Rewards — gated on studio.rewardsEnabled ── */}
          {studio.rewardsEnabled && (
            <>
              <Separator className="my-10" />
              <section>
                <SectionHeading eyebrow="Loyalty" title="Earn rewards" />
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-rose-50 p-6 ring-1 ring-amber-100">
                  <div className="absolute top-0 right-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-amber-100/40" />
                  <div className="relative flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                      <LuGift className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-stone-900">Earn points with every visit</p>
                      <p className="mt-1 text-sm text-stone-600">
                        Collect points on every service and redeem them for discounts, free add-ons,
                        and exclusive perks. The more you visit, the more you earn.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {["Points per dollar", "Birthday bonus", "Referral rewards"].map((perk) => (
                          <Badge
                            key={perk}
                            variant="outline"
                            className="border-amber-200 text-stone-500"
                          >
                            <LuSparkles className="h-3 w-3 text-amber-500" />
                            {perk}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── Referral ── */}
          <Separator className="my-10" />
          <section>
            <SectionHeading eyebrow="Spread the love" title="Share with a friend" />
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 p-6 ring-1 ring-rose-100">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                  <LuUsers className="h-5 w-5 text-rose-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-stone-900">Refer a friend, earn a reward</p>
                  <p className="mt-1 mb-4 text-sm text-stone-600">
                    Know someone who would love {studio.name}? Share your link — both of you get
                    love when they book their first session.
                  </p>
                  <CopyLinkButton slug={slug} instagramHandle={instagramHandle} />
                </div>
              </div>
            </div>
          </section>

          {/* ── Policies — gated on at least one fee/window being configured ── */}
          {hasPolicies && (
            <>
              <Separator className="my-10" />
              <section>
                <SectionHeading eyebrow="Policies" title="Good to know" />
                <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
                  {/* Approval-based booking row — always shown when Policies section renders */}
                  <div className="flex items-start gap-3 p-4">
                    <LuCalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    <div>
                      <p className="text-sm font-medium text-stone-800">Approval-based booking</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        All bookings are reviewed and confirmed by Trini. You&apos;ll hear back
                        within 24 hours of submitting your request.
                      </p>
                    </div>
                  </div>

                  {studio.policies.cancellationWindowHours !== null && (
                    <div className="flex items-start gap-3 p-4">
                      <LuShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      <div>
                        <p className="text-sm font-medium text-stone-800">
                          {studio.policies.cancellationWindowHours}-hour cancellation policy
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          Please cancel at least {studio.policies.cancellationWindowHours} hours
                          before your appointment to avoid a fee.
                          {studio.policies.cancellationFeeInCents
                            ? ` A ${formatPrice(studio.policies.cancellationFeeInCents)} fee applies for late cancellations.`
                            : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {studio.policies.noShowFeeInCents !== null && (
                    <div className="flex items-start gap-3 p-4">
                      <LuShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      <div>
                        <p className="text-sm font-medium text-stone-800">No-show fee</p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          A {formatPrice(studio.policies.noShowFeeInCents)} fee applies for missed
                          appointments without notice.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ── FAQ — populated from intake.prep text per category ── */}
          {faqItems.length > 0 && (
            <>
              <Separator className="my-10" />
              <section>
                <SectionHeading eyebrow="FAQ" title="Prep & questions" />
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
                  <Accordion type="single" collapsible className="px-4">
                    {faqItems.map((item, i) => (
                      <AccordionItem key={i} value={`faq-${i}`}>
                        <AccordionTrigger className="text-sm font-medium text-stone-800 hover:no-underline">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm leading-relaxed text-stone-500">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </section>
            </>
          )}

          {/* ── Contact CTA ── */}
          <Separator className="my-10" />
          <section className="py-2 text-center">
            <SectionHeading eyebrow="Questions?" title="Get in touch" />
            <p className="mx-auto mb-6 max-w-xs text-sm text-stone-500">
              Not sure which service is right for you? Send a message before booking — we&apos;re
              happy to help.
            </p>
            {instagramHandle ? (
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-95"
              >
                <LuMessageCircle className="h-4 w-4" />
                Message on Instagram
              </a>
            ) : (
              <p className="text-xs text-stone-400">Reach out via DM to get started.</p>
            )}
          </section>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-stone-200 bg-white py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 text-center">
          <TCLogo size={28} className="text-stone-300" />
          <p className="text-xs text-stone-400">© T Creative Studio</p>
          <Link
            href="/"
            className="text-xs text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline"
          >
            tcreativestudio.com
          </Link>
        </div>
      </footer>
    </div>
  );
}
