/**
 * app/dashboard/services/types.ts — Shared types, constants, and pure helpers
 * for the Services dashboard module.
 *
 * ## Why this file exists
 * All five service-dashboard components (ServicesPage, ServiceCard, ServiceFormDialog,
 * AddOnsDialog, BundlesTab, FormsTab) share the same domain vocabulary. Co-locating
 * types, display config, and converters here keeps each component file focused on
 * rendering logic — not on mapping DB rows to UI shapes.
 *
 * ## Conventions
 * - *Row types* (ServiceRow, BundleRow, FormRow) come from server-action files and
 *   represent the raw Drizzle-inferred DB shape.
 * - *UI types* (Service, Bundle, ClientForm) are the adapted shapes used by React
 *   state and component props — dollars instead of cents, strings formatted, etc.
 * - *Converter functions* (dbToService, dbToBundle, dbToForm) are the one-way
 *   mapping from DB row → UI type. They are pure functions with no side effects.
 * - *Input converters* (serviceToInput, serviceToFormData) go in the other direction:
 *   UI form state → server action input type (cents, not dollars).
 */

import type { ServiceRow, ServiceInput } from "./actions";
import type { BundleRow } from "./bundle-actions";
import type { FormRow } from "./form-actions";

/* ------------------------------------------------------------------ */
/*  Domain enumerations                                                 */
/* ------------------------------------------------------------------ */

/** The five service categories recognised by the system. */
export type Category = "lash" | "jewelry" | "crochet" | "consulting" | "training";

/**
 * How the service price is presented to clients on the booking page.
 * - `fixed`      — exact price, e.g. "$120"
 * - `starting_at` — floor price, e.g. "From $65"
 * - `range`       — min/max span, e.g. "$65–$120"
 * - `free`        — no charge, shows "Free"
 */
export type PriceType = "fixed" | "starting_at" | "range" | "free";

/* ------------------------------------------------------------------ */
/*  UI model types (React state / component props)                     */
/* ------------------------------------------------------------------ */

/**
 * Service — the UI-facing representation of a row from the `services` table.
 * Prices are in dollars (not cents) for display convenience.
 */
export interface Service {
  id: number;
  name: string;
  category: Category;
  description: string;
  durationMin: number;
  priceType: PriceType;
  /** Price in US dollars (not cents). */
  price: number;
  /** Upper bound of a price range. Only used when `priceType === "range"`. */
  priceMax?: number;
  /**
   * Flat dollar deposit required to hold the appointment.
   * `undefined` means no deposit configured for this service (uses studio-level default).
   */
  depositOverride?: number;
  /** Staff members authorised to perform this service. Empty in Phase 1 — no join table yet. */
  staff: string[];
  active: boolean;
  /** Total bookings this period. Always 0 in Phase 1 — no efficient join yet. */
  bookings: number;
}

/**
 * ServiceFormData — shape of the add/edit service dialog form.
 * Prices in dollars so the user types "$120", not "12000".
 */
export type ServiceFormData = {
  name: string;
  category: Category;
  description: string;
  durationMin: number;
  /** Price in US dollars. Converted to cents when calling the server action. */
  price: number;
  /** Flat deposit in dollars (0 = no deposit required). */
  depositDollars: number;
  active: boolean;
};

/**
 * Bundle — the UI-facing representation of a row from the `service_bundles` table.
 */
export interface Bundle {
  id: number;
  name: string;
  description: string;
  /** List of service names included in this bundle (denormalised text array). */
  services: string[];
  /** Individual prices summed — shown as "was $X" for savings comparison. */
  originalPrice: number;
  /** Discounted bundle price in dollars. */
  bundlePrice: number;
  active: boolean;
}

/** Bundle form state — mirrors Bundle but without `id`. */
export interface BundleForm {
  name: string;
  description: string;
  services: string[];
  originalPrice: number;
  bundlePrice: number;
  active: boolean;
}

/* ── Forms ── */

/** The four supported form/waiver types, matching the `form_type` DB enum. */
export type FormType = "intake" | "waiver" | "consent" | "custom";

/**
 * Input field types available when building a custom form in EditFieldsDialog.
 * The values map to the field's HTML-equivalent input type or widget.
 */
export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "checkbox"
  | "date"
  | "phone"
  | "email"
  | "signature";

/** A single question/field inside a client form. Stored as JSONB in `client_forms.fields`. */
export interface FormField {
  /** Stable client-side ID (Date.now() for new fields, integer for seeded defaults). */
  id: number;
  label: string;
  type: FieldType;
  required: boolean;
}

/**
 * ClientForm — UI-facing representation of a row from the `client_forms` table.
 */
