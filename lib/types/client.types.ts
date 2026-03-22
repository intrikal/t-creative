/**
 * lib/types/client.types.ts
 * Shared types for CRM client profiles, preferences, and loyalty.
 * Source: app/dashboard/clients/actions.ts
 */

/* ------------------------------------------------------------------ */
/*  Client identity & CRM                                             */
/* ------------------------------------------------------------------ */

export type ClientSource =
  | "instagram"
  | "tiktok"
  | "pinterest"
  | "word_of_mouth"
  | "google_search"
  | "referral"
  | "website_direct"
  | "event";

export type LifecycleStage = "prospect" | "active" | "at_risk" | "lapsed" | "churned";

/**
 * Composite row returned by `getClients` — combines profile columns with
 * aggregated booking stats, loyalty points, and referral counts.
 */
export type ClientRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: ClientSource | null;
  isVip: boolean;
  lifecycleStage: LifecycleStage | null;
  internalNotes: string | null;
  tags: string | null;
  referredByName: string | null;
  referralCount: number;
  createdAt: Date;
  totalBookings: number;
  totalSpent: number;
  lastVisit: Date | null;
  loyaltyPoints: number;
};

/** Fields accepted by createClient / updateClient. */
export type ClientInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source?: ClientSource;
  isVip: boolean;
  lifecycleStage?: LifecycleStage | null;
  internalNotes?: string;
  tags?: string;
};

/** Row shape for the Loyalty leaderboard tab. */
export type LoyaltyRow = {
  id: string;
  firstName: string;
  lastName: string;
  points: number;
  lastActivity: Date | null;
};

export type PaginatedClients = {
  rows: ClientRow[];
  hasMore: boolean;
};

/* ------------------------------------------------------------------ */
/*  Client preferences (beauty/health profile)                        */
/* ------------------------------------------------------------------ */

export type ClientPreferencesRow = {
  profileId: string;
  preferredLashStyle: string | null;
  preferredCurlType: string | null;
  preferredLengths: string | null;
  preferredDiameter: string | null;
  naturalLashNotes: string | null;
  retentionProfile: string | null;
  allergies: string | null;
  skinType: string | null;
  adhesiveSensitivity: boolean;
  healthNotes: string | null;
  birthday: string | null;
  preferredContactMethod: string | null;
  preferredServiceTypes: string | null;
  generalNotes: string | null;
  preferredRebookIntervalDays: number | null;
};

export type ClientPreferencesInput = {
  profileId: string;
  preferredLashStyle?: string;
  preferredCurlType?: string;
  preferredLengths?: string;
  preferredDiameter?: string;
  naturalLashNotes?: string;
  retentionProfile?: string;
  allergies?: string;
  skinType?: string;
  adhesiveSensitivity?: boolean;
  healthNotes?: string;
  birthday?: string;
  preferredContactMethod?: string;
  preferredServiceTypes?: string;
  generalNotes?: string;
  preferredRebookIntervalDays?: number;
};

/* ------------------------------------------------------------------ */
/*  Assistant-scoped client view                                       */
/* ------------------------------------------------------------------ */

/**
 * Row shape for the assistant's "My Clients" view, scoped to clients
 * the logged-in assistant has personally served.
 */
export type AssistantClientRow = {
  id: string;
  name: string;
  initials: string;
  phone: string | null;
  email: string;
  lastService: string | null;
  lastServiceDate: string | null;
  categories: string[];
  totalVisits: number;
  totalSpent: number;
  vip: boolean;
  notes: string | null;
  nextAppointment: string | null;
};

export type AssistantClientStats = {
  totalClients: number;
  vipClients: number;
  totalRevenue: number;
};
