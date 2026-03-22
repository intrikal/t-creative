/**
 * lib/types/aftercare.types.ts
 * Shared types for aftercare sections and studio policies.
 * Source: app/dashboard/aftercare/actions.ts
 */

export type AftercareSection = {
  id: number;
  title: string;
  category: string | null;
  dos: string[];
  donts: string[];
};

export type PolicyEntry = {
  id: number;
  title: string;
  content: string;
};

export type AftercareSectionInput = {
  title: string;
  category?: string;
  dos: string[];
  donts: string[];
};

export type PolicyInput = {
  title: string;
  content: string;
};
