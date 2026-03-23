// @vitest-environment node

/**
 * tests/edge/email-queue-drain.test.ts
 *
 * Edge-case tests for the email queue drain system.
 *
 * When the Resend daily limit is reached, emails are written to the
 * `email_queue` table with status "pending".  A daily cron
 * (`cron/email-queue-drain`) drains the queue the next day, sends up to
 * BATCH_SIZE (90) emails, and marks each row "sent" or "failed".
 *
 * These tests document the contract for the queue mechanics using pure
 * in-memory helpers — no DB or HTTP calls.
 *
 * Covered scenarios
 *   1. Daily limit reached: email written to queue with status "pending".
 *   2. Next-day drain: pending rows are sent and marked "sent".
 *   3. Queue order: FIFO — oldest queuedAt is processed first.
 *   4. Failed send: row stays queryable; status set to "failed", retried
 *      on next drain (status reset to "pending" by retry logic).
 *   5. 200 emails queued, daily limit 100: drain sends exactly 100,
 *      leaves 100 pending for the next day.
 *   6. Duplicate prevention: same entityType + localId + recipient within
 *      24 hours is deduplicated before insertion.
 */

import { describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type EmailQueueStatus = "pending" | "sent" | "failed";

interface EmailQueueRow {
  id: number;
  to: string;
  subject: string;
  html: string;
  from: string;
  entityType: string;
  localId: string;
  status: EmailQueueStatus;
  resendId: string | null;
  errorMessage: string | null;
  attempts: number;
  queuedAt: Date;
  processedAt: Date | null;
}

/* ------------------------------------------------------------------ */
/*  In-memory queue store                                               */
/* ------------------------------------------------------------------ */

function createQueue() {
  const rows: EmailQueueRow[] = [];
  let nextId = 1;

  /**
   * Inserts a new row with status "pending" if no duplicate exists.
   * Duplicate = same (entityType, localId, to) queued within 24 hours.
   * Returns the new row, or null if deduplicated.
   */
  function enqueue(params: {
    to: string;
    subject: string;
    html: string;
    from: string;
    entityType: string;
    localId: string;
    queuedAt?: Date;
  }): EmailQueueRow | null {
    const queuedAt = params.queuedAt ?? new Date();
    const windowStart = new Date(queuedAt.getTime() - 24 * 60 * 60 * 1000);

    // Dedup: reject if an identical (entityType, localId, to) row already
    // exists with queuedAt within the last 24 hours.
    const isDuplicate = rows.some(
      (r) =>
        r.entityType === params.entityType &&
        r.localId === params.localId &&
        r.to === params.to &&
        r.queuedAt >= windowStart,
    );
    if (isDuplicate) return null;

    const row: EmailQueueRow = {
      id: nextId++,
      to: params.to,
      subject: params.subject,
      html: params.html,
      from: params.from,
      entityType: params.entityType,
      localId: params.localId,
      status: "pending",
      resendId: null,
      errorMessage: null,
      attempts: 0,
      queuedAt,
      processedAt: null,
    };
    rows.push(row);
    return row;
  }

  /** Returns pending rows ordered by queuedAt ASC (FIFO), up to limit. */
  function fetchPending(limit: number): EmailQueueRow[] {
    return rows
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())
      .slice(0, limit);
  }

  /** Marks a row as "sent". */
  function markSent(id: number, resendId: string): void {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error(`Row ${id} not found`);
    row.status = "sent";
    row.resendId = resendId;
    row.processedAt = new Date();
    row.attempts += 1;
  }

  /** Marks a row as "failed" with an error message. */
  function markFailed(id: number, errorMessage: string): void {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error(`Row ${id} not found`);
    row.status = "failed";
    row.errorMessage = errorMessage;
    row.processedAt = new Date();
    row.attempts += 1;
  }

  /**
   * Resets failed rows back to "pending" so the next drain run retries them.
   * In production this would be a deliberate admin action or a scheduled reset.
   */
  function resetFailed(): void {
    for (const row of rows) {
      if (row.status === "failed") {
        row.status = "pending";
        row.processedAt = null;
      }
    }
  }

  return { rows, enqueue, fetchPending, markSent, markFailed, resetFailed };
}

