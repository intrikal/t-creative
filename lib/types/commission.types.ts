/**
 * lib/types/commission.types.ts
 * Shared types for client-facing commission requests.
 * Source: app/dashboard/commissions/actions.ts
 */

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
