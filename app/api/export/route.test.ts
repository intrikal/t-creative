import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockLogAction = vi.fn();
const mockDbSelect = vi.fn();

/** Returns a thenable chain that also supports limit/orderBy terminals. */
function makeSelectChain(result: unknown[] = []) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    where: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    orderBy: vi.fn().mockReturnValue(Promise.resolve(result)),
    limit: vi.fn().mockReturnValue(Promise.resolve(result)),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.innerJoin as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.leftJoin as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

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
  profiles: {},
  bookings: {},
  services: {},
  payments: {},
  expenses: {},
  invoices: {},
  orders: {},
}));

vi.mock("@/lib/audit", () => ({
  logAction: (...args: unknown[]) => mockLogAction(...args),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  asc: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  lt: vi.fn(),
}));

vi.mock("drizzle-orm/pg-core", () => ({
  alias: vi.fn().mockImplementation((table: unknown) => table),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeGet(params: Record<string, string> = {}) {
  const url = new URL("https://example.com/api/export");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/export", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: authenticated admin user
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-uuid" } } });

    // Default: first db.select() is the profile check → admin
    //          subsequent calls → empty rows for export data
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ role: "admin" }]))
      .mockReturnValue(makeSelectChain([]));

    mockLogAction.mockResolvedValue(undefined);

    const mod = await import("./route");
    GET = mod.GET;
  });

  /* ---------- Auth ---------- */

  it("returns 401 when no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET(makeGet({ type: "clients" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 403 for a non-admin user", async () => {
    mockDbSelect.mockReset();
    mockDbSelect.mockReturnValue(makeSelectChain([{ role: "client" }]));

    const res = await GET(makeGet({ type: "clients" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Forbidden" });
  });

  it("returns 403 when profile is not found", async () => {
    mockDbSelect.mockReset();
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const res = await GET(makeGet({ type: "clients" }));
    expect(res.status).toBe(403);
  });

  /* ---------- Validation ---------- */

  it("returns 400 for an invalid export type", async () => {
    const res = await GET(makeGet({ type: "invalid_type" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid type");
    expect(body.error).toContain("clients");
  });

  it("returns 400 when type is omitted", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  /* ---------- CSV output ---------- */

  it("returns CSV with correct headers for clients export", async () => {
    const res = await GET(makeGet({ type: "clients" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("clients");

    const csv = await res.text();
    const headerLine = csv.split("\n")[0];
    expect(headerLine).toContain("ID");
    expect(headerLine).toContain("First Name");
    expect(headerLine).toContain("Email");
    expect(headerLine).toContain("VIP");
  });

  it("returns CSV with correct headers for bookings export", async () => {
    const res = await GET(makeGet({ type: "bookings" }));

    expect(res.status).toBe(200);
    const csv = await res.text();
    const headerLine = csv.split("\n")[0];
    expect(headerLine).toContain("Booking ID");
    expect(headerLine).toContain("Status");
    expect(headerLine).toContain("Service");
    expect(headerLine).toContain("Client Email");
  });

  it("returns CSV with correct headers for payments export", async () => {
    const res = await GET(makeGet({ type: "payments" }));

    expect(res.status).toBe(200);
    const csv = await res.text();
    const headerLine = csv.split("\n")[0];
    expect(headerLine).toContain("Payment ID");
    expect(headerLine).toContain("Amount ($)");
    expect(headerLine).toContain("Net ($)");
    expect(headerLine).toContain("Square Payment ID");
  });

  it("returns CSV with correct headers for expenses export", async () => {
    const res = await GET(makeGet({ type: "expenses" }));

    expect(res.status).toBe(200);
    const csv = await res.text();
    const headerLine = csv.split("\n")[0];
    expect(headerLine).toContain("Expense ID");
    expect(headerLine).toContain("Vendor");
    expect(headerLine).toContain("Receipt on File");
  });

  it("returns CSV with correct headers for invoices export", async () => {
    const res = await GET(makeGet({ type: "invoices" }));

    expect(res.status).toBe(200);
    const csv = await res.text();
    const headerLine = csv.split("\n")[0];
    expect(headerLine).toContain("Invoice ID");
    expect(headerLine).toContain("Invoice #");
    expect(headerLine).toContain("Recurring");
  });

  it("returns CSV with correct headers for orders export", async () => {
    const res = await GET(makeGet({ type: "orders" }));

    expect(res.status).toBe(200);
    const csv = await res.text();
    const headerLine = csv.split("\n")[0];
    expect(headerLine).toContain("Order ID");
    expect(headerLine).toContain("Order #");
    expect(headerLine).toContain("Fulfillment");
  });

  it("sets Cache-Control: no-store on CSV responses", async () => {
    const res = await GET(makeGet({ type: "clients" }));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("records an audit log entry after a successful export", async () => {
    await GET(makeGet({ type: "payments" }));
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-uuid",
        action: "export",
        entityType: "payments",
      }),
    );
  });
});
