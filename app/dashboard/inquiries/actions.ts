/**
 * Server actions for the Inquiries dashboard (`/dashboard/inquiries`).
 *
 * Handles two distinct inquiry types:
 * - **General inquiries** — contact-form submissions stored in `inquiries`.
 * - **Product inquiries** — product-specific requests stored in `product_inquiries`,
 *   LEFT JOINed to `products` for title/category metadata.
 *
 * Every action is auth-gated via Supabase `getUser()`. Mutations call
 * `revalidatePath` so the Next.js server component re-fetches fresh data.
 *
 * Timestamps are serialised to ISO strings before crossing the server → client
 * boundary to avoid Next.js serialisation errors with `Date` objects.
 *
 * @module inquiries/actions
 * @see {@link ../InquiriesPage.tsx} — client component consuming these actions
 * @see {@link ../components/GeneralDetailDialog.tsx} — detail modal for general inquiries
 * @see {@link ../components/ProductDetailDialog.tsx} — detail modal for product inquiries
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { inquiries, productInquiries, products } from "@/db/schema";
import { InquiryReply } from "@/emails/InquiryReply";
import { ProductQuote } from "@/emails/ProductQuote";
import { sendEmail } from "@/lib/resend";
import { createClient as createSupabaseClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type InquiryRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  interest: "lash" | "jewelry" | "crochet" | "consulting" | "3d_printing" | "aesthetics" | null;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  staffReply: string | null;
  repliedAt: string | null;
  createdAt: string;
};

export type ProductInquiryRow = {
  id: number;
  clientName: string;
  email: string;
  phone: string | null;
  productId: number;
  productTitle: string;
  productCategory: string;
  message: string | null;
  customizations: string | null;
  status: "new" | "contacted" | "quote_sent" | "in_progress" | "completed";
  quantity: number;
  quotedInCents: number | null;
  internalNotes: string | null;
  contactedAt: string | null;
  quoteSentAt: string | null;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getInquiries(): Promise<InquiryRow[]> {
  await getUser();

  const rows = await db
    .select({
      id: inquiries.id,
      name: inquiries.name,
      email: inquiries.email,
      phone: inquiries.phone,
      interest: inquiries.interest,
      message: inquiries.message,
      status: inquiries.status,
      staffReply: inquiries.staffReply,
      repliedAt: inquiries.repliedAt,
      createdAt: inquiries.createdAt,
    })
    .from(inquiries)
    .orderBy(desc(inquiries.createdAt));

  return rows.map((r) => ({
    ...r,
    repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getProductInquiries(): Promise<ProductInquiryRow[]> {
  await getUser();

  const rows = await db
    .select({
      id: productInquiries.id,
      clientName: productInquiries.clientName,
      email: productInquiries.email,
      phone: productInquiries.phone,
      productId: productInquiries.productId,
      productTitle: products.title,
      productCategory: products.category,
      message: productInquiries.message,
      customizations: productInquiries.customizations,
      status: productInquiries.status,
      quantity: productInquiries.quantity,
      quotedInCents: productInquiries.quotedInCents,
      internalNotes: productInquiries.internalNotes,
      contactedAt: productInquiries.contactedAt,
      quoteSentAt: productInquiries.quoteSentAt,
      createdAt: productInquiries.createdAt,
    })
    .from(productInquiries)
    .leftJoin(products, eq(productInquiries.productId, products.id))
    .orderBy(desc(productInquiries.createdAt));

  return rows.map((r) => ({
    ...r,
    productTitle: r.productTitle ?? "Unknown Product",
    productCategory: r.productCategory ?? "",
    contactedAt: r.contactedAt ? r.contactedAt.toISOString() : null,
    quoteSentAt: r.quoteSentAt ? r.quoteSentAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/* ------------------------------------------------------------------ */
/*  Mutations — General Inquiries                                      */
/* ------------------------------------------------------------------ */

export async function updateInquiryStatus(
  id: number,
  status: "new" | "read" | "replied" | "archived",
) {
  await getUser();
  await db.update(inquiries).set({ status }).where(eq(inquiries.id, id));
  revalidatePath("/dashboard/inquiries");
}

export async function replyToInquiry(id: number, replyText: string) {
  await getUser();
  await db
    .update(inquiries)
    .set({
      staffReply: replyText,
      repliedAt: new Date(),
      status: "replied",
    })
    .where(eq(inquiries.id, id));

  // Send reply notification email (non-fatal)
  try {
    const [inquiry] = await db
      .select({ email: inquiries.email, name: inquiries.name, message: inquiries.message })
      .from(inquiries)
      .where(eq(inquiries.id, id));

    if (inquiry?.email) {
      await sendEmail({
        to: inquiry.email,
        subject: "Reply to your inquiry — T Creative",
        react: InquiryReply({
          clientName: inquiry.name,
          replyText,
          originalMessage: inquiry.message,
        }),
        entityType: "inquiry_reply",
        localId: String(id),
      });
    }
  } catch {
    // Non-fatal
  }

  revalidatePath("/dashboard/inquiries");
}

export async function deleteInquiry(id: number) {
  await getUser();
  await db.delete(inquiries).where(eq(inquiries.id, id));
  revalidatePath("/dashboard/inquiries");
}

/* ------------------------------------------------------------------ */
/*  Mutations — Product Inquiries                                      */
/* ------------------------------------------------------------------ */

export async function updateProductInquiryStatus(
  id: number,
  status: "new" | "contacted" | "quote_sent" | "in_progress" | "completed",
) {
  await getUser();

  const extra: Record<string, unknown> = {};
  if (status === "contacted") extra.contactedAt = new Date();
  if (status === "quote_sent") extra.quoteSentAt = new Date();

  await db
    .update(productInquiries)
    .set({ status, ...extra })
    .where(eq(productInquiries.id, id));
  revalidatePath("/dashboard/inquiries");
}

export async function sendProductQuote(id: number, amountInCents: number) {
  await getUser();
  await db
    .update(productInquiries)
    .set({
      quotedInCents: amountInCents,
      quoteSentAt: new Date(),
      status: "quote_sent",
    })
    .where(eq(productInquiries.id, id));

  // Send quote email (non-fatal)
  try {
    const [row] = await db
      .select({
        email: productInquiries.email,
        clientName: productInquiries.clientName,
        productTitle: products.title,
      })
      .from(productInquiries)
      .leftJoin(products, eq(productInquiries.productId, products.id))
      .where(eq(productInquiries.id, id));

    if (row?.email) {
      await sendEmail({
        to: row.email,
        subject: `Quote — ${row.productTitle ?? "Your product"} — T Creative`,
        react: ProductQuote({
          clientName: row.clientName,
          productTitle: row.productTitle ?? "Your product",
          quotedAmountInCents: amountInCents,
        }),
        entityType: "product_quote",
        localId: String(id),
      });
    }
  } catch {
    // Non-fatal
  }

  revalidatePath("/dashboard/inquiries");
}

export async function deleteProductInquiry(id: number) {
  await getUser();
  await db.delete(productInquiries).where(eq(productInquiries.id, id));
  revalidatePath("/dashboard/inquiries");
}
