/**
 * Zoho Books server-side client — accounting & invoicing integration.
 *
 * Graceful degradation: when ZOHO_BOOKS_ORGANIZATION_ID is missing (or the
 * base Zoho OAuth2 credentials aren't set), all public functions are no-ops
 * so the app still boots without Zoho Books.
 *
 * Auto-creates invoices when bookings, training enrollments, or shop orders
 * are confirmed, and records payments when Square webhooks fire.
 *
 * Uses the Zoho Books v3 REST API directly via fetch (no SDK dependency).
 *
 * @module lib/zoho-books
 */
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, bookings, orders, syncLog } from "@/db/schema";
import { enrollments } from "@/db/schema";
import { isZohoAuthConfigured, getZohoAccessToken } from "@/lib/zoho-auth";

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const organizationId = process.env.ZOHO_BOOKS_ORGANIZATION_ID;
const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";

/** Whether Zoho Books integration is configured. */
export function isZohoBooksConfigured(): boolean {
  return isZohoAuthConfigured() && !!organizationId;
}

/* ------------------------------------------------------------------ */
/*  Low-level API helper                                               */
/* ------------------------------------------------------------------ */

/**
 * Low-level wrapper around the Zoho Books v3 REST API.
 *
 * Unlike the CRM API (zoho.ts), Books requires `organization_id` as a
 * query parameter on every request — appended here so callers don't
 * need to repeat it. Uses the same OAuth token from zoho-auth.ts.
 */
