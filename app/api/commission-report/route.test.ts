/**
 * Tests for GET /api/commission-report — commission report export (CSV/PDF).
 *
 * Covers:
 *  - Auth: unauthenticated → 401
 *  - Auth: non-admin accessing another staff's report → 403
 *  - Valid request with format=pdf → returns PDF blob with correct Content-Type
 *  - Date range filtering works (CSV with entries)
 *  - Empty date range → returns report with zero rows
 *
 * Mocks: Supabase auth (getUser), db.select (profile check),
 * generateCommissionReport, generateCommissionPdf,
 * getPublicBusinessProfile, Sentry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockCaptureException = vi.fn();
const mockDbSelect = vi.fn();
const mockGenerateReport = vi.fn();
const mockGeneratePdf = vi.fn();
const mockGetBusinessProfile = vi.fn();

/** Thenable chain for db.select() — supports from/where/limit */
function makeSelectChain(result: unknown[] = []) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.limit as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

/** A realistic commission report object. */
const MOCK_REPORT = {
  staffName: "Test Staff",
  periodLabel: "Apr 1 – Apr 30, 2026",
  commissionType: "percentage" as const,
  rate: 50,
  flatFeeInCents: 0,
  tipSplitPercent: 100,
  entries: [
    {
      date: "2026-04-05",
      client: "Jane Doe",
      service: "Classic Lash Set",
      serviceCategory: "Lashes",
      priceInCents: 15000,
      commissionRate: 50,
      commissionInCents: 7500,
      tipInCents: 2000,
      tipEarnedInCents: 2000,
      totalEarnedInCents: 9500,
    },
  ],
  totals: {
    sessions: 1,
    revenueInCents: 15000,
    commissionInCents: 7500,
    tipsInCents: 2000,
    tipEarnedInCents: 2000,
    totalEarnedInCents: 9500,
  },
};

const MOCK_EMPTY_REPORT = {
  ...MOCK_REPORT,
  entries: [],
  totals: {
    sessions: 0,
    revenueInCents: 0,
    commissionInCents: 0,
    tipsInCents: 0,
    tipEarnedInCents: 0,
    totalEarnedInCents: 0,
  },
};

const MOCK_BUSINESS_PROFILE = {
  businessName: "T Creative Studio",
  location: "123 Main St",
  phone: "+15551234567",
  email: "info@tcreative.studio",
};

/* ------------------------------------------------------------------ */
/*  Static mocks                                                        */
/* ------------------------------------------------------------------ */

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  profiles: { id: "id", role: "role" },
}));

vi.mock("@/app/dashboard/assistants/actions", () => ({
  generateCommissionReport: (...args: unknown[]) => mockGenerateReport(...args),
}));

vi.mock("@/lib/generate-commission-pdf", () => ({
  generateCommissionPdf: (...args: unknown[]) => mockGeneratePdf(...args),
}));

vi.mock("@/app/dashboard/settings/settings-actions", () => ({
  getPublicBusinessProfile: (...args: unknown[]) => mockGetBusinessProfile(...args),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeGet(params: Record<string, string> = {}): Request {
  const url = new URL("https://example.com/api/commission-report");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

const DEFAULT_PARAMS = {
  staffId: "staff-uuid",
  from: "2026-04-01",
  to: "2026-04-30",
};

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/commission-report", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: authenticated admin
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-uuid" } } });
    mockDbSelect.mockReturnValue(makeSelectChain([{ role: "admin" }]));
    mockGenerateReport.mockResolvedValue(MOCK_REPORT);
    mockGeneratePdf.mockResolvedValue(Buffer.from("fake-pdf-bytes"));
    mockGetBusinessProfile.mockResolvedValue(MOCK_BUSINESS_PROFILE);

    vi.resetModules();

    vi.doMock("@/utils/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
      }),
    }));
    vi.doMock("@/db", () => ({
      db: { select: (...args: unknown[]) => mockDbSelect(...args) },
    }));
    vi.doMock("@/db/schema", () => ({
      profiles: { id: "id", role: "role" },
    }));
    vi.doMock("@/app/dashboard/assistants/actions", () => ({
      generateCommissionReport: (...args: unknown[]) => mockGenerateReport(...args),
    }));
    vi.doMock("@/lib/generate-commission-pdf", () => ({
      generateCommissionPdf: (...args: unknown[]) => mockGeneratePdf(...args),
    }));
    vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
      getPublicBusinessProfile: (...args: unknown[]) => mockGetBusinessProfile(...args),
    }));
    vi.doMock("@sentry/nextjs", () => ({
      captureException: (...args: unknown[]) => mockCaptureException(...args),
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((_col: unknown, val: unknown) => val),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  /* ---------- Auth ---------- */

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await GET(makeGet(DEFAULT_PARAMS));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 403 when non-admin accesses another staff's report", async () => {
    // User is a client, not the staff whose report is requested
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "client-uuid" } } });
    mockDbSelect.mockReset();
    mockDbSelect.mockReturnValue(makeSelectChain([{ role: "client" }]));

    const res = await GET(makeGet({ ...DEFAULT_PARAMS, staffId: "other-staff-uuid" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Forbidden" });
  });

  it("returns 403 when profile is not found", async () => {
    mockDbSelect.mockReset();
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const res = await GET(makeGet(DEFAULT_PARAMS));

    expect(res.status).toBe(403);
  });

  /* ---------- PDF output ---------- */

  it("returns PDF blob with correct Content-Type for format=pdf", async () => {
    const res = await GET(makeGet({ ...DEFAULT_PARAMS, format: "pdf" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("commission-report");
    expect(res.headers.get("Content-Disposition")).toContain(".pdf");

    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("passes report and business profile to PDF generator", async () => {
    await GET(makeGet({ ...DEFAULT_PARAMS, format: "pdf" }));

    expect(mockGeneratePdf).toHaveBeenCalledWith(
      MOCK_REPORT,
      MOCK_BUSINESS_PROFILE.businessName,
      MOCK_BUSINESS_PROFILE.location,
    );
  });

  /* ---------- CSV output / date range filtering ---------- */

  it("returns CSV with entries when date range has data", async () => {
    const res = await GET(makeGet(DEFAULT_PARAMS));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("commission-report");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");

    const csv = await res.text();
    // Header line should include column names
    expect(csv).toContain("Date");
    expect(csv).toContain("Commission");
    expect(csv).toContain("Tip");

    // Entry data should appear
    expect(csv).toContain("Jane Doe");
    expect(csv).toContain("Classic Lash Set");
  });

  it("passes staffId, from, and to to report generator", async () => {
    await GET(makeGet(DEFAULT_PARAMS));

    expect(mockGenerateReport).toHaveBeenCalledWith("staff-uuid", "2026-04-01", "2026-04-30");
  });

  /* ---------- Empty date range ---------- */

  it("returns CSV report with zero rows when date range has no data", async () => {
    mockGenerateReport.mockResolvedValueOnce(MOCK_EMPTY_REPORT);

    const res = await GET(makeGet(DEFAULT_PARAMS));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");

    const csv = await res.text();
    // Should have the TOTAL summary row with zeros
    expect(csv).toContain("TOTAL");
    expect(csv).toContain("0 sessions");
    expect(csv).toContain("0.00");
  });

  /* ---------- Validation ---------- */

  it("returns 400 for invalid date format", async () => {
    const res = await GET(makeGet({ ...DEFAULT_PARAMS, from: "not-a-date" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid params" });
  });

  it("returns 400 when staffId is missing", async () => {
    const res = await GET(makeGet({ from: "2026-04-01", to: "2026-04-30" }));

    expect(res.status).toBe(400);
  });
});
