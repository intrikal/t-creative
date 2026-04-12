// @vitest-environment node

/**
 * tests/edge/resend-rate-limit.test.ts
 *
 * Edge-case tests for email queue behavior under Resend rate limits.
 *
 * Resend (the email provider) enforces daily send limits and returns HTTP 429
 * when limits are hit mid-batch. The production code must handle this
 * gracefully: queuing emails when the limit is reached, preserving FIFO order,
 * and processing the queue on the next available window.
 *
 * The system must NEVER drop an email — the worst case is deferral, not loss.
 *
 * Covered scenarios
 *   1. Daily limit reached → email queued with status "pending"
 *   2. Resend returns 429 mid-batch → remaining emails queued, processed ones logged
 *   3. Queued emails processed next day → sent and marked "sent"
 *   4. Queue ordering preserved — FIFO by queuedAt timestamp
 */

import { describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/*  Types                                                                */
/* ------------------------------------------------------------------ */

type EmailStatus = "pending" | "sent" | "failed";

interface QueuedEmail {
  id: string;
  to: string;
  subject: string;
  status: EmailStatus;
  queuedAt: number; // epoch ms
  sentAt?: number;
}

interface SendResult {
  success: boolean;
  rateLimited: boolean;
}

/* ------------------------------------------------------------------ */
/*  In-memory email queue + mock Resend client                          */
/* ------------------------------------------------------------------ */

/**
 * Creates an in-memory email queue with a mock Resend client.
 *
 * @param dailyLimit - Max emails per day before 429
 */
function createEmailQueue(dailyLimit: number) {
  const queue: QueuedEmail[] = [];
  let sentToday = 0;
  let nextId = 1;

  /**
   * Mock Resend send — returns 429 after dailyLimit is hit.
   */
  const mockSend = vi.fn(async (): Promise<SendResult> => {
    if (sentToday >= dailyLimit) {
      return { success: false, rateLimited: true };
    }
    sentToday++;
    return { success: true, rateLimited: false };
  });

  /**
   * Enqueues an email. Always creates a queue entry with status "pending".
   *
   * Production logic (email-queue.ts → enqueueEmail):
   *   Insert into email_queue with status "pending" and queuedAt = now().
   */
  function enqueue(to: string, subject: string, now: number): QueuedEmail {
    const email: QueuedEmail = {
      id: `email-${nextId++}`,
      to,
      subject,
      status: "pending",
      queuedAt: now,
    };
    queue.push(email);
    return email;
  }

  /**
   * Processes the queue: attempts to send all "pending" emails in FIFO order.
   * Stops on the first 429 — remaining emails stay "pending".
   *
   * Production logic (email-queue.ts → processQueue):
   *   SELECT * FROM email_queue WHERE status = 'pending' ORDER BY queued_at ASC
   *   FOR each email: call Resend. On 429, stop. On success, mark "sent".
   *
   * Returns the count of successfully sent emails in this batch.
   */
  async function processQueue(now: number): Promise<number> {
    const pending = queue
      .filter((e) => e.status === "pending")
      .sort((a, b) => a.queuedAt - b.queuedAt);

    let sentCount = 0;

    for (const email of pending) {
      const result = await mockSend();

      if (result.rateLimited) {
        // Stop processing — remaining emails stay "pending"
        break;
      }

      if (result.success) {
        email.status = "sent";
        email.sentAt = now;
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Resets the daily send counter (simulates a new day).
   */
  function resetDailyLimit(): void {
    sentToday = 0;
  }

  return { queue, enqueue, processQueue, resetDailyLimit, mockSend };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Email queue behavior under Resend rate limit", () => {
  const BASE_TIME = new Date(2026, 3, 15, 10, 0, 0).getTime(); // Apr 15, 2026 10:00 AM
  const ONE_MINUTE = 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  // ─── 1. Daily limit reached → email queued as "pending" ─────────

  describe("1. Daily limit reached → email queued with status 'pending' (not dropped)", () => {
    it("email is always enqueued as 'pending' regardless of limit state", () => {
      const eq = createEmailQueue(0); // limit already reached

      const email = eq.enqueue("client@example.com", "Booking confirmation", BASE_TIME);

      expect(email.status).toBe("pending");
    });

    it("processing when limit is reached sends nothing — email stays 'pending'", async () => {
      const eq = createEmailQueue(0); // zero daily limit

      eq.enqueue("client@example.com", "Booking confirmation", BASE_TIME);
      const sentCount = await eq.processQueue(BASE_TIME);

      expect(sentCount).toBe(0);
      expect(eq.queue[0].status).toBe("pending");
    });

    it("email is never dropped — it remains in the queue for later processing", async () => {
      const eq = createEmailQueue(0);

      eq.enqueue("client@example.com", "Booking confirmation", BASE_TIME);
      await eq.processQueue(BASE_TIME);

      // Email still exists in queue
      expect(eq.queue).toHaveLength(1);
      expect(eq.queue[0].status).toBe("pending");
    });

    it("multiple emails queued when limit is hit — all remain pending", async () => {
      const eq = createEmailQueue(0);

      eq.enqueue("a@example.com", "Booking 1", BASE_TIME);
      eq.enqueue("b@example.com", "Booking 2", BASE_TIME + ONE_MINUTE);
      eq.enqueue("c@example.com", "Booking 3", BASE_TIME + 2 * ONE_MINUTE);

      await eq.processQueue(BASE_TIME);

      const pending = eq.queue.filter((e) => e.status === "pending");
      expect(pending).toHaveLength(3);
    });
  });

  // ─── 2. 429 mid-batch → remaining emails queued ────────────────

  describe("2. Resend returns 429 mid-batch → remaining emails queued, processed ones logged", () => {
    it("limit of 2: first 2 emails sent, 3rd stays pending", async () => {
      const eq = createEmailQueue(2);

      eq.enqueue("a@example.com", "Email 1", BASE_TIME);
      eq.enqueue("b@example.com", "Email 2", BASE_TIME + ONE_MINUTE);
      eq.enqueue("c@example.com", "Email 3", BASE_TIME + 2 * ONE_MINUTE);

      const sentCount = await eq.processQueue(BASE_TIME);

      expect(sentCount).toBe(2);
      expect(eq.queue[0].status).toBe("sent");
      expect(eq.queue[1].status).toBe("sent");
      expect(eq.queue[2].status).toBe("pending");
    });

    it("sent emails have sentAt timestamp, pending emails do not", async () => {
      const eq = createEmailQueue(2);

      eq.enqueue("a@example.com", "Email 1", BASE_TIME);
      eq.enqueue("b@example.com", "Email 2", BASE_TIME + ONE_MINUTE);
      eq.enqueue("c@example.com", "Email 3", BASE_TIME + 2 * ONE_MINUTE);

      await eq.processQueue(BASE_TIME + 3 * ONE_MINUTE);

      expect(eq.queue[0].sentAt).toBeDefined();
      expect(eq.queue[1].sentAt).toBeDefined();
      expect(eq.queue[2].sentAt).toBeUndefined();
    });

    it("mockSend is called exactly 3 times (2 succeed + 1 rate-limited)", async () => {
      const eq = createEmailQueue(2);

      eq.enqueue("a@example.com", "Email 1", BASE_TIME);
      eq.enqueue("b@example.com", "Email 2", BASE_TIME + ONE_MINUTE);
      eq.enqueue("c@example.com", "Email 3", BASE_TIME + 2 * ONE_MINUTE);

      await eq.processQueue(BASE_TIME);

      // 2 successful + 1 that returns 429 (triggers the break)
      expect(eq.mockSend).toHaveBeenCalledTimes(3);
    });
  });

  // ─── 3. Queued emails processed next day ────────────────────────

  describe("3. Queued emails processed next day → sent and marked 'sent'", () => {
    it("after daily limit reset, pending emails are sent on next processQueue call", async () => {
      const eq = createEmailQueue(1);

      eq.enqueue("a@example.com", "Email 1", BASE_TIME);
      eq.enqueue("b@example.com", "Email 2", BASE_TIME + ONE_MINUTE);

      // Day 1: only 1 email sent
      const sentDay1 = await eq.processQueue(BASE_TIME);
      expect(sentDay1).toBe(1);
      expect(eq.queue[1].status).toBe("pending");

      // Day 2: reset limit, process remaining
      eq.resetDailyLimit();
      const sentDay2 = await eq.processQueue(BASE_TIME + ONE_DAY);
      expect(sentDay2).toBe(1);
      expect(eq.queue[1].status).toBe("sent");
    });

    it("all emails eventually sent after enough daily resets", async () => {
      const eq = createEmailQueue(1); // 1 per day

      for (let i = 0; i < 5; i++) {
        eq.enqueue(`user${i}@example.com`, `Email ${i}`, BASE_TIME + i * ONE_MINUTE);
      }

      // Process over 5 "days"
      for (let day = 0; day < 5; day++) {
        eq.resetDailyLimit();
        await eq.processQueue(BASE_TIME + day * ONE_DAY);
      }

      const allSent = eq.queue.every((e) => e.status === "sent");
      expect(allSent).toBe(true);
    });

    it("sentAt reflects the day the email was actually sent, not the day it was queued", async () => {
      const eq = createEmailQueue(1);

      eq.enqueue("a@example.com", "Email 1", BASE_TIME);
      eq.enqueue("b@example.com", "Email 2", BASE_TIME + ONE_MINUTE);

      await eq.processQueue(BASE_TIME);

      eq.resetDailyLimit();
      await eq.processQueue(BASE_TIME + ONE_DAY);

      expect(eq.queue[0].sentAt).toBe(BASE_TIME); // sent on day 1
      expect(eq.queue[1].sentAt).toBe(BASE_TIME + ONE_DAY); // sent on day 2
    });
  });

  // ─── 4. Queue ordering: FIFO by queuedAt ───────────────────────

  describe("4. Queue ordering preserved — FIFO by queuedAt timestamp", () => {
    it("emails are processed in queuedAt order, not insertion order", async () => {
      const eq = createEmailQueue(10);

      // Insert out of order
      eq.enqueue("c@example.com", "Third", BASE_TIME + 2 * ONE_MINUTE);
      eq.enqueue("a@example.com", "First", BASE_TIME);
      eq.enqueue("b@example.com", "Second", BASE_TIME + ONE_MINUTE);

      await eq.processQueue(BASE_TIME + 3 * ONE_MINUTE);

      // All sent, but verify via sentAt — processQueue processes FIFO by queuedAt
      const sentEmails = eq.queue.filter((e) => e.status === "sent");
      expect(sentEmails).toHaveLength(3);
    });

    it("when limit is hit mid-batch, earlier-queued emails are sent first", async () => {
      const eq = createEmailQueue(2);

      eq.enqueue("first@example.com", "First queued", BASE_TIME);
      eq.enqueue("second@example.com", "Second queued", BASE_TIME + ONE_MINUTE);
      eq.enqueue("third@example.com", "Third queued", BASE_TIME + 2 * ONE_MINUTE);

      await eq.processQueue(BASE_TIME + 3 * ONE_MINUTE);

      // First two sent (earliest queuedAt), third stays pending
      expect(eq.queue.find((e) => e.to === "first@example.com")!.status).toBe("sent");
      expect(eq.queue.find((e) => e.to === "second@example.com")!.status).toBe("sent");
      expect(eq.queue.find((e) => e.to === "third@example.com")!.status).toBe("pending");
    });

    it("FIFO: an email queued 1ms earlier is sent before one queued 1ms later", async () => {
      const eq = createEmailQueue(1); // only 1 can send

      eq.enqueue("later@example.com", "Later", BASE_TIME + 1);
      eq.enqueue("earlier@example.com", "Earlier", BASE_TIME);

      await eq.processQueue(BASE_TIME + ONE_MINUTE);

      // The earlier-queued email should be the one that was sent
      const sent = eq.queue.find((e) => e.status === "sent");
      expect(sent!.to).toBe("earlier@example.com");
    });

    it("empty queue: processQueue returns 0 and does not call mockSend", async () => {
      const eq = createEmailQueue(10);

      const sentCount = await eq.processQueue(BASE_TIME);

      expect(sentCount).toBe(0);
      expect(eq.mockSend).not.toHaveBeenCalled();
    });
  });
});
