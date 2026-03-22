/**
 * lib/types/services.types.ts
 * Shared types for services, bundles, and forms.
 * Sources: app/dashboard/services/actions.ts,
 *          app/dashboard/services/bundle-actions.ts,
 *          app/dashboard/services/form-actions.ts
 */

import type { services, serviceBundles, clientForms } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Services                                                           */
/* ------------------------------------------------------------------ */

export type ServiceRow = typeof services.$inferSelect;

export type ServiceInput = {
  name: string;
  category: ServiceRow["category"];
  description: string;
  durationMinutes: number;
  priceInCents: number;
  depositInCents: number;
  isActive: boolean;
};

export type AssistantServiceRow = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  durationMin: number | null;
  price: number;
  deposit: number | null;
  certified: boolean;
  certDate: string | null;
  timesPerformed: number;
};

export type AssistantServiceStats = {
  totalServices: number;
  certifiedCount: number;
  avgDuration: number;
};

/* ------------------------------------------------------------------ */
/*  Bundles                                                            */
/* ------------------------------------------------------------------ */

export type BundleRow = typeof serviceBundles.$inferSelect;

export type BundleInput = {
  name: string;
  description: string;
  serviceNames: string[];
  originalPriceInCents: number;
  bundlePriceInCents: number;
  isActive: boolean;
};

/* ------------------------------------------------------------------ */
/*  Forms & submissions                                                */
/* ------------------------------------------------------------------ */

export type FormRow = typeof clientForms.$inferSelect;

export type FormInput = {
  name: string;
  type: "intake" | "waiver" | "consent" | "custom";
  description: string;
  appliesTo: string[];
  required: boolean;
  isActive: boolean;
};

export type FormSubmissionRow = {
  id: number;
  formId: number;
  formName: string;
  formType: "intake" | "waiver" | "consent" | "custom";
  data: Record<string, unknown> | null;
  signatureUrl: string | null;
  formVersion: string | null;
  submittedAt: string;
};

export type FormSubmissionInput = {
  clientId: string;
  formId: number;
  data: Record<string, unknown>;
  signatureUrl?: string;
  formVersion?: string;
  ipAddress?: string;
};