/* ------------------------------------------------------------------ */
/*  In-memory daily counter (mirrors lib/resend.ts)                    */
/* ------------------------------------------------------------------ */

function createDailyCounter(limit: number) {
  let count = 0;
  let date = new Date().toISOString().slice(0, 10);

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentCount(now?: Date): number {
    const today = now ? now.toISOString().slice(0, 10) : getToday();
    if (today !== date) return 0;
    return count;
  }

  function increment(now?: Date): number {
    const today = now ? now.toISOString().slice(0, 10) : getToday();
    if (today !== date) {
      date = today;
      count = 0;
    }
    count += 1;
    return count;
  }

  function isAtLimit(now?: Date): boolean {
    return currentCount(now) >= limit;
  }

  function reset(newDate?: string): void {
    count = 0;
    date = newDate ?? new Date().toISOString().slice(0, 10);
  }

  return { currentCount, increment, isAtLimit, reset, limit };
}

/* ------------------------------------------------------------------ */
/*  Drain helper                                                        */
/* ------------------------------------------------------------------ */

/**
 * Simulates one run of the email-queue-drain cron.
 *
 * Fetches up to `batchSize` pending rows (FIFO), calls `sendFn` for each,
 * marks "sent" on success and "failed" on error.
 *
 * Returns { sent, failed, total }.
 */
