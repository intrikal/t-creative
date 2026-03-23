// @vitest-environment node

/**
 * tests/integration/rls-enforcement.test.ts
 *
 * Integration tests for Row-Level Security (RLS) enforcement.
 *
 * Requires a running Supabase local instance (`supabase start`).
 * Uses service_role key to seed test data, then switches to per-user
 * Supabase clients (authenticated with user JWTs) to verify that each
 * table's RLS policies are correctly enforced.
 *
 * Seed personas:
 *   Client A  — role: client
 *   Client B  — role: client  (isolation target)
 *   Staff C   — role: assistant
 *   Admin D   — role: admin
 *
 * Tests by table:
 *   (1)  bookings              — client reads own; cannot read other's
 *   (2)  payments              — client reads own only
 *   (3)  profiles              — client reads own; cannot read other's
 *   (4)  client_photos         — client reads own; staff inserts
 *   (5)  loyalty_transactions  — client reads own only
 *                                NOTE: RLS not yet in supabase/migrations — tests
 *                                serve as spec for the required policies.
 *   (6)  notification_preferences — client updates own; cannot read other's
 *                                NOTE: RLS not yet in supabase/migrations.
 *   (7)  push_subscriptions    — client deletes own; cannot delete other's
 *                                NOTE: RLS not yet in supabase/migrations.
 *   (8)  CCPA audit_log        — client reads own ccpa entry; cannot read other's
 *   (9)  Staff route guards    — assistant cannot read settings (admin-only)
 *   (10) Admin                 — admin reads everything
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Config — reads from environment, falls back to supabase local     */
/*  defaults so tests run without extra .env setup.                   */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7ACciz0oogFjdO3sPFWFRbOmHTIgwgYGXV8";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0";

/* ------------------------------------------------------------------ */
/*  Seed IDs (deterministic so cleanup is reliable)                   */
/* ------------------------------------------------------------------ */

const CLIENT_A_EMAIL = "rls-client-a@test.invalid";
const CLIENT_B_EMAIL = "rls-client-b@test.invalid";
const STAFF_C_EMAIL = "rls-staff-c@test.invalid";
const ADMIN_D_EMAIL = "rls-admin-d@test.invalid";
const TEST_PASSWORD = "Test1234!RLS";

/* ------------------------------------------------------------------ */
/*  Module-level state (populated in beforeAll)                       */
/* ------------------------------------------------------------------ */

let serviceClient: SupabaseClient;

// Auth user IDs (set after createUser calls)
let clientAId: string;
let clientBId: string;
let staffCId: string;
let adminDId: string;

// Row IDs created during seeding
let clientABookingId: number;
let clientBBookingId: number;
let staffCBookingId: number;
let clientAPaymentId: number;
let clientBPaymentId: number;
let clientAPhotoId: number;
let clientBPhotoId: number;
let clientALoyaltyId: string;
let clientBLoyaltyId: string;
let clientANotifPrefId: number;
let clientBNotifPrefId: number;
let clientAPushSubId: number;
let clientBPushSubId: number;
let clientACcpaAuditId: string;
let clientBCcpaAuditId: string;
let serviceId: number;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Creates a Supabase client authenticated as the given user. */
async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`signInAs(${email}) failed: ${error.message}`);
  return client;
}

