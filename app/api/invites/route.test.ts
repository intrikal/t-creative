/**
 * Tests for POST /api/invites — admin-only assistant invite link generator.
 *
 * Covers:
 *  - Auth: unauthenticated (403), no profile (403), non-admin roles
 *    including client and assistant (403)
 *  - Validation: missing email (400), non-string email (400)
 *  - Happy path: returns inviteUrl containing the generated token and site URL
 *  - Integration: createInviteToken called with correct email, sendEmail
 *    called with invite email template
 *  - Resilience: email send failure → still returns inviteUrl (non-fatal)
 *  - Env fallback: missing NEXT_PUBLIC_SITE_URL → URL uses localhost:3000
 *
 * Mocks: getCurrentUser (auth), createInviteToken, sendEmail,
 * InviteEmail component, settings-actions (businessProfile).
 */
// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockGetCurrentUser = vi.fn();
const mockCreateInviteToken = vi.fn();
const mockSendEmail = vi.fn();

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("POST /api/invites", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      profile: { role: "admin" },
    });
    mockCreateInviteToken.mockResolvedValue("test-invite-token");
    mockSendEmail.mockResolvedValue(true);
    process.env.NEXT_PUBLIC_SITE_URL = "https://studio.example.com";

    vi.resetModules();

    vi.doMock("@/lib/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
    vi.doMock("@/lib/invite", () => ({ createInviteToken: mockCreateInviteToken }));
    vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
    vi.doMock("@/emails/InviteEmail", () => ({
      InviteEmail: vi.fn().mockReturnValue(null),
    }));

    const mod = await import("./route");
    POST = mod.POST;
  });

  function makePost(body: unknown) {
    return new Request("https://example.com/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /* ---------- Auth ---------- */

  it("returns 403 when no user is authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(makePost({ email: "assistant@example.com" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when user has no profile", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ profile: null });
    const res = await POST(makePost({ email: "assistant@example.com" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when user is not an admin", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ profile: { role: "client" } });
    const res = await POST(makePost({ email: "assistant@example.com" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 for assistant role", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ profile: { role: "assistant" } });
    const res = await POST(makePost({ email: "new@example.com" }));
    expect(res.status).toBe(403);
  });

  /* ---------- Validation ---------- */

  it("returns 400 when email is missing", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("Email") });
  });

  it("returns 400 when email is not a string", async () => {
    const res = await POST(makePost({ email: 12345 }));
    expect(res.status).toBe(400);
  });

  /* ---------- Happy path ---------- */

  it("returns inviteUrl on success", async () => {
    const res = await POST(makePost({ email: "jane@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("inviteUrl");
    expect(body.inviteUrl).toContain("test-invite-token");
    expect(body.inviteUrl).toContain("https://studio.example.com");
  });

  it("calls createInviteToken with the provided email", async () => {
    await POST(makePost({ email: "jane@example.com" }));
    expect(mockCreateInviteToken).toHaveBeenCalledWith("jane@example.com");
  });

  it("sends invite email", async () => {
    await POST(makePost({ email: "jane@example.com" }));
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        entityType: "invite",
        localId: "jane@example.com",
      }),
    );
  });

  it("still returns inviteUrl even if email send fails", async () => {
    mockSendEmail.mockResolvedValueOnce(false);
    const res = await POST(makePost({ email: "jane@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("inviteUrl");
  });

  it("builds invite URL with localhost fallback when NEXT_PUBLIC_SITE_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    // Need fresh import after env change since siteUrl is read at request time
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
    vi.doMock("@/lib/invite", () => ({ createInviteToken: mockCreateInviteToken }));
    vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
    vi.doMock("@/emails/InviteEmail", () => ({ InviteEmail: vi.fn().mockReturnValue(null) }));
    const mod = await import("./route");

    const res = await mod.POST(makePost({ email: "jane@example.com" }));
    const body = await res.json();
    expect(body.inviteUrl).toContain("localhost:3000");
  });
});
