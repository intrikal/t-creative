import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockTrackEvent = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockRevalidatePath = vi.fn();

function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    inquiries: {
      id: "id",
      name: "name",
      email: "email",
      phone: "phone",
      interest: "interest",
      message: "message",
      status: "status",
      staffReply: "staffReply",
      repliedAt: "repliedAt",
      createdAt: "createdAt",
    },
    productInquiries: {
      id: "id",
      clientName: "clientName",
      email: "email",
      phone: "phone",
      productId: "productId",
      message: "message",
      customizations: "customizations",
      status: "status",
      quantity: "quantity",
      quotedInCents: "quotedInCents",
      internalNotes: "internalNotes",
      contactedAt: "contactedAt",
      quoteSentAt: "quoteSentAt",
      createdAt: "createdAt",
    },
    products: {
      id: "id",
      title: "title",
      category: "category",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/emails/InquiryReply", () => ({ InquiryReply: vi.fn(() => null) }));
  vi.doMock("@/emails/ProductQuote", () => ({ ProductQuote: vi.fn(() => null) }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("inquiries/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getInquiries ---- */

  describe("getInquiries", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getInquiries } = await import("./actions");
      await expect(getInquiries()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no inquiries", async () => {
      vi.resetModules();
      setupMocks();
      const { getInquiries } = await import("./actions");
      const result = await getInquiries();
      expect(result).toEqual([]);
    });

    it("maps rows to InquiryRow shape with ISO date strings", async () => {
      vi.resetModules();
      const now = new Date("2026-03-01T12:00:00Z");
      const row = {
        id: 1,
        name: "Alice Smith",
        email: "alice@example.com",
        phone: null,
        interest: "lash" as const,
        message: "Hello",
        status: "new" as const,
        staffReply: null,
        repliedAt: null,
        createdAt: now,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInquiries } = await import("./actions");
      const result = await getInquiries();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        name: "Alice Smith",
        email: "alice@example.com",
        createdAt: now.toISOString(),
        repliedAt: null,
      });
    });

    it("serialises repliedAt to ISO string when present", async () => {
      vi.resetModules();
      const now = new Date("2026-03-01T12:00:00Z");
      const replied = new Date("2026-03-02T08:00:00Z");
      const row = {
        id: 2,
        name: "Bob",
        email: "bob@example.com",
        phone: null,
        interest: null,
        message: "Hi",
        status: "replied" as const,
        staffReply: "Thanks!",
        repliedAt: replied,
        createdAt: now,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInquiries } = await import("./actions");
      const result = await getInquiries();
      expect(result[0].repliedAt).toBe(replied.toISOString());
    });
  });

  /* ---- getProductInquiries ---- */

  describe("getProductInquiries", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getProductInquiries } = await import("./actions");
      await expect(getProductInquiries()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no product inquiries", async () => {
      vi.resetModules();
      setupMocks();
      const { getProductInquiries } = await import("./actions");
      const result = await getProductInquiries();
      expect(result).toEqual([]);
    });

    it("maps rows with fallback values for null title/category", async () => {
      vi.resetModules();
      const now = new Date("2026-03-01T12:00:00Z");
      const row = {
        id: 5,
        clientName: "Carol",
        email: "carol@example.com",
        phone: null,
        productId: 3,
        productTitle: null,
        productCategory: null,
        message: "Interested",
        customizations: null,
        status: "new" as const,
        quantity: 1,
        quotedInCents: null,
        internalNotes: null,
        contactedAt: null,
        quoteSentAt: null,
        createdAt: now,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getProductInquiries } = await import("./actions");
      const result = await getProductInquiries();
      expect(result[0].productTitle).toBe("Unknown Product");
      expect(result[0].productCategory).toBe("");
      expect(result[0].createdAt).toBe(now.toISOString());
    });
  });

  /* ---- updateInquiryStatus ---- */

  describe("updateInquiryStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateInquiryStatus } = await import("./actions");
      await expect(updateInquiryStatus(1, "read")).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with the new status", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateInquiryStatus } = await import("./actions");
      await updateInquiryStatus(7, "archived");
      expect(mockUpdateSet).toHaveBeenCalledWith({ status: "archived" });
    });

    it("revalidates /dashboard/inquiries", async () => {
      vi.resetModules();
      setupMocks();
      const { updateInquiryStatus } = await import("./actions");
      await updateInquiryStatus(1, "read");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/inquiries");
    });
  });

  /* ---- replyToInquiry ---- */

  describe("replyToInquiry", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { replyToInquiry } = await import("./actions");
      await expect(replyToInquiry(1, "Thanks")).rejects.toThrow("Not authenticated");
    });

    it("updates inquiry with staffReply, status='replied', and repliedAt", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([{ email: "alice@example.com", name: "Alice", message: "Hello" }]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { replyToInquiry } = await import("./actions");
      await replyToInquiry(3, "Thank you for reaching out!");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          staffReply: "Thank you for reaching out!",
          status: "replied",
          repliedAt: expect.any(Date),
        }),
      );
    });

    it("sends email when inquiry has an email", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([{ email: "alice@example.com", name: "Alice", message: "Hi" }]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { replyToInquiry } = await import("./actions");
      await replyToInquiry(3, "Thanks!");
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "alice@example.com",
          entityType: "inquiry_reply",
        }),
      );
    });

    it("does not send email when inquiry has no email", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ email: null, name: "Anon", message: "Hi" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { replyToInquiry } = await import("./actions");
      await replyToInquiry(3, "Thanks!");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("calls trackEvent with inquiry_replied", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { replyToInquiry } = await import("./actions");
      await replyToInquiry(10, "Reply text");
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "inquiry_replied", { inquiryId: 10 });
    });

    it("revalidates /dashboard/inquiries", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { replyToInquiry } = await import("./actions");
      await replyToInquiry(1, "Reply");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/inquiries");
    });
  });

  /* ---- deleteInquiry ---- */

  describe("deleteInquiry", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteInquiry } = await import("./actions");
      await expect(deleteInquiry(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the inquiry", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteInquiry } = await import("./actions");
      await deleteInquiry(5);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates /dashboard/inquiries", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteInquiry } = await import("./actions");
      await deleteInquiry(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/inquiries");
    });
  });

  /* ---- updateProductInquiryStatus ---- */

  describe("updateProductInquiryStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateProductInquiryStatus } = await import("./actions");
      await expect(updateProductInquiryStatus(1, "contacted")).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with status 'in_progress'", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateProductInquiryStatus } = await import("./actions");
      await updateProductInquiryStatus(3, "in_progress");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "in_progress" }),
      );
    });

    it("sets contactedAt when status is 'contacted'", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateProductInquiryStatus } = await import("./actions");
      await updateProductInquiryStatus(3, "contacted");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "contacted", contactedAt: expect.any(Date) }),
      );
    });

    it("sets quoteSentAt when status is 'quote_sent'", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateProductInquiryStatus } = await import("./actions");
      await updateProductInquiryStatus(3, "quote_sent");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "quote_sent", quoteSentAt: expect.any(Date) }),
      );
    });

    it("revalidates /dashboard/inquiries", async () => {
      vi.resetModules();
      setupMocks();
      const { updateProductInquiryStatus } = await import("./actions");
      await updateProductInquiryStatus(1, "completed");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/inquiries");
    });
  });

  /* ---- sendProductQuote ---- */

  describe("sendProductQuote", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { sendProductQuote } = await import("./actions");
      await expect(sendProductQuote(1, 5000)).rejects.toThrow("Not authenticated");
    });

    it("updates quotedInCents, quoteSentAt, and status='quote_sent'", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendProductQuote } = await import("./actions");
      await sendProductQuote(5, 12500);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          quotedInCents: 12500,
          status: "quote_sent",
          quoteSentAt: expect.any(Date),
        }),
      );
    });

    it("sends quote email when row has an email", async () => {
      vi.resetModules();
      const updateCount = 0;
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              email: "carol@example.com",
              clientName: "Carol",
              productTitle: "Ring",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendProductQuote } = await import("./actions");
      await sendProductQuote(5, 12500);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "carol@example.com",
          entityType: "product_quote",
        }),
      );
    });

    it("does not send email when row has no email", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ email: null, clientName: "Anon", productTitle: null }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendProductQuote } = await import("./actions");
      await sendProductQuote(5, 12500);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("calls trackEvent with product_quote_sent", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendProductQuote } = await import("./actions");
      await sendProductQuote(8, 9900);
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "product_quote_sent", {
        inquiryId: 8,
        amountInCents: 9900,
      });
    });

    it("revalidates /dashboard/inquiries", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendProductQuote } = await import("./actions");
      await sendProductQuote(1, 5000);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/inquiries");
    });
  });

  /* ---- deleteProductInquiry ---- */

  describe("deleteProductInquiry", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteProductInquiry } = await import("./actions");
      await expect(deleteProductInquiry(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the product inquiry", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteProductInquiry } = await import("./actions");
      await deleteProductInquiry(9);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates /dashboard/inquiries", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteProductInquiry } = await import("./actions");
      await deleteProductInquiry(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/inquiries");
    });
  });
});
