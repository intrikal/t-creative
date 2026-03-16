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
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { orders, profiles } from "@/db/schema";
import { CommissionReceived } from "@/emails/CommissionReceived";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CommissionCategory = "crochet" | "3d_printing";

export type SubmitCommissionInput = {
  category: CommissionCategory;
  title: string;
  description: string;
  quantity: number;
  metadata?: {
    colors?: string;
    size?: string;
    material?: string;
    deadline?: string;
    budgetRange?: string;
    referenceNotes?: string;
    /** Public URLs of uploaded reference images. */
    referenceUrls?: string[];
    /** Public URLs of uploaded 3D design files (.stl, .obj, .3mf, etc.). */
    designUrls?: string[];
  };
};

export type ClientCommission = {
  id: number;
  orderNumber: string;
  category: string | null;
  title: string;
  description: string | null;
  quantity: number;
  status: string;
  quotedInCents: number | null;
  estimatedCompletionAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns all commission orders for the logged-in client.
 * Commission orders are identified by `productId IS NULL`.
 */
export async function getClientCommissions(): Promise<ClientCommission[]> {
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
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Creates a new commission request (status: "inquiry").
 * Sends a confirmation email to the client.
 */
export async function submitCommissionRequest(
  input: SubmitCommissionInput,
): Promise<{ success: boolean; orderNumber?: string; error?: string }> {
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
      await sendEmail({
        to: profile.email,
        subject: "Commission request received — T Creative",
        react: CommissionReceived({
          clientName: profile.firstName,
          orderNumber,
          title: input.title,
          category: input.category,
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
 */
export async function acceptQuote(orderId: number): Promise<void> {
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
}

/**
 * Client declines a quoted commission → status moves to "cancelled".
 * Validates that the order belongs to the client and is currently quoted.
 */
export async function declineQuote(orderId: number): Promise<void> {
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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
}
