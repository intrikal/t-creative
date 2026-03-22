/**
 * Server actions for the client-facing commission flow.
 *
 * Custom commissions (crochet, 3D printing) live in the `orders` table
 * with `productId = NULL`. They follow this lifecycle:
 *
 *   inquiry → quoted → accepted → in_progress → ready_for_pickup → completed
 *
 * The client submits a request here; Trini quotes via the Marketplace
 * dashboard; the client accepts or declines here.
 *
 * @module commissions/actions
 * @see {@link ../shop/ShopPage.tsx} — client component that surfaces these actions
 * @see {@link ../../dashboard/marketplace/actions.ts} — quoteCommission (staff side)
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { orders, profiles } from "@/db/schema";
import { CommissionReceived } from "@/emails/CommissionReceived";
import { getUser } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

import type { CommissionCategory, SubmitCommissionInput, ClientCommission } from "@/lib/types/commission.types";

export type { CommissionCategory, SubmitCommissionInput, ClientCommission } from "@/lib/types/commission.types";

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns all commission orders for the logged-in client.
 * Commission orders are identified by `productId IS NULL`.
 *
 * SELECT  id, orderNumber, category, title, description, quantity,
 *         status, quotedInCents, estimatedCompletionAt, metadata, createdAt
 * FROM    orders
 * WHERE   clientId = <current user>     ← only this client's orders
 *   AND   productId IS NULL             ← commissions have no linked product
 *                                          (regular shop orders DO have a productId)
 * ORDER BY createdAt DESC               ← newest commissions first
 *
 * No JOINs — the orders table contains all the needed fields inline.
 */