export interface ClientForm {
  id: number;
  name: string;
  type: FormType;
  description: string;
  /** Service categories this form applies to (e.g. ["Lash", "Jewelry"] or ["All"]). */
  appliesTo: string[];
  required: boolean;
  /** Formatted last-updated date string for display (e.g. "Feb 12, 2026"). */
  lastUpdated: string;
  active: boolean;
  /**
   * Ordered list of form fields. Null when the form was just created and no fields
   * have been configured yet; callers should fall back to `DEFAULT_FIELDS[form.type]`.
   */
  fields: FormField[] | null;
}

/** Data collected by NewFormDialog before a form row is persisted. */
export interface NewFormData {
  name: string;
  type: FormType;
  appliesTo: string[];
  description: string;
  required: boolean;
}

/* ------------------------------------------------------------------ */
/*  Display configuration                                              */
/* ------------------------------------------------------------------ */

/**
 * CAT_CONFIG — per-category Tailwind colour tokens for the service menu UI.
 *
 * All colour decisions for the five categories live here. Adding a new category
 * only requires adding an entry here — no changes needed in the rendering logic.
 */
export const CAT_CONFIG: Record<
  Category,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  lash: {
    label: "Lash",
    bg: "bg-[#c4907a]/12",
    text: "text-[#96604a]",
    dot: "bg-[#c4907a]",
    border: "border-[#c4907a]/20",
  },
  jewelry: {
    label: "Jewelry",
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    dot: "bg-[#d4a574]",
    border: "border-[#d4a574]/20",
  },
  crochet: {
    label: "Crochet",
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4d8080]",
    dot: "bg-[#7ba3a3]",
    border: "border-[#7ba3a3]/20",
  },
  consulting: {
    label: "Consulting",
    bg: "bg-[#5b8a8a]/12",
    text: "text-[#3d6464]",
    dot: "bg-[#5b8a8a]",
    border: "border-[#5b8a8a]/20",
  },
  training: {
    label: "Training",
    bg: "bg-[#4e6b51]/12",
    text: "text-[#3a5440]",
    dot: "bg-[#4e6b51]",
    border: "border-[#4e6b51]/20",
  },
};

/** Background + text colour tokens for staff avatar chips, keyed by first name. */
export const STAFF_AVATAR: Record<string, string> = {
  Trini: "bg-[#c4907a] text-white",
  Aaliyah: "bg-[#7ba3a3] text-white",
  Jade: "bg-[#d4a574] text-white",
  Maya: "bg-[#5b8a8a] text-white",
};

/** Per-type colour tokens for the form/waiver type badge in FormsTab. */
export const FORM_TYPE_CONFIG: Record<FormType, { label: string; color: string; bg: string }> = {
  intake: { label: "Intake", color: "text-[#5b8a8a]", bg: "bg-[#5b8a8a]/10" },
  waiver: { label: "Waiver", color: "text-[#c4907a]", bg: "bg-[#c4907a]/10" },
  consent: { label: "Consent", color: "text-[#d4a574]", bg: "bg-[#d4a574]/10" },
  custom: { label: "Custom", color: "text-muted", bg: "bg-surface" },
};

/** Human-readable labels for each FieldType used in the EditFieldsDialog type picker. */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  select: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
  phone: "Phone",
  email: "Email",
  signature: "Signature",
};

/**
 * Default field templates seeded into EditFieldsDialog when a newly-created form
 * has not yet had its fields configured (i.e. `form.fields === null`).
 */
export const DEFAULT_FIELDS: Record<FormType, FormField[]> = {
  intake: [
    { id: 1, label: "Full Name", type: "text", required: true },
    { id: 2, label: "Email Address", type: "email", required: true },
    { id: 3, label: "Phone Number", type: "phone", required: true },
    { id: 4, label: "Date of Birth", type: "date", required: false },
    { id: 5, label: "Known Allergies", type: "textarea", required: false },
    { id: 6, label: "Style Preferences", type: "textarea", required: false },
  ],
  waiver: [
    { id: 1, label: "Full Name", type: "text", required: true },
    { id: 2, label: "Date", type: "date", required: true },
    { id: 3, label: "I agree to the terms", type: "checkbox", required: true },
    { id: 4, label: "Signature", type: "signature", required: true },
  ],
  consent: [
    { id: 1, label: "Full Name", type: "text", required: true },
    { id: 2, label: "Consent to service", type: "checkbox", required: true },
    { id: 3, label: "Medical conditions", type: "textarea", required: false },
    { id: 4, label: "Signature", type: "signature", required: true },
  ],
  custom: [
    { id: 1, label: "Full Name", type: "text", required: true },
    { id: 2, label: "Your Question", type: "textarea", required: false },
  ],
};

