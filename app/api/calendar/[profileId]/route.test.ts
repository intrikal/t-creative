import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

let selectIdx = 0;
let selectData: unknown[][] = [];
const mockVerifyCalendarToken = vi.fn();

function buildDb() {
  return {
    select: vi.fn().mockImplementation(() => {
      const idx = selectIdx++;
      const rows = selectData[idx] ?? [];
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.leftJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi
        .fn()
        .mockReturnValue(Object.assign([...rows], { limit: vi.fn().mockReturnValue(rows) }));
      chain.limit = vi.fn().mockReturnValue(rows);
      return chain;
    }),
  };
}

function makeToken(profileId: string, secret = "test-cron-secret"): string {
  return createHmac("sha256", secret).update(`calendar:${profileId}`).digest("hex");
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/calendar/[profileId]", () => {
  let GET: (request: Request, ctx: { params: Promise<{ profileId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectIdx = 0;
    selectData = [];
    mockVerifyCalendarToken.mockReturnValue(true);

    vi.resetModules();

    vi.doMock("@/db", () => ({ db: buildDb() }));
    vi.doMock("@/db/schema", () => ({
      profiles: { id: "id", role: "role", firstName: "firstName", lastName: "lastName" },
      bookings: {
        id: "id",
        startsAt: "startsAt",
        durationMinutes: "durationMinutes",
        location: "location",
        clientNotes: "clientNotes",
        totalInCents: "totalInCents",
        status: "status",
        clientId: "clientId",
        staffId: "staffId",
        serviceId: "serviceId",
      },
      services: { id: "id", name: "name" },
    }));
    vi.doMock("@/lib/calendar-token", () => ({
      verifyCalendarToken: mockVerifyCalendarToken,
    }));
    // alias from drizzle-orm/pg-core would fail with plain objects; mock it
    vi.doMock("drizzle-orm/pg-core", async (importOriginal) => {
      const original = await importOriginal<typeof import("drizzle-orm/pg-core")>();
      return {
        ...original,
        alias: vi.fn().mockImplementation((table: unknown) => table),
      };
    });

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeRequest(profileId: string, token: string) {
    return new Request(`https://example.com/api/calendar/${profileId}?token=${token}`);
  }

  function makeCtx(profileId: string) {
    return { params: Promise.resolve({ profileId }) };
  }

  /* ---------- Auth ---------- */

  it("returns 401 when token is invalid", async () => {
    mockVerifyCalendarToken.mockReturnValueOnce(false);
    const res = await GET(makeRequest("profile-1", "bad-token"), makeCtx("profile-1"));
    expect(res.status).toBe(401);
  });

  /* ---------- Not found ---------- */

  it("returns 404 when profile does not exist", async () => {
    selectData[0] = []; // profile not found
    const res = await GET(makeRequest("profile-1", "tok"), makeCtx("profile-1"));
    expect(res.status).toBe(404);
  });

  /* ---------- ICS generation ---------- */

  it("returns ICS content-type for admin with bookings", async () => {
    selectData[0] = [{ role: "admin" }]; // profile
    selectData[1] = [
      {
        id: 42,
        startsAt: new Date("2026-04-01T10:00:00Z"),
        durationMinutes: 60,
        location: "Studio A",
        clientNotes: null,
        totalInCents: 8000,
        serviceName: "Haircut",
        clientFirst: "John",
        clientLast: "Doe",
        staffFirst: "Jane",
        staffLast: "Smith",
      },
    ];

    const res = await GET(makeRequest("admin-1", "tok"), makeCtx("admin-1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("booking-42@tcreativestudio.com");
    expect(ics).toContain("Haircut");
  });

  it("returns an empty ICS for admin with no upcoming bookings", async () => {
    selectData[0] = [{ role: "admin" }];
    selectData[1] = []; // no bookings

    const res = await GET(makeRequest("admin-1", "tok"), makeCtx("admin-1"));

    expect(res.status).toBe(200);
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("returns ICS for assistant (staff role)", async () => {
    selectData[0] = [{ role: "assistant" }];
    selectData[1] = [
      {
        id: 7,
        startsAt: new Date("2026-04-02T14:00:00Z"),
        durationMinutes: 45,
        location: null,
        clientNotes: "Be gentle",
        totalInCents: 5000,
        serviceName: "Color",
        clientFirst: "Bob",
        clientLast: "Brown",
        staffFirst: "Jane",
        staffLast: "Smith",
      },
    ];

    const res = await GET(makeRequest("staff-1", "tok"), makeCtx("staff-1"));

    expect(res.status).toBe(200);
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("booking-7@tcreativestudio.com");
    // Location falls back to studio name
    expect(ics).toContain("T Creative Studio");
  });

  it("sets no-store cache control", async () => {
    selectData[0] = [{ role: "admin" }];
    selectData[1] = [];

    const res = await GET(makeRequest("p1", "tok"), makeCtx("p1"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
