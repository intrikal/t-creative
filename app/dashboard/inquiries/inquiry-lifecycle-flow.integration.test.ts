import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the inquiry lifecycle flow.
 *
 * These tests verify the complete lifecycle of `replyToInquiry`,
 * `updateInquiryStatus`, and `sendProductQuote` using a shared stateful
 * mock DB that tracks state across DB calls to verify the correct
 * sequence of mutations.
 */

/* ------------------------------------------------------------------ */
/*  Stateful DB mock                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const _inquiries: MockRow[] = [];
  const _productInquiries: MockRow[] = [];

  // Queue of rows to return for select calls, consumed in order
  const selectQueue: unknown[][] = [];

  function makeChain(rows: unknown[]) {
    const resolved = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: (_fields?: any) => resolved,
      then: resolved.then.bind(resolved),
      catch: resolved.catch.bind(resolved),
      finally: resolved.finally.bind(resolved),
    };
    return chain;
  }

  return {
    // State accessors for assertions
    _inquiries,
    _productInquiries,

    // Queue the next set of rows that a select call should return
    _queueSelect: (rows: unknown[]) => {
      selectQueue.push(rows);
    },

    select: vi.fn((_fields?: any) => {
      const rows = selectQueue.shift() ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow) => {
        return {
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          if ("staffReply" in values) {
            // replyToInquiry — update last inquiry
            const inquiry = _inquiries[_inquiries.length - 1];
            if (inquiry) Object.assign(inquiry, values);
          } else if ("quotedInCents" in values) {
            // sendProductQuote — update last product inquiry
            const productInquiry = _productInquiries[_productInquiries.length - 1];
            if (productInquiry) Object.assign(productInquiry, values);
          } else if ("status" in values) {
            // updateInquiryStatus — update last inquiry (generic status update)
            const inquiry = _inquiries[_inquiries.length - 1];
            if (inquiry) Object.assign(inquiry, values);
          }
          return Promise.resolve();
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    inquiries: {
      id: "id",
      clientId: "clientId",
      status: "status",
      name: "name",
      email: "email",
      phone: "phone",
      message: "message",
      staffReply: "staffReply",
      repliedAt: "repliedAt",
      createdAt: "createdAt",
    },
    productInquiries: {
      id: "id",
      productId: "productId",
      clientId: "clientId",
      status: "status",
      clientName: "clientName",
      email: "email",
      phone: "phone",
      message: "message",
      quotedInCents: "quotedInCents",
      quoteSentAt: "quoteSentAt",
      contactedAt: "contactedAt",
      createdAt: "createdAt",
    },
    products: {
      id: "id",
      title: "title",
    },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));

  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({ aliasName: name })),
    pgTable: vi.fn(),
    pgEnum: vi.fn(),
    text: vi.fn(),
    integer: vi.fn(),
    boolean: vi.fn(),
    timestamp: vi.fn(),
    uuid: vi.fn(),
  }));

  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: vi.fn().mockResolvedValue(null),
  }));

  vi.doMock("@/lib/posthog", () => ({
    trackEvent: vi.fn(),
  }));

  vi.doMock("@/lib/audit", () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

  vi.doMock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: mockGetUser },
    }),
  }));

  vi.doMock("@/emails/InquiryReply", () => ({
    InquiryReply: vi.fn(() => null),
  }));

  vi.doMock("@/emails/ProductQuote", () => ({
    ProductQuote: vi.fn(() => null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Integration tests                                                  */
/* ------------------------------------------------------------------ */

describe("Inquiry lifecycle flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
  });

  /* ---- replyToInquiry ---- */

  describe("replyToInquiry", () => {
    it("sets status to replied and stores staffReply", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed an inquiry to update
      db._inquiries.push({
        id: 1,
        name: "Alice",
        email: "alice@example.com",
        message: "Hello",
        status: "new",
        staffReply: null,
        repliedAt: null,
      });

      // Queue the follow-up SELECT for the email send path
      db._queueSelect([{ email: "alice@example.com", name: "Alice", message: "Hello" }]);

      setupMocks(db);
      const { replyToInquiry } = await import("./actions");

      await replyToInquiry(1, "Thanks!");

      expect(db._inquiries[0].status).toBe("replied");
      expect(db._inquiries[0].staffReply).toBe("Thanks!");
    });

    it("sends a reply email to the inquiry submitter", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed the inquiry
      db._inquiries.push({
        id: 1,
        name: "Bob",
        email: "bob@example.com",
        message: "Hi",
        status: "new",
        staffReply: null,
        repliedAt: null,
      });

      // Queue the SELECT returning the inquiry's contact details
      db._queueSelect([{ email: "bob@example.com", name: "Bob", message: "Hi" }]);

      setupMocks(db);
      const { replyToInquiry } = await import("./actions");

      await replyToInquiry(1, "Thank you for reaching out!");

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "bob@example.com",
          entityType: "inquiry_reply",
        }),
      );
    });

    it("does not throw when email select returns nothing", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed the inquiry
      db._inquiries.push({
        id: 1,
        name: "Carol",
        email: "carol@example.com",
        message: "Question",
        status: "new",
        staffReply: null,
        repliedAt: null,
      });

      // Queue an empty result — no inquiry row found for the email step
      db._queueSelect([]);

      setupMocks(db);
      const { replyToInquiry } = await import("./actions");

      await expect(replyToInquiry(1, "We will get back to you.")).resolves.not.toThrow();
    });
  });

  /* ---- updateInquiryStatus ---- */

  describe("updateInquiryStatus", () => {
    it("updates status to archived", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed an inquiry in the replied state
      db._inquiries.push({
        id: 1,
        name: "Dave",
        email: "dave@example.com",
        message: "Old inquiry",
        status: "replied",
        staffReply: "Got it",
        repliedAt: new Date(),
      });

      setupMocks(db);
      const { updateInquiryStatus } = await import("./actions");

      await updateInquiryStatus(1, "archived");

      expect(db._inquiries[0].status).toBe("archived");
    });
  });

  /* ---- sendProductQuote ---- */

  describe("sendProductQuote", () => {
    it("sets quotedInCents and status to quote_sent", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed a product inquiry
      db._productInquiries.push({
        id: 1,
        clientName: "Eve",
        email: "eve@example.com",
        productId: 10,
        status: "new",
        quotedInCents: null,
        quoteSentAt: null,
      });

      // Queue the follow-up SELECT for the email send path
      db._queueSelect([
        { email: "eve@example.com", clientName: "Eve", productTitle: "Custom Ring" },
      ]);

      setupMocks(db);
      const { sendProductQuote } = await import("./actions");

      await sendProductQuote(1, 5000);

      expect(db._productInquiries[0].quotedInCents).toBe(5000);
      expect(db._productInquiries[0].status).toBe("quote_sent");
    });

    it("sends a quote email with product title", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed a product inquiry
      db._productInquiries.push({
        id: 1,
        clientName: "Carol",
        email: "carol@example.com",
        productId: 20,
        status: "new",
        quotedInCents: null,
        quoteSentAt: null,
      });

      // Queue the SELECT returning product + client details for the email
      db._queueSelect([
        { email: "carol@example.com", clientName: "Carol", productTitle: "Custom Ring" },
      ]);

      setupMocks(db);
      const { sendProductQuote } = await import("./actions");

      await sendProductQuote(1, 7500);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "carol@example.com",
          entityType: "product_quote",
        }),
      );
    });
  });
});