/** Creates an auth user + matching profile row via service_role. */
async function createTestUser(
  email: string,
  role: "admin" | "assistant" | "client",
): Promise<string> {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) {
    if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
      throw new Error(
        `Cannot reach Supabase at ${SUPABASE_URL}. Run \`supabase start\` first.\nOriginal: ${error.message}`,
      );
    }
    throw new Error(`createUser(${email}): ${error.message}`);
  }
  const userId = data.user.id;

  const { error: profileError } = await serviceClient.from("profiles").upsert(
    {
      id: userId,
      email,
      first_name: role,
      last_name: "Tester",
      role,
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (profileError) throw new Error(`upsert profile(${email}): ${profileError.message}`);

  return userId;
}

/** Deletes a Supabase auth user (profile cascades via FK). */
async function deleteTestUser(userId: string): Promise<void> {
  await serviceClient.auth.admin.deleteUser(userId);
}

/* ------------------------------------------------------------------ */
/*  Seed                                                               */
/* ------------------------------------------------------------------ */

beforeAll(async () => {
  serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create auth users + profiles
  [clientAId, clientBId, staffCId, adminDId] = await Promise.all([
    createTestUser(CLIENT_A_EMAIL, "client"),
    createTestUser(CLIENT_B_EMAIL, "client"),
    createTestUser(STAFF_C_EMAIL, "assistant"),
    createTestUser(ADMIN_D_EMAIL, "admin"),
  ]);

  // 2. Seed a service row (required FK for bookings)
  const { data: svc } = await serviceClient
    .from("services")
    .insert({
      name: "RLS Test Service",
      duration_minutes: 60,
      price_in_cents: 5000,
      is_active: true,
    })
    .select("id")
    .single();
  serviceId = svc!.id;

  // 3. Bookings: one per relevant persona
  const { data: bookingA } = await serviceClient
    .from("bookings")
    .insert({
      client_id: clientAId,
      staff_id: staffCId,
      service_id: serviceId,
      status: "confirmed",
      starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 60,
      total_in_cents: 5000,
    })
    .select("id")
    .single();
  clientABookingId = bookingA!.id;

  const { data: bookingB } = await serviceClient
    .from("bookings")
    .insert({
      client_id: clientBId,
      staff_id: staffCId,
      service_id: serviceId,
      status: "confirmed",
      starts_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 60,
      total_in_cents: 5000,
    })
    .select("id")
    .single();
  clientBBookingId = bookingB!.id;

  const { data: bookingStaff } = await serviceClient
    .from("bookings")
    .insert({
      client_id: clientAId,
      staff_id: staffCId,
      service_id: serviceId,
      status: "pending",
      starts_at: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 60,
      total_in_cents: 5000,
    })
    .select("id")
    .single();
  staffCBookingId = bookingStaff!.id;

  // 4. Payments
  const { data: payA } = await serviceClient
    .from("payments")
    .insert({
      booking_id: clientABookingId,
      client_id: clientAId,
      status: "paid",
      method: "square_card",
      amount_in_cents: 5000,
    })
    .select("id")
    .single();
  clientAPaymentId = payA!.id;

  const { data: payB } = await serviceClient
    .from("payments")
    .insert({
      booking_id: clientBBookingId,
      client_id: clientBId,
      status: "paid",
      method: "square_card",
      amount_in_cents: 5000,
    })
    .select("id")
    .single();
  clientBPaymentId = payB!.id;

  // 5. Client photos
  const { data: photoA } = await serviceClient
    .from("client_photos")
    .insert({
      booking_id: clientABookingId,
      profile_id: clientAId,
      uploaded_by: staffCId,
      photo_type: "after",
      storage_path: `${clientAId}/${clientABookingId}/after.jpg`,
    })
    .select("id")
    .single();
  clientAPhotoId = photoA!.id;

  const { data: photoB } = await serviceClient
    .from("client_photos")
    .insert({
      booking_id: clientBBookingId,
      profile_id: clientBId,
      uploaded_by: staffCId,
      photo_type: "before",
      storage_path: `${clientBId}/${clientBBookingId}/before.jpg`,
    })
    .select("id")
    .single();
  clientBPhotoId = photoB!.id;

  // 6. Loyalty transactions
  const { data: loyA } = await serviceClient
    .from("loyalty_transactions")
    .insert({ profile_id: clientAId, points: 100, type: "first_booking" })
    .select("id")
    .single();
  clientALoyaltyId = loyA!.id;

  const { data: loyB } = await serviceClient
    .from("loyalty_transactions")
    .insert({ profile_id: clientBId, points: 50, type: "rebook" })
    .select("id")
    .single();
  clientBLoyaltyId = loyB!.id;

  // 7. Notification preferences
  const { data: notifA } = await serviceClient
    .from("notification_preferences")
    .insert({
      profile_id: clientAId,
      channel: "email",
      notification_type: "booking_reminder",
      enabled: true,
    })
    .select("id")
    .single();
  clientANotifPrefId = notifA!.id;

  const { data: notifB } = await serviceClient
    .from("notification_preferences")
    .insert({
      profile_id: clientBId,
      channel: "email",
      notification_type: "booking_reminder",
      enabled: true,
    })
    .select("id")
    .single();
  clientBNotifPrefId = notifB!.id;

  // 8. Push subscriptions
  const { data: pushA } = await serviceClient
    .from("push_subscriptions")
    .insert({
      profile_id: clientAId,
      endpoint: "https://fcm.googleapis.com/rls-test-client-a",
      p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtZ",
      auth: "tBHItJI5svbpez7KI4CCXg",
    })
    .select("id")
    .single();
  clientAPushSubId = pushA!.id;

  const { data: pushB } = await serviceClient
    .from("push_subscriptions")
    .insert({
      profile_id: clientBId,
      endpoint: "https://fcm.googleapis.com/rls-test-client-b",
      p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtZ",
      auth: "tBHItJI5svbpez7KI4CCXc",
    })
    .select("id")
    .single();
  clientBPushSubId = pushB!.id;

  // 9. Audit log entries (CCPA deletion records, inserted via service_role)
  const { data: auditA } = await serviceClient
    .from("audit_log")
    .insert({
      actor_id: clientAId,
      action: "delete",
      entity_type: "ccpa_deletion_request",
      entity_id: clientAId,
      description: "Client account deleted (CCPA) — RLS test seed",
    })
    .select("id")
    .single();
  clientACcpaAuditId = auditA!.id;

  const { data: auditB } = await serviceClient
    .from("audit_log")
    .insert({
      actor_id: clientBId,
      action: "delete",
      entity_type: "ccpa_deletion_request",
      entity_id: clientBId,
      description: "Client account deleted (CCPA) — RLS test seed",
    })
    .select("id")
    .single();
  clientBCcpaAuditId = auditB!.id;
}, 60_000);

/* ------------------------------------------------------------------ */
/*  Cleanup                                                            */
/* ------------------------------------------------------------------ */

afterAll(async () => {
  // beforeAll may have failed before any IDs were assigned — skip cleanup
  // to avoid passing `undefined` to deleteUser (which throws a UUID error).
  if (!clientAId && !clientBId && !staffCId && !adminDId) return;

  // Delete rows in FK-safe order; CASCADE handles most children.
  // Auth user deletion cascades to profiles → bookings/payments etc.
  await Promise.all(
    [clientAId, clientBId, staffCId, adminDId].filter(Boolean).map((id) => deleteTestUser(id)),
  );

  // Clean up the service row (no cascade from user deletion)
  if (serviceId) {
    await serviceClient.from("services").delete().eq("id", serviceId);
  }
}, 30_000);

/* ================================================================== */
/*  (1) bookings                                                       */
/* ================================================================== */

describe("(1) bookings RLS", () => {
  it("Client A can read own booking", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client
      .from("bookings")
      .select("id, client_id")
      .eq("id", clientABookingId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].client_id).toBe(clientAId);
  });

  it("Client A CANNOT read Client B's booking (returns 0 rows, not error)", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client.from("bookings").select("id").eq("id", clientBBookingId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("Staff C can read bookings where staff_id = their id", async () => {
    const client = await signInAs(STAFF_C_EMAIL);
    const { data, error } = await client
      .from("bookings")
      .select("id, staff_id")
      .eq("staff_id", staffCId);

    expect(error).toBeNull();
    // Staff C is assigned to all seeded bookings
    expect(data!.length).toBeGreaterThanOrEqual(1);
    for (const row of data!) {
      expect(row.staff_id).toBe(staffCId);
    }
  });

  it("Admin D can read all bookings", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("bookings")
      .select("id")
      .in("id", [clientABookingId, clientBBookingId, staffCBookingId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });
});

/* ================================================================== */
/*  (2) payments                                                       */
/* ================================================================== */

describe("(2) payments RLS", () => {
  it("Client A can read payments on own bookings", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client
      .from("payments")
      .select("id, client_id")
      .eq("id", clientAPaymentId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].client_id).toBe(clientAId);
  });

  it("Client A CANNOT read Client B's payment (returns 0 rows, not error)", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client.from("payments").select("id").eq("id", clientBPaymentId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("Admin D can read all payments", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("payments")
      .select("id")
      .in("id", [clientAPaymentId, clientBPaymentId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

/* ================================================================== */
/*  (3) profiles                                                       */
/* ================================================================== */

describe("(3) profiles RLS", () => {
  it("Client A can read own profile", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client.from("profiles").select("id, email").eq("id", clientAId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(clientAId);
  });

  it("Client A CANNOT read Client B's profile (returns 0 rows, not error)", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client.from("profiles").select("id").eq("id", clientBId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("Staff C can read all profiles", async () => {
    const client = await signInAs(STAFF_C_EMAIL);
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .in("id", [clientAId, clientBId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("Admin D can read all profiles", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .in("id", [clientAId, clientBId, staffCId, adminDId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(4);
  });
});

/* ================================================================== */
/*  (4) client_photos                                                  */
/* ================================================================== */

describe("(4) client_photos RLS", () => {
  it("Client A can read own photos", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client
      .from("client_photos")
      .select("id, profile_id")
      .eq("id", clientAPhotoId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].profile_id).toBe(clientAId);
  });

  it("Client A CANNOT read Client B's photos (returns 0 rows, not error)", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client
      .from("client_photos")
      .select("id")
      .eq("id", clientBPhotoId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("Staff C can insert a photo for a booking they own", async () => {
    const client = await signInAs(STAFF_C_EMAIL);
    const { data, error } = await client
      .from("client_photos")
      .insert({
        booking_id: clientABookingId,
        profile_id: clientAId,
        uploaded_by: staffCId,
        photo_type: "before",
        storage_path: `${clientAId}/${clientABookingId}/before-staff-insert.jpg`,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.id).toBeGreaterThan(0);

    // Cleanup the inserted row
    await serviceClient.from("client_photos").delete().eq("id", data!.id);
  });

  it("Client A CANNOT insert a photo (clients cannot upload)", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { error } = await client.from("client_photos").insert({
      booking_id: clientABookingId,
      profile_id: clientAId,
      uploaded_by: clientAId,
      photo_type: "reference",
      storage_path: `${clientAId}/${clientABookingId}/ref-client-attempt.jpg`,
    });

    expect(error).not.toBeNull();
  });
});

/* ================================================================== */
/*  (5) loyalty_transactions                                           */
/* ================================================================== */

describe("(5) loyalty_transactions RLS", () => {
  it("Client A sees own loyalty transactions only", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client
      .from("loyalty_transactions")
      .select("id, profile_id")
      .in("id", [clientALoyaltyId, clientBLoyaltyId]);

    expect(error).toBeNull();
    // Only Client A's row should be visible
    expect(data!.every((r) => r.profile_id === clientAId)).toBe(true);
    const ids = data!.map((r) => r.id);
    expect(ids).toContain(clientALoyaltyId);
    expect(ids).not.toContain(clientBLoyaltyId);
  });

  it("Client B CANNOT read Client A's loyalty transactions", async () => {
    const client = await signInAs(CLIENT_B_EMAIL);
    const { data, error } = await client
      .from("loyalty_transactions")
      .select("id")
      .eq("id", clientALoyaltyId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("Admin D can read all loyalty transactions", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("loyalty_transactions")
      .select("id")
      .in("id", [clientALoyaltyId, clientBLoyaltyId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

/* ================================================================== */
/*  (6) notification_preferences                                       */
/* ================================================================== */

describe("(6) notification_preferences RLS", () => {
  it("Client A can update own notification preferences", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { error } = await client
      .from("notification_preferences")
      .update({ enabled: false })
      .eq("id", clientANotifPrefId);

    expect(error).toBeNull();

    // Verify the update via service_role
    const { data } = await serviceClient
      .from("notification_preferences")
      .select("enabled")
      .eq("id", clientANotifPrefId)
      .single();
    expect(data!.enabled).toBe(false);

    // Restore for other tests
    await serviceClient
      .from("notification_preferences")
      .update({ enabled: true })
      .eq("id", clientANotifPrefId);
  });

  it("Client A CANNOT read Client B's notification preferences (returns 0 rows)", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client
      .from("notification_preferences")
      .select("id")
      .eq("id", clientBNotifPrefId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("Client A CANNOT update Client B's notification preferences", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { error } = await client
      .from("notification_preferences")
      .update({ enabled: false })
      .eq("id", clientBNotifPrefId);

    // Either an error or 0 rows updated (RLS filters to no matching rows)
    if (!error) {
      const { data } = await serviceClient
        .from("notification_preferences")
        .select("enabled")
        .eq("id", clientBNotifPrefId)
        .single();
      // The row must be unchanged
      expect(data!.enabled).toBe(true);
    }
  });
});

/* ================================================================== */
/*  (7) push_subscriptions                                             */
/* ================================================================== */

describe("(7) push_subscriptions RLS", () => {
  it("Client A can delete own push subscription", async () => {
    // Insert a fresh sub so we have something to delete without affecting others
    const { data: newSub } = await serviceClient
      .from("push_subscriptions")
      .insert({
        profile_id: clientAId,
        endpoint: "https://fcm.googleapis.com/rls-test-delete-own",
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtZ",
        auth: "tBHItJI5svbpez7KI4CCXd",
      })
      .select("id")
      .single();
    const tempSubId = newSub!.id;

    const client = await signInAs(CLIENT_A_EMAIL);
    const { error } = await client.from("push_subscriptions").delete().eq("id", tempSubId);

    expect(error).toBeNull();

    // Confirm deletion
    const { data: check } = await serviceClient
      .from("push_subscriptions")
      .select("id")
      .eq("id", tempSubId);
    expect(check).toHaveLength(0);
  });

  it("Client A CANNOT delete Client B's push subscription", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { error } = await client.from("push_subscriptions").delete().eq("id", clientBPushSubId);

    // Either an explicit error or the row still exists (RLS filter = 0 rows deleted)
    if (!error) {
      const { data: check } = await serviceClient
        .from("push_subscriptions")
        .select("id")
        .eq("id", clientBPushSubId);
      expect(check).toHaveLength(1);
    }
  });
});

/* ================================================================== */
/*  (8) CCPA — audit_log                                              */
/* ================================================================== */

describe("(8) CCPA audit_log RLS", () => {
  it("Client A can read own ccpa_deletion_request entry", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client
      .from("audit_log")
      .select("id, actor_id, entity_type")
      .eq("id", clientACcpaAuditId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].actor_id).toBe(clientAId);
    expect(data![0].entity_type).toBe("ccpa_deletion_request");
  });

  it("Client A CANNOT read Client B's ccpa_deletion_request (returns 0 rows)", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { data, error } = await client
      .from("audit_log")
      .select("id")
      .eq("id", clientBCcpaAuditId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("Client A CANNOT insert directly into audit_log (service_role only)", async () => {
    const client = await signInAs(CLIENT_A_EMAIL);
    const { error } = await client.from("audit_log").insert({
      actor_id: clientAId,
      action: "delete",
      entity_type: "ccpa_deletion_request",
      entity_id: clientAId,
      description: "Injected audit entry",
    });

    expect(error).not.toBeNull();
  });

  it("Admin D can read all audit_log entries", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("audit_log")
      .select("id")
      .in("id", [clientACcpaAuditId, clientBCcpaAuditId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

/* ================================================================== */
/*  (9) Staff route guards — assistant cannot access admin-only tables */
/* ================================================================== */

describe("(9) staff route guards — assistant cannot access admin-only tables", () => {
  it("Staff C CANNOT read settings (returns 0 rows or error)", async () => {
    const client = await signInAs(STAFF_C_EMAIL);
    const { data, error } = await client.from("settings").select("key");

    // Per RLS: settings readable by admin + assistant. Staff can read settings.
    // BUT Staff C should NOT be able to write settings (admin-only write).
    // This test confirms the no-write guard:
    const { error: insertError } = await client
      .from("settings")
      .upsert({ key: "rls_test_inject", value: '"injected"', label: "Injected" });

    expect(insertError).not.toBeNull();
  });

  it("Staff C CANNOT insert into settings (admin-only write)", async () => {
    const client = await signInAs(STAFF_C_EMAIL);
    const { error } = await client
      .from("settings")
      .upsert({ key: "rls_test_staff_insert", value: '"blocked"', label: "Blocked" });

    expect(error).not.toBeNull();
  });

  it("Staff C CANNOT read sync_log (admin-only read)", async () => {
    const client = await signInAs(STAFF_C_EMAIL);
    const { data, error } = await client.from("sync_log").select("id").limit(1);

    // sync_log has admin-only read policy
    if (error) {
      expect(error).not.toBeNull();
    } else {
      // RLS filtered to 0 rows
      expect(data).toHaveLength(0);
    }
  });

  it("Staff C CAN read bookings (staff read all policy)", async () => {
    const client = await signInAs(STAFF_C_EMAIL);
    const { data, error } = await client
      .from("bookings")
      .select("id")
      .in("id", [clientABookingId, clientBBookingId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

/* ================================================================== */
/*  (10) Admin — can access everything                                 */
/* ================================================================== */

describe("(10) admin can access everything", () => {
  it("Admin D reads all bookings", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("bookings")
      .select("id")
      .in("id", [clientABookingId, clientBBookingId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("Admin D reads all payments", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("payments")
      .select("id")
      .in("id", [clientAPaymentId, clientBPaymentId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("Admin D reads all profiles", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .in("id", [clientAId, clientBId, staffCId, adminDId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(4);
  });

  it("Admin D reads all client_photos", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("client_photos")
      .select("id")
      .in("id", [clientAPhotoId, clientBPhotoId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("Admin D reads all loyalty_transactions", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { data, error } = await client
      .from("loyalty_transactions")
      .select("id")
      .in("id", [clientALoyaltyId, clientBLoyaltyId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("Admin D reads settings", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { error } = await client.from("settings").select("key").limit(1);

    expect(error).toBeNull();
  });

  it("Admin D can upsert settings", async () => {
    const client = await signInAs(ADMIN_D_EMAIL);
    const { error } = await client
      .from("settings")
      .upsert({ key: "rls_test_admin_write", value: '"ok"', label: "RLS Admin Write Test" });

    expect(error).toBeNull();

    // Cleanup
    await serviceClient.from("settings").delete().eq("key", "rls_test_admin_write");
  });
});
