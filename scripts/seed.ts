/**
 * scripts/seed.ts
 * Populates a local or staging database with realistic demo data.
 *
 * Run via:  npm run db:seed
 *
 * Required environment variables (same as migrations):
 *   DIRECT_URL — Direct Postgres connection string (port 5432)
 *
 * Guard: throws if NODE_ENV === "production".
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  profiles,
  services,
  bookings,
  payments,
  giftCards,
  promotions,
  businessHours,
  settings,
  loyaltyTransactions,
  membershipPlans,
  membershipSubscriptions,
} from "../db/schema";
import {
  createMockBooking,
  createMockClient,
  createMockPayment,
  createMockService,
} from "../lib/test-utils";

// ─── Production guard ─────────────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  throw new Error("Cannot seed production database.");
}

// ─── DB client (direct connection, no pooler) ─────────────────────────────────

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set.");
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a Date offset by `days` from today (negative = past). */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  return daysAgo(-days);
}

/** Picks a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Main seed function ───────────────────────────────────────────────────────

async function seed() {
  console.log("🌱  Seeding database…");

  // ── 1. Owner profile (Trini, admin) ────────────────────────────────────────

  const [owner] = await db
    .insert(profiles)
    .values({
      id: "00000000-0000-0000-0000-000000000001",
      role: "admin",
      firstName: "Trini",
      lastName: "Creative",
      email: "trini@tcreativestudio.com",
      phone: "+15550000001",
      displayName: "Trini",
      isVip: false,
      isActive: true,
      notifySms: true,
      notifyEmail: true,
      notifyMarketing: false,
      referralCode: "TRINI",
    })
    .returning();

  console.log("  ✓ Owner:", owner.firstName, owner.lastName);

  // ── 2. Staff profiles ───────────────────────────────────────────────────────

  const staffData = [
    {
      id: "00000000-0000-0000-0000-000000000010",
      firstName: "Maya",
      lastName: "Okafor",
      email: "maya@tcreativestudio.com",
      phone: "+15550000010",
      // 40% commission rate stored in onboardingData
      onboardingData: { commissionRate: 0.4 },
    },
    {
      id: "00000000-0000-0000-0000-000000000011",
      firstName: "Cleo",
      lastName: "Baptiste",
      email: "cleo@tcreativestudio.com",
      phone: "+15550000011",
      onboardingData: { commissionRate: 0.35 },
    },
    {
      id: "00000000-0000-0000-0000-000000000012",
      firstName: "Jade",
      lastName: "Reyes",
      email: "jade@tcreativestudio.com",
      phone: "+15550000012",
      onboardingData: { commissionRate: 0.3 },
    },
  ] as const;

  const staffRows = await db
    .insert(profiles)
    .values(
      staffData.map((s) => ({
        ...s,
        role: "assistant" as const,
        isVip: false,
        isActive: true,
        notifySms: true,
        notifyEmail: true,
        notifyMarketing: false,
      })),
    )
    .returning();

  console.log("  ✓ Staff:", staffRows.map((s) => s.firstName).join(", "));

  // ── 3. Services (8 across 3 categories) ────────────────────────────────────

  const serviceRows = await db
    .insert(services)
    .values([
      // Lash (4)
      {
        category: "lash",
        name: "Classic Full Set",
        description: "Natural-looking classic lash extension full set.",
        priceInCents: 12000,
        depositInCents: 3000,
        durationMinutes: 90,
        sortOrder: 1,
        isActive: true,
      },
      {
        category: "lash",
        name: "Hybrid Full Set",
        description: "Mix of classic and volume lashes for texture.",
        priceInCents: 14500,
        depositInCents: 3500,
        durationMinutes: 100,
        sortOrder: 2,
        isActive: true,
      },
      {
        category: "lash",
        name: "Volume Fill",
        description: "2-3 week fill for volume sets.",
        priceInCents: 8500,
        depositInCents: 2000,
        durationMinutes: 60,
        sortOrder: 3,
        isActive: true,
      },
      {
        category: "lash",
        name: "Lash Removal",
        description: "Safe professional removal of existing lash extensions.",
        priceInCents: 2500,
        depositInCents: null,
        durationMinutes: 30,
        sortOrder: 4,
        isActive: true,
      },
      // Jewelry (2)
      {
        category: "jewelry",
        name: "Custom Wire Wrap Ring",
        description: "Handcrafted wire-wrapped ring with your choice of stone.",
        priceInCents: null,
        priceMinInCents: 4500,
        priceMaxInCents: 9500,
        depositInCents: 2000,
        durationMinutes: null,
        sortOrder: 1,
        isActive: true,
      },
      {
        category: "jewelry",
        name: "Beaded Bracelet Stack",
        description: "Custom beaded bracelet set, 3-piece stack.",
        priceInCents: 6500,
        depositInCents: null,
        durationMinutes: null,
        sortOrder: 2,
        isActive: true,
      },
      // Crochet (2)
      {
        category: "crochet",
        name: "Custom Baby Blanket",
        description: "Heirloom-quality crocheted baby blanket, personalized.",
        priceInCents: null,
        priceMinInCents: 8000,
        priceMaxInCents: 15000,
        depositInCents: 4000,
        durationMinutes: null,
        sortOrder: 1,
        isActive: true,
      },
      {
        category: "crochet",
        name: "Market Tote Bag",
        description: "Handmade crochet tote in your choice of color.",
        priceInCents: 5500,
        depositInCents: null,
        durationMinutes: null,
        sortOrder: 2,
        isActive: true,
      },
    ])
    .returning();

  console.log("  ✓ Services:", serviceRows.length);

  // ── 4. Membership plan ──────────────────────────────────────────────────────

  const [lashClub] = await db
    .insert(membershipPlans)
    .values({
      name: "Lash Club",
      slug: "lash-club",
      description: "Monthly lash fill membership with member perks.",
      priceInCents: 7500,
      fillsPerCycle: 1,
      productDiscountPercent: 10,
      cycleIntervalDays: 30,
      isActive: true,
      displayOrder: 1,
      perks: ["1 lash fill/month", "10% off products", "Priority booking"],
    })
    .returning();

  // ── 5. Client profiles (25) ─────────────────────────────────────────────────

  const firstNames = [
    "Aaliyah",
    "Brianna",
    "Camille",
    "Destiny",
    "Elena",
    "Faith",
    "Grace",
    "Hailey",
    "Imani",
    "Jasmine",
    "Kezia",
    "Layla",
    "Monique",
    "Naomi",
    "Olivia",
    "Priya",
    "Quinn",
    "Renee",
    "Sasha",
    "Taylor",
    "Uma",
    "Vivian",
    "Whitney",
    "Xena",
    "Yara",
  ];
  const lastNames = [
    "Adams",
    "Brown",
    "Clark",
    "Davis",
    "Evans",
    "Foster",
    "Green",
    "Harris",
    "Irving",
    "Jackson",
    "King",
    "Lewis",
    "Moore",
    "Nelson",
    "Owens",
    "Parker",
    "Quinn",
    "Roberts",
    "Scott",
    "Thomas",
    "Upton",
    "Vance",
    "Walker",
    "Xavier",
    "Young",
  ];
  const sources = ["instagram", "tiktok", "word_of_mouth", "google_search", "referral"] as const;

  const clientInserts = firstNames.map((firstName, i) => ({
    id: `00000000-0000-0000-0001-${String(i + 1).padStart(12, "0")}`,
    role: "client" as const,
    firstName,
    lastName: lastNames[i],
    email: `${firstName.toLowerCase()}.${lastNames[i].toLowerCase()}@example.com`,
    phone: `+1555${String(1000 + i).padStart(7, "0")}`,
    source: pick(sources),
    isVip: i < 3, // first 3 are VIPs
    lifecycleStage: i < 20 ? "active" : "lapsed",
    isActive: true,
    notifySms: true,
    notifyEmail: true,
    notifyMarketing: i % 3 === 0,
    // Every other client has a birthday
    onboardingData: i % 2 === 0 ? { birthday: `198${(i % 9) + 1}-0${(i % 9) + 1}-15` } : null,
    referralCode: `${firstName.toUpperCase().slice(0, 4)}${i + 100}`,
  }));

  const clientRows = await db.insert(profiles).values(clientInserts).returning();
  console.log("  ✓ Clients:", clientRows.length);

  // ── 6. Loyalty points for 10 clients ───────────────────────────────────────

  const loyaltyInserts = clientRows.slice(0, 10).map((c, i) => ({
    profileId: c.id,
    points: (i + 1) * 50,
    type: "first_booking" as const,
    description: "Earned on first booking",
  }));

  await db.insert(loyaltyTransactions).values(loyaltyInserts);
  console.log("  ✓ Loyalty transactions:", loyaltyInserts.length);

  // ── 7. Memberships for 5 clients ───────────────────────────────────────────

  const membershipInserts = clientRows.slice(0, 5).map((c) => ({
    clientId: c.id,
    planId: lashClub.id,
    status: "active" as const,
    fillsRemainingThisCycle: 1,
    cycleStartAt: daysAgo(15),
    cycleEndsAt: daysFromNow(15),
  }));

  const membershipRows = await db
    .insert(membershipSubscriptions)
    .values(membershipInserts)
    .returning();
  console.log("  ✓ Memberships:", membershipRows.length);

  // ── 8. Bookings (40 across last 90 days) ───────────────────────────────────

  const lashServices = serviceRows.filter((s) => s.category === "lash");
  const staffIds = staffRows.map((s) => s.id);
  const statuses = [
    "completed",
    "completed",
    "completed",
    "completed", // weight toward completed
    "confirmed",
    "cancelled",
    "no_show",
  ] as const;

  const bookingInserts = Array.from({ length: 40 }, (_, i) => {
    const daysBack = Math.floor(Math.random() * 90);
    const startHour = 9 + (i % 8); // spread across 9am–5pm
    const startsAt = daysAgo(daysBack);
    startsAt.setHours(startHour, 0, 0, 0);

    const service = pick(lashServices);
    const status = pick(statuses);
    const client = clientRows[i % clientRows.length];
    const staffId = pick(staffIds);

    return {
      clientId: client.id,
      staffId,
      serviceId: service.id,
      status,
      startsAt,
      durationMinutes: service.durationMinutes ?? 60,
      totalInCents: service.priceInCents ?? 10000,
      discountInCents: 0,
      completedAt: status === "completed" ? startsAt : null,
      cancelledAt: status === "cancelled" ? startsAt : null,
      confirmedAt: ["completed", "confirmed"].includes(status) ? daysAgo(daysBack + 1) : null,
      location: "Studio",
    };
  });

  const bookingRows = await db.insert(bookings).values(bookingInserts).returning();
  console.log("  ✓ Bookings:", bookingRows.length);

  // ── 9. Payments for completed bookings ─────────────────────────────────────

  const completedBookings = bookingRows.filter((b) => b.status === "completed");
  const methods = ["cash", "square_card", "square_cash"] as const;

  const paymentInserts = completedBookings.map((b) => ({
    bookingId: b.id,
    clientId: b.clientId,
    status: "paid" as const,
    method: pick(methods),
    amountInCents: b.totalInCents,
    tipInCents: Math.random() > 0.5 ? 1000 : 0,
    refundedInCents: 0,
    taxAmountInCents: 0,
    needsManualReview: false,
    paidAt: b.completedAt ?? b.startsAt,
  }));

  const paymentRows = await db.insert(payments).values(paymentInserts).returning();
  console.log("  ✓ Payments:", paymentRows.length);

  // ── 10. Gift cards (5) ──────────────────────────────────────────────────────

  await db.insert(giftCards).values([
    // Full balance
    {
      code: "TC-GC-001",
      purchasedByClientId: clientRows[0].id,
      recipientName: "Destiny Davis",
      originalAmountInCents: 10000,
      balanceInCents: 10000,
      status: "active",
      purchasedAt: daysAgo(10),
      expiresAt: daysFromNow(355),
    },
    // Partially redeemed
    {
      code: "TC-GC-002",
      purchasedByClientId: clientRows[1].id,
      recipientName: "Grace Green",
      originalAmountInCents: 7500,
      balanceInCents: 2500,
      status: "active",
      purchasedAt: daysAgo(45),
      expiresAt: daysFromNow(320),
    },
    // Fully redeemed
    {
      code: "TC-GC-003",
      purchasedByClientId: clientRows[2].id,
      recipientName: "Hailey Harris",
      originalAmountInCents: 5000,
      balanceInCents: 0,
      status: "redeemed",
      purchasedAt: daysAgo(60),
      expiresAt: daysFromNow(305),
    },
    // Expired
    {
      code: "TC-GC-004",
      purchasedByClientId: clientRows[3].id,
      recipientName: "Imani Irving",
      originalAmountInCents: 5000,
      balanceInCents: 5000,
      status: "expired",
      purchasedAt: daysAgo(400),
      expiresAt: daysAgo(35),
    },
    // New full balance
    {
      code: "TC-GC-005",
      purchasedByClientId: clientRows[4].id,
      recipientName: "Jasmine Jackson",
      originalAmountInCents: 15000,
      balanceInCents: 15000,
      status: "active",
      purchasedAt: daysAgo(3),
      expiresAt: daysFromNow(362),
    },
  ]);

  console.log("  ✓ Gift cards: 5");

  // ── 11. Promotions (3) ──────────────────────────────────────────────────────

  await db.insert(promotions).values([
    // Active
    {
      code: "NEWCLIENT20",
      discountType: "percent",
      discountValue: 20,
      description: "20% off for new clients",
      maxUses: 100,
      redemptionCount: 12,
      isActive: true,
      startsAt: daysAgo(30),
      endsAt: daysFromNow(60),
    },
    // Expired
    {
      code: "SUMMER25",
      discountType: "percent",
      discountValue: 25,
      description: "Summer 25% off promotion",
      maxUses: 50,
      redemptionCount: 38,
      isActive: false,
      startsAt: daysAgo(120),
      endsAt: daysAgo(1),
    },
    // At max uses
    {
      code: "LAUNCH50",
      discountType: "fixed",
      discountValue: 5000,
      description: "$50 off launch special",
      maxUses: 20,
      redemptionCount: 20,
      isActive: true,
      startsAt: daysAgo(90),
      endsAt: daysFromNow(30),
    },
  ]);

  console.log("  ✓ Promotions: 3");

  // ── 12. Business hours (Mon–Sat) ────────────────────────────────────────────

  // dayOfWeek: 1 = Monday … 7 = Sunday (ISO 8601)
  await db.insert(businessHours).values([
    { dayOfWeek: 1, isOpen: true, opensAt: "09:00", closesAt: "18:00" }, // Mon
    { dayOfWeek: 2, isOpen: true, opensAt: "09:00", closesAt: "18:00" }, // Tue
    { dayOfWeek: 3, isOpen: true, opensAt: "09:00", closesAt: "18:00" }, // Wed
    { dayOfWeek: 4, isOpen: true, opensAt: "10:00", closesAt: "19:00" }, // Thu
    { dayOfWeek: 5, isOpen: true, opensAt: "10:00", closesAt: "19:00" }, // Fri
    { dayOfWeek: 6, isOpen: true, opensAt: "09:00", closesAt: "16:00" }, // Sat
    { dayOfWeek: 7, isOpen: false, opensAt: null, closesAt: null }, // Sun
  ]);

  console.log("  ✓ Business hours: 7 days");

  // ── 13. Settings ────────────────────────────────────────────────────────────

  await db.insert(settings).values([
    {
      key: "business_name",
      label: "Business Name",
      description: "Studio display name",
      value: "T Creative Studio",
    },
    {
      key: "booking.deposit_required",
      label: "Deposit Required",
      description: "Require deposit to confirm bookings",
      value: true,
    },
    {
      key: "booking.cancellation_window_hours",
      label: "Cancellation Window (hours)",
      description: "Minimum hours before appointment to cancel without penalty",
      value: 24,
    },
    {
      key: "booking.no_show_fee_cents",
      label: "No-Show Fee",
      description: "Fee charged for no-shows in cents",
      value: 2500,
    },
    {
      key: "notifications.sms_enabled",
      label: "SMS Notifications",
      description: "Send appointment reminders via SMS",
      value: true,
    },
    {
      key: "notifications.email_enabled",
      label: "Email Notifications",
      description: "Send appointment reminders via email",
      value: true,
    },
    {
      key: "notifications.reminder_hours_before",
      label: "Reminder Hours Before",
      description: "Hours before appointment to send reminder",
      value: 24,
    },
    {
      key: "loyalty.points_per_dollar",
      label: "Loyalty Points Per Dollar",
      description: "Points earned per dollar spent",
      value: 1,
    },
    {
      key: "loyalty.redemption_rate_cents",
      label: "Loyalty Redemption Rate",
      description: "Cents value of each loyalty point",
      value: 5,
    },
    {
      key: "referral.reward_cents",
      label: "Referral Reward",
      description: "Credit awarded for a successful referral in cents",
      value: 1000,
    },
  ]);

  console.log("  ✓ Settings: 10 keys");

  // ── Done ────────────────────────────────────────────────────────────────────

  console.log("\n✅  Seed complete.");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
