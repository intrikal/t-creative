/**
 * EasyPost SDK client — shipping label generation and tracking.
 *
 * Provides helpers for the shop shipping flow:
 * 1. `getShippingRates()` — fetch carrier rates at checkout
 * 2. `buyShippingLabel()` — purchase a label after payment confirms
 * 3. `isEasyPostConfigured()` — graceful degradation when not configured
 *
 * Graceful degradation: when `EASYPOST_API_KEY` is missing the app still
 * boots (pickup-only mode). Always check `isEasyPostConfigured()` before
 * calling any EasyPost API.
 *
 * Required env vars:
 * - `EASYPOST_API_KEY`              — from EasyPost dashboard
 * - `EASYPOST_WEBHOOK_SECRET`       — for webhook signature verification
 *
 * @module lib/easypost
 */
import * as Sentry from "@sentry/nextjs";
import EasyPostClient from "@easypost/api";
import type { ShippingAddress } from "@/db/schema";

const apiKey = process.env.EASYPOST_API_KEY;

/** Webhook secret for verifying inbound EasyPost webhooks. */
export const EASYPOST_WEBHOOK_SECRET = process.env.EASYPOST_WEBHOOK_SECRET ?? "";

/** Whether EasyPost credentials are configured. */
export function isEasyPostConfigured(): boolean {
  return !!apiKey;
}

/**
 * Shared EasyPost client instance.
 *
 * Conditionally instantiated (unlike Square which always constructs) because
 * the EasyPost SDK validates the API key at construction time. When null,
 * all public functions throw "EasyPost is not configured".
 */
export const easypostClient = apiKey ? new EasyPostClient(apiKey) : null;

/* ------------------------------------------------------------------ */
/*  Studio origin address                                              */
/* ------------------------------------------------------------------ */

/** T Creative studio address — used as the "from" address on all shipments. */
const STUDIO_ADDRESS = {
  company: "T Creative",
  street1: process.env.STUDIO_STREET1 ?? "",
  street2: process.env.STUDIO_STREET2 ?? "",
  city: process.env.STUDIO_CITY ?? "",
  state: process.env.STUDIO_STATE ?? "",
  zip: process.env.STUDIO_ZIP ?? "",
  country: "US",
  phone: process.env.STUDIO_PHONE ?? "",
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ShippingRate = {
  rateId: string;
  carrier: string;
  service: string;
  rateInCents: number;
  estimatedDays: number | null;
};

export type ShipmentResult = {
  shipmentId: string;
  rates: ShippingRate[];
};

export type LabelResult = {
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  carrier: string;
  service: string;
};

/* ------------------------------------------------------------------ */
/*  Default parcel dimensions                                          */
/* ------------------------------------------------------------------ */

/**
 * Default parcel dimensions for shop products.
 *
 * Sized for the most common product (crochet bags / accessories).
 * EasyPost uses inches for dimensions and ounces for weight.
 * Callers can override per-product via the `parcel` parameter.
 */
const DEFAULT_PARCEL = {
  length: 12, // inches
  width: 10,
  height: 4,
  weight: 16, // ounces (1 lb)
};

/* ------------------------------------------------------------------ */
/*  Get shipping rates                                                 */
/* ------------------------------------------------------------------ */

/**
 * Creates an EasyPost shipment and returns available carrier rates.
 * Call this at checkout to show the customer shipping options.
 *
 * The shipment is created in "rate" mode (no label purchased yet).
 * The returned `shipmentId` must be passed to `buyShippingLabel()`
 * after the customer selects a rate and payment is confirmed.
 *
 * EasyPost rate-fetches are not cached — each call creates a new
 * shipment object. Rates are valid for ~15 minutes per EasyPost docs.
 */
export async function getShippingRates(
  toAddress: ShippingAddress,
  parcel?: { length: number; width: number; height: number; weight: number },
): Promise<ShipmentResult> {
  if (!easypostClient) throw new Error("EasyPost is not configured");

  const shipment = await easypostClient.Shipment.create({
    fromAddress: STUDIO_ADDRESS,
    toAddress: {
      name: toAddress.name,
      street1: toAddress.street1,
      street2: toAddress.street2 ?? "",
      city: toAddress.city,
      state: toAddress.state,
      zip: toAddress.zip,
      country: toAddress.country,
      phone: toAddress.phone ?? "",
    },
    parcel: parcel ?? DEFAULT_PARCEL,
  });

  // EasyPost returns rates as dollar strings — convert to cents for
  // consistency with our internal pricing model.
  const rates: ShippingRate[] = (shipment.rates ?? []).map((r) => ({
    rateId: r.id,
    carrier: r.carrier,
    service: r.service,
    rateInCents: Math.round(parseFloat(r.rate) * 100),
    estimatedDays: r.delivery_days ?? null,
  }));

  // Sort by price ascending
  rates.sort((a, b) => a.rateInCents - b.rateInCents);

  return {
    shipmentId: shipment.id,
    rates,
  };
}

/* ------------------------------------------------------------------ */
/*  Buy shipping label                                                 */
/* ------------------------------------------------------------------ */

/**
 * Purchases a shipping label for an existing shipment.
 * Call this after payment is confirmed to generate the label.
 *
 * This is a billable action — EasyPost charges your account immediately.
 * The returned `labelUrl` is a PNG/PDF hosted by EasyPost (valid for 1 year).
 */
export async function buyShippingLabel(
  shipmentId: string,
  rateId: string,
): Promise<LabelResult> {
  if (!easypostClient) throw new Error("EasyPost is not configured");

  const shipment = await easypostClient.Shipment.buy(shipmentId, rateId);

  const tracker = shipment.tracker;
  const postageLabel = shipment.postage_label;

  return {
    trackingNumber: tracker?.tracking_code ?? shipment.tracking_code ?? "",
    trackingUrl: tracker?.public_url ?? "",
    labelUrl: postageLabel?.label_url ?? "",
    carrier: shipment.selected_rate?.carrier ?? "",
    service: shipment.selected_rate?.service ?? "",
  };
}

/* ------------------------------------------------------------------ */
/*  Webhook signature verification                                     */
/* ------------------------------------------------------------------ */

/**
 * Verifies an EasyPost webhook signature.
 * EasyPost uses HMAC-SHA256 with the webhook secret.
 *
 * Called from the `/api/webhooks/easypost` route handler to reject
 * tampered or forged webhook payloads. Returns false (rather than
 * throwing) so the route can return a 401 with a clear message.
 */
export function verifyEasyPostWebhook(
  body: string,
  signature: string,
): boolean {
  if (!EASYPOST_WEBHOOK_SECRET) return false;

  const { createHmac } = require("crypto");
  const hmac = createHmac("sha256", EASYPOST_WEBHOOK_SECRET);
  hmac.update(body);
  const expected = hmac.digest("hex");

  return expected === signature;
}