/** Category filter options shown in the "Applies To" multi-select of NewFormDialog. */
export const APPLIES_TO_OPTIONS = ["All", "Lash", "Jewelry", "Crochet", "Consulting", "Training"];

/** Empty ServiceFormData — used as the initial state when adding a new service. */
export const BLANK_SERVICE_FORM: ServiceFormData = {
  name: "",
  category: "lash",
  description: "",
  durationMin: 60,
  price: 0,
  depositDollars: 0,
  active: true,
};

/** Empty BundleForm — used as the initial state when creating a new bundle. */
export const BLANK_BUNDLE: BundleForm = {
  name: "",
  description: "",
  services: [],
  originalPrice: 0,
  bundlePrice: 0,
  active: true,
};

/* ------------------------------------------------------------------ */
/*  Pure helper functions                                              */
/* ------------------------------------------------------------------ */

/**
 * Formats a Service's price for display, taking `priceType` into account.
 *
 * @example formatPrice({ priceType: "free", price: 0 }) → "Free"
 * @example formatPrice({ priceType: "starting_at", price: 65 }) → "From $65"
 * @example formatPrice({ priceType: "range", price: 65, priceMax: 120 }) → "$65–$120"
 * @example formatPrice({ priceType: "fixed", price: 120 }) → "$120"
 */
export function formatPrice(s: Service): string {
  if (s.priceType === "free") return "Free";
  if (s.priceType === "starting_at") return `From $${s.price}`;
  if (s.priceType === "range" && s.priceMax) return `$${s.price}–$${s.priceMax}`;
  return `$${s.price}`;
}

/**
 * Converts a duration in minutes to a compact display string.
 * Returns "—" for 0/null (project-based services with no fixed duration).
 *
 * @example formatDuration(90) → "1h 30m"
 * @example formatDuration(60) → "1h"
 * @example formatDuration(45) → "45m"
 * @example formatDuration(0)  → "—"
 */
export function formatDuration(min: number): string {
  if (!min) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* ------------------------------------------------------------------ */
/*  DB → UI converters                                                 */
/* ------------------------------------------------------------------ */

/**
 * Converts a raw `services` DB row to the UI-facing Service shape.
 * - Prices are converted from cents to dollars.
 * - `priceType` is derived: free when price=0, fixed otherwise.
 *   Phase 2 will add a `price_type` column to support "starting_at" / "range".
 * - `staff` is left empty (no staff-service join table in Phase 1).
 * - `bookings` is set to 0 (no efficient count join in Phase 1).
 */
export function dbToService(row: ServiceRow): Service {
  const price = (row.priceInCents ?? 0) / 100;
  return {
    id: row.id,
    name: row.name,
    category: row.category as Category,
    description: row.description ?? "",
    durationMin: row.durationMinutes ?? 0,
    priceType: price === 0 ? "free" : "fixed",
    price,
    depositOverride: row.depositInCents ? row.depositInCents / 100 : undefined,
    staff: [],
    active: row.isActive,
    bookings: 0,
  };
}

/**
 * Converts a ServiceFormData (dialog form state) to a ServiceInput for the server action.
 * Converts dollar amounts back to integer cents.
 */
export function serviceToInput(data: ServiceFormData): ServiceInput {
  return {
    name: data.name,
    category: data.category as ServiceInput["category"],
    description: data.description,
    durationMinutes: data.durationMin,
    priceInCents: Math.round(data.price * 100),
    depositInCents: Math.round(data.depositDollars * 100),
    isActive: data.active,
  };
}

/**
 * Converts a UI Service back to ServiceFormData for pre-populating the edit dialog.
 */
export function serviceToFormData(s: Service): ServiceFormData {
  return {
    name: s.name,
    category: s.category,
    description: s.description,
    durationMin: s.durationMin,
    price: s.price,
    depositDollars: s.depositOverride ?? 0,
    active: s.active,
  };
}

/**
 * Converts a raw `service_bundles` DB row to the UI-facing Bundle shape.
 * Prices are converted from cents to dollars.
 */
export function dbToBundle(row: BundleRow): Bundle {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    services: row.serviceNames ?? [],
    originalPrice: row.originalPriceInCents / 100,
    bundlePrice: row.bundlePriceInCents / 100,
    active: row.isActive,
  };
}

/**
 * Converts a raw `client_forms` DB row to the UI-facing ClientForm shape.
 * - `fields` is cast from Drizzle's `unknown` (JSONB) to `FormField[] | null`.
 * - `lastUpdated` is formatted as a human-readable date string.
 */
export function dbToForm(row: FormRow): ClientForm {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description ?? "",
    appliesTo: row.appliesTo ?? ["All"],
    required: row.required,
    lastUpdated: row.updatedAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    active: row.isActive,
    fields: row.fields as FormField[] | null,
  };
}