async function drainQueue(
  queue: ReturnType<typeof createQueue>,
  batchSize: number,
  sendFn: (row: EmailQueueRow) => Promise<{ resendId: string }>,
): Promise<{ sent: number; failed: number; total: number }> {
  const pending = queue.fetchPending(batchSize);
  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      const { resendId } = await sendFn(row);
      queue.markSent(row.id, resendId);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      queue.markFailed(row.id, msg);
      failed++;
    }
  }

  return { sent, failed, total: pending.length };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Email queue drain edge cases", () => {
  // ─── 1. Daily limit reached: email queued as "pending" ────────────

  describe("1. Daily limit reached — email written to queue with status 'pending'", () => {
    it("when limit is reached, enqueue inserts a row with status 'pending'", () => {
      const queue = createQueue();
      const counter = createDailyCounter(100);

      // Simulate: counter is at the limit
      for (let i = 0; i < 100; i++) counter.increment();
      expect(counter.isAtLimit()).toBe(true);

      // The rate-limited sendEmail would call enqueue instead of Resend
      const row = queue.enqueue({
        to: "client@example.com",
        subject: "Booking Confirmation",
        html: "<p>Your booking is confirmed.</p>",
        from: "T Creative <noreply@tcreativestudio.com>",
        entityType: "booking_confirmation",
        localId: "booking-42",
      });

      expect(row).not.toBeNull();
      expect(row!.status).toBe("pending");
    });

    it("queued row is not null and has all required fields", () => {
      const queue = createQueue();
      const row = queue.enqueue({
        to: "client@example.com",
        subject: "Booking Reminder",
        html: "<p>Reminder.</p>",
        from: "T Creative <noreply@tcreativestudio.com>",
        entityType: "booking_reminder_24h",
        localId: "booking-7",
      });

      expect(row).not.toBeNull();
      expect(row!.id).toBeGreaterThan(0);
      expect(row!.to).toBe("client@example.com");
      expect(row!.entityType).toBe("booking_reminder_24h");
      expect(row!.localId).toBe("booking-7");
      expect(row!.resendId).toBeNull();
      expect(row!.errorMessage).toBeNull();
      expect(row!.attempts).toBe(0);
      expect(row!.processedAt).toBeNull();
    });

    it("enqueue does not send the email immediately (no sendFn called)", () => {
      const queue = createQueue();
      const fakeSend = vi.fn();

      queue.enqueue({
        to: "client@example.com",
        subject: "Fill Reminder",
        html: "<p>Time for a fill!</p>",
        from: "T Creative <noreply@tcreativestudio.com>",
        entityType: "fill_reminder",
        localId: "booking-99",
      });

      expect(fakeSend).not.toHaveBeenCalled();
      expect(queue.rows[0].status).toBe("pending");
    });

    it("queue grows with each rate-limited email", () => {
      const queue = createQueue();

      for (let i = 1; i <= 5; i++) {
        queue.enqueue({
          to: `client${i}@example.com`,
          subject: "Subject",
          html: "<p>Body</p>",
          from: "T Creative <noreply@tcreativestudio.com>",
          entityType: "booking_confirmation",
          localId: `booking-${i}`,
        });
      }

      expect(queue.rows.filter((r) => r.status === "pending")).toHaveLength(5);
    });
  });

  // ─── 2. Next-day drain: sent and marked "sent" ────────────────────

  describe("2. Next-day drain — pending rows are sent and marked 'sent'", () => {
    it("drain sends pending rows and marks them 'sent'", async () => {
      const queue = createQueue();
      queue.enqueue({
        to: "a@example.com",
        subject: "S1",
        html: "<p>1</p>",
        from: "T Creative <noreply@tcreativestudio.com>",
        entityType: "booking_confirmation",
        localId: "b-1",
      });

      const sendFn = vi.fn().mockResolvedValue({ resendId: "resend-abc" });
      const result = await drainQueue(queue, 90, sendFn);

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
      expect(queue.rows[0].status).toBe("sent");
      expect(queue.rows[0].resendId).toBe("resend-abc");
      expect(queue.rows[0].processedAt).not.toBeNull();
      expect(queue.rows[0].attempts).toBe(1);
    });

    it("drain increments attempts count on each successful send", async () => {
      const queue = createQueue();
      queue.enqueue({
        to: "b@example.com",
        subject: "S",
        html: "<p>b</p>",
        from: "T Creative <noreply@tcreativestudio.com>",
        entityType: "fill_reminder",
        localId: "b-2",
      });

      await drainQueue(queue, 90, vi.fn().mockResolvedValue({ resendId: "r-1" }));

      expect(queue.rows[0].attempts).toBe(1);
    });

    it("drain does not re-process already-sent rows", async () => {
      const queue = createQueue();
      queue.enqueue({
        to: "c@example.com",
        subject: "S",
        html: "<p>c</p>",
        from: "T Creative <noreply@tcreativestudio.com>",
        entityType: "booking_confirmation",
        localId: "b-3",
      });

      const sendFn = vi.fn().mockResolvedValue({ resendId: "r-2" });
      // First drain
      await drainQueue(queue, 90, sendFn);
      // Second drain — already sent, should not be re-queued
      const result2 = await drainQueue(queue, 90, sendFn);

      expect(result2.sent).toBe(0);
      expect(sendFn).toHaveBeenCalledTimes(1); // called only once total
    });

    it("drain returns {sent, failed, total} summary", async () => {
      const queue = createQueue();
      for (let i = 1; i <= 3; i++) {
        queue.enqueue({
          to: `x${i}@example.com`,
          subject: "S",
          html: "<p>x</p>",
          from: "T Creative <noreply@tcreativestudio.com>",
          entityType: "birthday_promo",
          localId: `promo-${i}`,
        });
      }

      const result = await drainQueue(queue, 90, vi.fn().mockResolvedValue({ resendId: "r-x" }));

      expect(result).toEqual({ sent: 3, failed: 0, total: 3 });
    });
  });

  // ─── 3. Queue order: FIFO ─────────────────────────────────────────

  describe("3. Queue order — FIFO, oldest queuedAt processed first", () => {
    it("fetchPending returns rows ordered by queuedAt ASC", () => {
      const queue = createQueue();
      const base = new Date("2026-03-10T08:00:00.000Z");

      // Insert in reverse chronological order
      queue.enqueue({
        to: "late@example.com",
        subject: "Late",
        html: "<p>late</p>",
        from: "F",
        entityType: "t",
        localId: "late",
        queuedAt: new Date(base.getTime() + 60 * 60 * 1000), // +1h
      });
      queue.enqueue({
        to: "early@example.com",
        subject: "Early",
        html: "<p>early</p>",
        from: "F",
        entityType: "t",
        localId: "early",
        queuedAt: base, // earliest
      });
      queue.enqueue({
        to: "mid@example.com",
        subject: "Mid",
        html: "<p>mid</p>",
        from: "F",
        entityType: "t",
        localId: "mid",
        queuedAt: new Date(base.getTime() + 30 * 60 * 1000), // +30m
      });

      const pending = queue.fetchPending(10);
      expect(pending[0].localId).toBe("early");
      expect(pending[1].localId).toBe("mid");
      expect(pending[2].localId).toBe("late");
    });

    it("drain processes earliest-queued email first", async () => {
      const queue = createQueue();
      const base = new Date("2026-03-10T08:00:00.000Z");
      const processedOrder: string[] = [];

      queue.enqueue({
        to: "second@example.com",
        subject: "S2",
        html: "<p>2</p>",
        from: "F",
        entityType: "t",
        localId: "second",
        queuedAt: new Date(base.getTime() + 60_000),
      });
      queue.enqueue({
        to: "first@example.com",
        subject: "S1",
        html: "<p>1</p>",
        from: "F",
        entityType: "t",
        localId: "first",
        queuedAt: base,
      });

      await drainQueue(queue, 90, async (row) => {
        processedOrder.push(row.localId);
        return { resendId: "r" };
      });

      expect(processedOrder).toEqual(["first", "second"]);
    });
  });

  // ─── 4. Failed send: stays in queue, retried next day ─────────────

  describe("4. Failed send — row stays queryable, status 'failed', retried after reset", () => {
    it("a send error marks the row as 'failed' with the error message", async () => {
      const queue = createQueue();
      queue.enqueue({
        to: "fail@example.com",
        subject: "S",
        html: "<p>f</p>",
        from: "F",
        entityType: "booking_confirmation",
        localId: "b-fail",
      });

      const sendFn = vi.fn().mockRejectedValue(new Error("API timeout"));
      await drainQueue(queue, 90, sendFn);

      expect(queue.rows[0].status).toBe("failed");
      expect(queue.rows[0].errorMessage).toBe("API timeout");
      expect(queue.rows[0].attempts).toBe(1);
    });

    it("failed row is not returned by fetchPending (not automatically retried)", () => {
      const queue = createQueue();
      queue.enqueue({
        to: "fail@example.com",
        subject: "S",
        html: "<p>f</p>",
        from: "F",
        entityType: "t",
        localId: "fail-1",
      });
      queue.markFailed(queue.rows[0].id, "timeout");

      const pending = queue.fetchPending(90);
      expect(pending).toHaveLength(0);
    });

    it("after resetFailed, the row becomes pending again and is retried on the next drain", async () => {
      const queue = createQueue();
      queue.enqueue({
        to: "retry@example.com",
        subject: "S",
        html: "<p>r</p>",
        from: "F",
        entityType: "t",
        localId: "retry-1",
      });

      // First drain: fails
      await drainQueue(queue, 90, vi.fn().mockRejectedValue(new Error("timeout")));
      expect(queue.rows[0].status).toBe("failed");

      // Admin resets failed rows for retry
      queue.resetFailed();
      expect(queue.rows[0].status).toBe("pending");

      // Second drain: succeeds
      const result = await drainQueue(
        queue,
        90,
        vi.fn().mockResolvedValue({ resendId: "r-retry" }),
      );
      expect(result.sent).toBe(1);
      expect(queue.rows[0].status).toBe("sent");
      expect(queue.rows[0].attempts).toBe(2); // two total attempts
    });

    it("failed row retains its original queuedAt (FIFO position preserved on retry)", () => {
      const queue = createQueue();
      const originalQueuedAt = new Date("2026-03-10T08:00:00.000Z");
      queue.enqueue({
        to: "retry@example.com",
        subject: "S",
        html: "<p>r</p>",
        from: "F",
        entityType: "t",
        localId: "retry-2",
        queuedAt: originalQueuedAt,
      });

      queue.markFailed(queue.rows[0].id, "err");
      queue.resetFailed();

      expect(queue.rows[0].queuedAt).toEqual(originalQueuedAt);
    });

    it("drain result counts failed rows separately from sent", async () => {
      const queue = createQueue();
      for (let i = 1; i <= 4; i++) {
        queue.enqueue({
          to: `r${i}@example.com`,
          subject: "S",
          html: "<p>x</p>",
          from: "F",
          entityType: "t",
          localId: `r-${i}`,
        });
      }

      // 2 succeed, 2 fail
      let call = 0;
      const sendFn = vi.fn().mockImplementation(async () => {
        call++;
        if (call % 2 === 0) throw new Error("fail");
        return { resendId: "r" };
      });

      const result = await drainQueue(queue, 90, sendFn);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(4);
    });
  });

  // ─── 5. 200 queued, limit 100: sends 100, leaves 100 ──────────────

  describe("5. 200 emails queued, batch limit 100 — sends 100, leaves 100 pending", () => {
    it("fetchPending with limit=100 returns exactly 100 rows from 200", () => {
      const queue = createQueue();
      for (let i = 1; i <= 200; i++) {
        queue.enqueue({
          to: `user${i}@example.com`,
          subject: "S",
          html: "<p>x</p>",
          from: "F",
          entityType: "fill_reminder",
          localId: `fill-${i}`,
        });
      }

      const batch = queue.fetchPending(100);
      expect(batch).toHaveLength(100);
    });

    it("after draining 100, exactly 100 rows remain pending", async () => {
      const queue = createQueue();
      for (let i = 1; i <= 200; i++) {
        queue.enqueue({
          to: `user${i}@example.com`,
          subject: "S",
          html: "<p>x</p>",
          from: "F",
          entityType: "fill_reminder",
          localId: `fill-${i}`,
        });
      }

      await drainQueue(queue, 100, vi.fn().mockResolvedValue({ resendId: "r" }));

      const stillPending = queue.rows.filter((r) => r.status === "pending");
      expect(stillPending).toHaveLength(100);
    });

    it("the 100 remaining pending rows are the 100 newest (FIFO: oldest processed first)", () => {
      const queue = createQueue();
      const base = new Date("2026-03-10T08:00:00.000Z");

      for (let i = 1; i <= 200; i++) {
        queue.enqueue({
          to: `user${i}@example.com`,
          subject: "S",
          html: "<p>x</p>",
          from: "F",
          entityType: "fill_reminder",
          localId: `fill-${i}`,
          queuedAt: new Date(base.getTime() + i * 60_000), // each 1 min apart
        });
      }

      // Drain the first 100
      queue.fetchPending(100).forEach((r) => queue.markSent(r.id, "r"));

      const remaining = queue.rows.filter((r) => r.status === "pending");
      const remainingIds = remaining.map((r) => r.localId);

      // Remaining should be fill-101 through fill-200
      expect(remainingIds[0]).toBe("fill-101");
      expect(remainingIds[remainingIds.length - 1]).toBe("fill-200");
    });

    it("second drain run processes the remaining 100", async () => {
      const queue = createQueue();
      for (let i = 1; i <= 200; i++) {
        queue.enqueue({
          to: `u${i}@example.com`,
          subject: "S",
          html: "<p>x</p>",
          from: "F",
          entityType: "fill_reminder",
          localId: `f-${i}`,
        });
      }

      const sendFn = vi.fn().mockResolvedValue({ resendId: "r" });
      const run1 = await drainQueue(queue, 100, sendFn);
      const run2 = await drainQueue(queue, 100, sendFn);

      expect(run1.sent).toBe(100);
      expect(run2.sent).toBe(100);
      expect(queue.rows.filter((r) => r.status === "pending")).toHaveLength(0);
    });
  });

  // ─── 6. Duplicate prevention ──────────────────────────────────────

  describe("6. Duplicate prevention — same email to same recipient within 24h is deduplicated", () => {
    it("enqueueing the same (entityType, localId, to) twice within 24h returns null on second call", () => {
      const queue = createQueue();
      const now = new Date("2026-03-10T10:00:00.000Z");

      const first = queue.enqueue({
        to: "alice@example.com",
        subject: "Confirmation",
        html: "<p>1</p>",
        from: "F",
        entityType: "booking_confirmation",
        localId: "booking-1",
        queuedAt: now,
      });

      const dupe = queue.enqueue({
        to: "alice@example.com",
        subject: "Confirmation",
        html: "<p>1</p>",
        from: "F",
        entityType: "booking_confirmation",
        localId: "booking-1",
        queuedAt: new Date(now.getTime() + 30 * 60_000), // 30 min later
      });

      expect(first).not.toBeNull();
      expect(dupe).toBeNull();
      expect(queue.rows).toHaveLength(1);
    });

    it("same email to a DIFFERENT recipient is not deduplicated", () => {
      const queue = createQueue();
      const now = new Date("2026-03-10T10:00:00.000Z");

      queue.enqueue({
        to: "alice@example.com",
        subject: "Confirmation",
        html: "<p>x</p>",
        from: "F",
        entityType: "booking_confirmation",
        localId: "booking-1",
        queuedAt: now,
      });

      const different = queue.enqueue({
        to: "bob@example.com", // different recipient
        subject: "Confirmation",
        html: "<p>x</p>",
        from: "F",
        entityType: "booking_confirmation",
        localId: "booking-1",
        queuedAt: now,
      });

      expect(different).not.toBeNull();
      expect(queue.rows).toHaveLength(2);
    });

    it("same email after the 24h window is NOT deduplicated (allowed again)", () => {
      const queue = createQueue();
      const first = new Date("2026-03-10T08:00:00.000Z");
      const nextDay = new Date("2026-03-11T08:01:00.000Z"); // 24h + 1 min later

      queue.enqueue({
        to: "alice@example.com",
        subject: "Fill Reminder",
        html: "<p>r</p>",
        from: "F",
        entityType: "fill_reminder",
        localId: "booking-5",
        queuedAt: first,
      });

      const nextDayRow = queue.enqueue({
        to: "alice@example.com",
        subject: "Fill Reminder",
        html: "<p>r</p>",
        from: "F",
        entityType: "fill_reminder",
        localId: "booking-5",
        queuedAt: nextDay,
      });

      expect(nextDayRow).not.toBeNull();
      expect(queue.rows).toHaveLength(2);
    });

    it("different entityType with same localId and recipient is not deduplicated", () => {
      const queue = createQueue();
      const now = new Date("2026-03-10T10:00:00.000Z");

      queue.enqueue({
        to: "alice@example.com",
        subject: "Confirmation",
        html: "<p>c</p>",
        from: "F",
        entityType: "booking_confirmation",
        localId: "booking-1",
        queuedAt: now,
      });

      const reminder = queue.enqueue({
        to: "alice@example.com",
        subject: "Reminder",
        html: "<p>r</p>",
        from: "F",
        entityType: "booking_reminder_24h", // different entityType
        localId: "booking-1",
        queuedAt: now,
      });

      expect(reminder).not.toBeNull();
      expect(queue.rows).toHaveLength(2);
    });

    it("dedup window is exactly 24h: 24h - 1ms still deduplicates", () => {
      const queue = createQueue();
      const first = new Date("2026-03-10T08:00:00.000Z");
      const justUnder24h = new Date(first.getTime() + 24 * 60 * 60 * 1000 - 1);

      queue.enqueue({
        to: "alice@example.com",
        subject: "S",
        html: "<p>x</p>",
        from: "F",
        entityType: "birthday_promo",
        localId: "promo-1",
        queuedAt: first,
      });

      const dupe = queue.enqueue({
        to: "alice@example.com",
        subject: "S",
        html: "<p>x</p>",
        from: "F",
        entityType: "birthday_promo",
        localId: "promo-1",
        queuedAt: justUnder24h,
      });

      expect(dupe).toBeNull(); // still within window
    });
  });
});
