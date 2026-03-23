/**
 * POST /api/push/subscribe — Save a Web Push subscription for the current user.
 * DELETE /api/push/subscribe — Remove a subscription by endpoint.
 *
 * Called by the client-side push notification prompt after the user
 * grants notification permission and the browser creates a PushSubscription.
 */
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { withRequestLogger } from "@/lib/middleware/request-logger";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const POST = withRequestLogger(async function POST(request: Request) {
  try {
    const user = await getUser();
    const body = await request.json();
    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const { endpoint, keys, expirationTime } = parsed.data;

    // Upsert: if this endpoint already exists for this user, update the keys
    const [existing] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(
        and(eq(pushSubscriptions.profileId, user.id), eq(pushSubscriptions.endpoint, endpoint)),
      )
      .limit(1);

    if (existing) {
      await db
        .update(pushSubscriptions)
        .set({
          p256dh: keys.p256dh,
          auth: keys.auth,
          expiresAt: expirationTime ? new Date(expirationTime) : null,
        })
        .where(eq(pushSubscriptions.id, existing.id));
    } else {
      await db.insert(pushSubscriptions).values({
        profileId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        expiresAt: expirationTime ? new Date(expirationTime) : null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
});

export const DELETE = withRequestLogger(async function DELETE(request: Request) {
  try {
    const user = await getUser();
    const body = await request.json();
    const parsed = unsubscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.profileId, user.id),
          eq(pushSubscriptions.endpoint, parsed.data.endpoint),
        ),
      );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
});