async function booksFetch(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<Record<string, unknown>> {
  const token = await getZohoAccessToken();
  // Append org ID as query param — handle paths that already have query strings.
  const separator = path.includes("?") ? "&" : "?";
  const url = `${apiDomain}/books/v3${path}${separator}organization_id=${organizationId}`;

  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Zoho Books ${options.method || "GET"} ${path} failed (${res.status}): ${text}`,
    );
  }

  return (await res.json()) as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Sync log helper                                                    */
/* ------------------------------------------------------------------ */

/**
 * Writes to `sync_log` for audit/debugging of Zoho Books operations.
 * Same pattern as zoho.ts — defense-in-depth: logging failures are
 * swallowed so they never break invoice creation or payment recording.
 */
async function logSync(entry: {
  status: "success" | "failed";
  entityType: string;
  localId?: string;
  remoteId?: string;
  message?: string;
  errorMessage?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await db.insert(syncLog).values({
      provider: "zoho",
      direction: "outbound",
      ...entry,
    });
  } catch {
    // Logging failure should never break the main flow
  }
}

/* ------------------------------------------------------------------ */
/*  Customer management                                                */
/* ------------------------------------------------------------------ */

/**
 * Finds or creates a Zoho Books customer by email. Stores the customer
 * ID back to `profiles.zohoCustomerId`. Returns the ID for use by
 * invoice creation — returns null on failure (caller should abort).
 *
 * NOT fire-and-forget: callers need the returned ID.
 */
export async function ensureZohoBooksCustomer(data: {
  profileId: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
}): Promise<string | null> {
  if (!isZohoBooksConfigured()) return null;

  try {
    // Check local DB first to avoid unnecessary Zoho API calls.
    // The zohoCustomerId is cached on the profile after the first lookup.
    const [profile] = await db
      .select({ zohoCustomerId: profiles.zohoCustomerId })
      .from(profiles)
      .where(eq(profiles.id, data.profileId))
      .limit(1);

    if (profile?.zohoCustomerId) return profile.zohoCustomerId;

    // Search Zoho Books by email — the API supports email as a query filter.
    // This is a second-level cache check: the customer may exist in Zoho
    // but our local profile.zohoCustomerId wasn't populated yet.
    const searchResult = await booksFetch(`/contacts?email=${encodeURIComponent(data.email)}`);
    const contacts = searchResult.contacts as Array<{ contact_id: string }> | undefined;

    if (contacts && contacts.length > 0) {
      const customerId = contacts[0].contact_id;
      await db
        .update(profiles)
        .set({ zohoCustomerId: customerId })
        .where(eq(profiles.id, data.profileId));
      await logSync({
        status: "success",
        entityType: "books_customer",
        localId: data.profileId,
        remoteId: customerId,
        message: `Found existing customer ${data.email}`,
      });
      return customerId;
    }

    // Create new customer
    const createResult = await booksFetch("/contacts", {
      method: "POST",
      body: {
        contact_name: `${data.firstName} ${data.lastName || data.firstName}`,
        email: data.email,
        contact_type: "customer",
        ...(data.phone ? { phone: data.phone } : {}),
      },
    });

    const contact = createResult.contact as { contact_id: string } | undefined;
    const customerId = contact?.contact_id;

    if (customerId) {
      await db
        .update(profiles)
        .set({ zohoCustomerId: customerId })
        .where(eq(profiles.id, data.profileId));
    }

    await logSync({
      status: "success",
      entityType: "books_customer",
      localId: data.profileId,
      remoteId: customerId,
      message: `Created customer ${data.email}`,
    });
    return customerId ?? null;
  } catch (err) {
    Sentry.captureException(err);
    await logSync({
      status: "failed",
      entityType: "books_customer",
      localId: data.profileId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Invoice creation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Creates a Zoho Books invoice with line items for a booking, order,
 * or enrollment. Marks the invoice as sent. Optionally records a
 * deposit as a partial payment. Stores the invoice ID back to the
 * source entity.
 *
 * Fire-and-forget — never throws to the caller.
 */
export async function createZohoBooksInvoice(data: {
  entityType: "booking" | "order" | "enrollment";
  entityId: number;
  profileId: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
  lineItems: Array<{ name: string; description?: string; rate: number; quantity: number }>;
  depositInCents?: number;
  /** Sales tax in cents as reported by Square. Added as an adjustment line. */
  taxAmountInCents?: number;
}): Promise<void> {
  if (!isZohoBooksConfigured()) return;

  try {
    // 1. Ensure customer exists in Zoho Books
    const customerId = await ensureZohoBooksCustomer({
      profileId: data.profileId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    });

    if (!customerId) return; // Customer creation failed, abort silently

    // 2. Create the invoice — all internal amounts are in cents,
    // but Zoho Books expects dollars, so divide by 100.
    const invoiceLineItems = data.lineItems.map((item) => ({
      name: item.name,
      description: item.description ?? "",
      rate: item.rate / 100,
      quantity: item.quantity,
    }));

    // Tax is passed as an "adjustment" line rather than a tax rate because
    // Square calculates tax at POS — we just mirror the amount in Zoho Books
    // for accurate accounting without duplicating tax configuration.
    const taxAmountCents = data.taxAmountInCents ?? 0;

    const invoiceResult = await booksFetch("/invoices", {
      method: "POST",
      body: {
        customer_id: customerId,
        line_items: invoiceLineItems,
        is_inclusive_tax: false,
        ...(taxAmountCents > 0
          ? {
              adjustment: taxAmountCents / 100,
              adjustment_description: "Sales tax",
            }
          : {}),
        notes: `Auto-generated from T Creative ${data.entityType} #${data.entityId}`,
        reference_number: `tc-${data.entityType}-${data.entityId}`,
      },
    });

    const invoice = invoiceResult.invoice as
      | { invoice_id: string; invoice_number: string }
      | undefined;
    const invoiceId = invoice?.invoice_id;

    if (!invoiceId) {
      throw new Error("No invoice_id returned from Zoho Books");
    }

    // 3. Store the invoice ID on the source entity
    if (data.entityType === "booking") {
      await db
        .update(bookings)
        .set({ zohoInvoiceId: invoiceId })
        .where(eq(bookings.id, data.entityId));
    } else if (data.entityType === "order") {
      await db.update(orders).set({ zohoInvoiceId: invoiceId }).where(eq(orders.id, data.entityId));
    } else if (data.entityType === "enrollment") {
      await db
        .update(enrollments)
        .set({ zohoInvoiceId: invoiceId })
        .where(eq(enrollments.id, data.entityId));
    }

    // 4. Mark as sent so the invoice appears in the customer's portal
    // and Zoho starts aging it. Non-fatal — a draft invoice is still usable.
    try {
      await booksFetch(`/invoices/${invoiceId}/status/sent`, { method: "POST" });
    } catch {
      // Non-fatal — invoice still exists as draft
    }

    // 5. Record deposit as partial payment if applicable
    if (data.depositInCents && data.depositInCents > 0) {
      try {
        await booksFetch("/customerpayments", {
          method: "POST",
          body: {
            customer_id: customerId,
            amount: data.depositInCents / 100,
            date: new Date().toISOString().split("T")[0],
            invoices: [{ invoice_id: invoiceId, amount_applied: data.depositInCents / 100 }],
            description: "Deposit collected via Square",
          },
        });
      } catch {
        // Non-fatal — deposit can be recorded manually
      }
    }

    await logSync({
      status: "success",
      entityType: "books_invoice",
      localId: `${data.entityType}-${data.entityId}`,
      remoteId: invoiceId,
      message: `Created invoice ${invoice?.invoice_number} for ${data.entityType} #${data.entityId}`,
      payload: { customerId, invoiceId, lineItemCount: data.lineItems.length },
    });
  } catch (err) {
    Sentry.captureException(err);
    await logSync({
      status: "failed",
      entityType: "books_invoice",
      localId: `${data.entityType}-${data.entityId}`,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Payment recording                                                  */
/* ------------------------------------------------------------------ */

/**
 * Records a payment against an existing Zoho Books invoice.
 * Called from the Square webhook handler when a payment completes.
 *
 * Requires a round-trip to fetch the invoice first because the
 * Zoho Books payment API needs the customer_id (not stored locally).
 *
 * Fire-and-forget — never throws to the caller.
 */
export async function recordZohoBooksPayment(data: {
  zohoInvoiceId: string;
  amountInCents: number;
  squarePaymentId?: string;
  description?: string;
}): Promise<void> {
  if (!isZohoBooksConfigured()) return;

  try {
    // Fetch the invoice to get the customer_id
    const invoiceResult = await booksFetch(`/invoices/${data.zohoInvoiceId}`);
    const invoice = invoiceResult.invoice as
      | { customer_id: string; invoice_id: string }
      | undefined;

    if (!invoice?.customer_id) {
      throw new Error(`Invoice ${data.zohoInvoiceId} not found or missing customer_id`);
    }

    await booksFetch("/customerpayments", {
      method: "POST",
      body: {
        customer_id: invoice.customer_id,
        amount: data.amountInCents / 100,
        date: new Date().toISOString().split("T")[0],
        invoices: [{ invoice_id: data.zohoInvoiceId, amount_applied: data.amountInCents / 100 }],
        reference_number: data.squarePaymentId ?? undefined,
        description: data.description ?? "Payment via Square",
      },
    });

    await logSync({
      status: "success",
      entityType: "books_payment",
      localId: data.squarePaymentId,
      remoteId: data.zohoInvoiceId,
      message: `Recorded $${(data.amountInCents / 100).toFixed(2)} payment against invoice ${data.zohoInvoiceId}`,
    });
  } catch (err) {
    Sentry.captureException(err);
    await logSync({
      status: "failed",
      entityType: "books_payment",
      localId: data.squarePaymentId,
      remoteId: data.zohoInvoiceId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