export async function getClientCommissions(): Promise<ClientCommission[]> {
  try {
    const user = await getUser();

    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        category: orders.category,
        title: orders.title,
        description: orders.description,
        quantity: orders.quantity,
        status: orders.status,
        quotedInCents: orders.quotedInCents,
        estimatedCompletionAt: orders.estimatedCompletionAt,
        metadata: orders.metadata,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.clientId, user.id), isNull(orders.productId)))
      .orderBy(desc(orders.createdAt));

    return rows.map((r) => ({
      ...r,
      estimatedCompletionAt: r.estimatedCompletionAt
        ? r.estimatedCompletionAt.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null,
      createdAt: r.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Creates a new commission request (status: "inquiry").
 * Sends a confirmation email to the client.
 *
 * INSERT INTO orders (orderNumber, clientId, status, category, title, ...)
 *   → creates the commission with status "inquiry"
 *   → RETURNING id so we can reference it in the confirmation email
 *
 * Then fetches the client's email from profiles to send a confirmation.
 */
const submitCommissionInputSchema = z.object({
  category: z.enum(["crochet", "3d_printing"]),
  title: z.string().min(1),
  description: z.string(),
  quantity: z.number().int().positive(),
  metadata: z
    .object({
      colors: z.string().optional(),
      size: z.string().optional(),
      material: z.string().optional(),
      deadline: z.string().optional(),
      budgetRange: z.string().optional(),
      referenceNotes: z.string().optional(),
      referenceUrls: z.array(z.string()).optional(),
      designUrls: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function submitCommissionRequest(
  input: SubmitCommissionInput,
): Promise<{ success: boolean; orderNumber?: string; error?: string }> {
  submitCommissionInputSchema.parse(input);
  const user = await getUser();

  const orderNumber = `com-${Date.now().toString(36)}`;

  const [inserted] = await db
    .insert(orders)
    .values({
      orderNumber,
      clientId: user.id,
      status: "inquiry",
      category: input.category,
      title: input.title,
      description: input.description || null,
      quantity: input.quantity,
      metadata: input.metadata ?? null,
    })
    .returning({ id: orders.id });

  trackEvent(user.id, "commission_request_submitted", {
    orderNumber,
    category: input.category,
  });

  // Send confirmation email (non-fatal)
  try {
    const [profile] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, user.id));

    if (profile?.email) {
      const bp = await getPublicBusinessProfile();
      await sendEmail({
        to: profile.email,
        subject: `Commission request received — ${bp.businessName}`,
        react: CommissionReceived({
          clientName: profile.firstName,
          orderNumber,
          title: input.title,
          category: input.category,
          businessName: bp.businessName,
        }),
        entityType: "commission_received",
        localId: String(inserted.id),
      });
    }
  } catch {
    // Non-fatal
  }

  revalidatePath("/dashboard/shop");
  return { success: true, orderNumber };
}

/**
 * Client accepts a quoted commission → status moves to "accepted".
 * Validates that the order belongs to the client and is currently quoted.
 *
 * Step 1 — Ownership check:
 *   SELECT clientId, status FROM orders WHERE id = <orderId>
 *   → verifies the order exists, belongs to this client, and is in "quoted" status
 *
 * Step 2 — Status transition:
 *   UPDATE orders SET status = 'accepted' WHERE id = <orderId>
 */
export async function acceptQuote(orderId: number): Promise<void> {
  try {
    z.number().int().positive().parse(orderId);
    const user = await getUser();

    const [order] = await db
      .select({ clientId: orders.clientId, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));

    if (!order || order.clientId !== user.id) throw new Error("Order not found");
    if (order.status !== "quoted") throw new Error("Order is not awaiting acceptance");

    await db.update(orders).set({ status: "accepted" }).where(eq(orders.id, orderId));

    trackEvent(user.id, "commission_quote_accepted", { orderId });
    revalidatePath("/dashboard/shop");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Client declines a quoted commission → status moves to "cancelled".
 * Validates that the order belongs to the client and is currently quoted.
 *
 * Step 1 — Ownership check:
 *   SELECT clientId, status FROM orders WHERE id = <orderId>
 *   → same guard as acceptQuote — must be owned by this client and in "quoted" status
 *
 * Step 2 — Status transition:
 *   UPDATE orders SET status = 'cancelled', cancelledAt = now() WHERE id = <orderId>
 */
export async function declineQuote(orderId: number): Promise<void> {
  try {
    z.number().int().positive().parse(orderId);
    const user = await getUser();

    const [order] = await db
      .select({ clientId: orders.clientId, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));

    if (!order || order.clientId !== user.id) throw new Error("Order not found");
    if (order.status !== "quoted") throw new Error("Order is not awaiting acceptance");

    await db
      .update(orders)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(orders.id, orderId));

    trackEvent(user.id, "commission_quote_declined", { orderId });
    revalidatePath("/dashboard/shop");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  File uploads                                                       */
/* ------------------------------------------------------------------ */

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const DESIGN_EXTENSIONS = new Set(["stl", "obj", "3mf", "step", "stp", "amf"]);

/**
 * Uploads a single reference image or 3D design file for a commission request.
 *
 * Images: JPEG, PNG, WebP, HEIC/HEIF — max 8 MB.
 * Design files: STL, OBJ, 3MF, STEP, AMF — max 50 MB.
 *
 * Storage path: commission-designs/{userId}/{timestamp}-{safeName}.{ext}
 * Returns the public CDN URL, original filename, and whether it's a design file.
 */
export async function uploadCommissionFile(
  formData: FormData,
): Promise<{ url: string; filename: string; isDesignFile: boolean }> {
  try {
    const user = await getUser();
    const supabase = await createClient();

    const file = formData.get("file") as File | null;
    if (!file) throw new Error("No file provided");

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isDesignFile = DESIGN_EXTENSIONS.has(ext);
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);

    if (!isImage && !isDesignFile) {
      throw new Error(
        "Unsupported file type. Upload images (JPEG, PNG, WebP) or design files (STL, OBJ, 3MF, STEP).",
      );
    }

    const maxBytes = isDesignFile ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`File too large (max ${isDesignFile ? "50 MB" : "8 MB"})`);
    }

    const safeName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const path = `commission-designs/${user.id}/${Date.now()}-${safeName}.${ext}`;

    const { error } = await supabase.storage.from("media").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(path);

    return { url: publicUrl, filename: file.name, isDesignFile };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
