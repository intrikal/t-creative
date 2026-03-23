// @vitest-environment node

/**
 * tests/edge/gift-card-double-spend.test.ts
 *
 * Edge-case tests for gift card double-spend prevention.
 *
 * The production redemption code uses a PostgreSQL FOR UPDATE pessimistic lock
 * inside a transaction to prevent two simultaneous redemptions from both
 * reading a sufficient balance and both succeeding — the classic TOCTOU
 * (time-of-check / time-of-use) race condition.
 *
 * Because these are unit-level tests against pure helpers (not integration
 * tests against a real DB), the concurrency is simulated with an in-memory
 * mutex that serialises concurrent transactions — the same guarantee that
 * SELECT … FOR UPDATE provides.  The tests document the CONTRACT that the
 * production lock must enforce.
 *
 * Covered scenarios
 *   1. $50 balance, two simultaneous $30 redemptions: exactly one succeeds,
 *      one fails with "Insufficient gift card balance"; final balance = $20.
 *   2. $50 balance, $50 + $1 simultaneous redemptions: one succeeds (balance
 *      → $0, status → "redeemed"), one fails; balance never goes negative.
 *   3. $0 balance: immediate rejection before reaching the deduction step;
 *      the deduct function is never called.
 *   4. CHECK constraint: a raw balance update that would produce a negative
 *      value is rejected by the constraint guard, balance stays at 0.
 */

import { describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/*  In-memory gift card store + serialising lock                        */
/* ------------------------------------------------------------------ */

type GiftCardStatus = "active" | "redeemed" | "expired";

interface GiftCard {
  id: number;
  balanceInCents: number;
  status: GiftCardStatus;
}

/**
 * A simple async mutex — only one holder at a time.
 * Models the serialisation guarantee of SELECT … FOR UPDATE.
 */
class Mutex {
  private _queue: Array<() => void> = [];
  private _locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (!this._locked) {
          this._locked = true;
          resolve(() => {
            this._locked = false;
            const next = this._queue.shift();
            if (next) next();
          });
        } else {
          this._queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
}

/**
 * In-memory gift card store with a per-card mutex that serialises
 * concurrent transactions — mirroring the FOR UPDATE row lock.
 */
function createCardStore(initial: GiftCard[]) {
  const cards = new Map<number, GiftCard>(initial.map((c) => [c.id, { ...c }]));
  const locks = new Map<number, Mutex>(initial.map((c) => [c.id, new Mutex()]));

  /**
   * Runs `fn` inside a serialised transaction for `cardId`.
   * Mirrors: BEGIN; SELECT … FOR UPDATE; …; COMMIT/ROLLBACK.
   */
  async function withLock<T>(cardId: number, fn: (card: GiftCard) => T): Promise<T> {
    const mutex = locks.get(cardId);
    if (!mutex) throw new Error("Gift card not found");
    const release = await mutex.acquire();
    try {
      const card = cards.get(cardId);
      if (!card) throw new Error("Gift card not found");
      return fn(card);
    } finally {
      release();
    }
  }

  return { cards, withLock };
}

/* ------------------------------------------------------------------ */
/*  Pure redemption helper — the logic the production code implements   */
/* ------------------------------------------------------------------ */

/**
 * Attempts to redeem `amountInCents` from gift card `cardId`.
 *
 * Runs inside `store.withLock()` so concurrent calls are serialised.
 * Returns the new balance on success; throws on validation failure.
 *
 * Production equivalent: the body of the db.transaction callback in
 * promo-gift-actions.ts → redeemGiftCard / recordRedemption.
 */
async function redeemFromStore(
  store: ReturnType<typeof createCardStore>,
  cardId: number,
  amountInCents: number,
  /** Optional spy to verify whether the deduction step is reached. */
  onDeduct?: () => void,
): Promise<number> {
  return store.withLock(cardId, (card) => {
    if (card.status !== "active") throw new Error("Gift card is not active");
    if (card.balanceInCents < amountInCents) throw new Error("Insufficient gift card balance");

    onDeduct?.();

    const newBalance = card.balanceInCents - amountInCents;
    card.balanceInCents = newBalance;
    if (newBalance === 0) card.status = "redeemed";
    return newBalance;
  });
}

/**
 * Applies a raw balance SET without the balance-check guard.
 * Used to test the CHECK-constraint analogue.
 *
 * A real CHECK CONSTRAINT `balance_in_cents >= 0` in PostgreSQL rejects
 * the UPDATE at the DB level — this helper models the same rejection.
 */
function rawSetBalance(
  store: ReturnType<typeof createCardStore>,
  cardId: number,
  newBalance: number,
): void {
  const card = store.cards.get(cardId);
  if (!card) throw new Error("Gift card not found");
  // CHECK constraint equivalent: balance_in_cents >= 0
  if (newBalance < 0)
    throw new Error('new row violates check constraint "gift_cards_balance_check"');
  card.balanceInCents = newBalance;
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Gift card double-spend prevention", () => {
  // ─── 1. Two simultaneous $30 redemptions on a $50 balance ─────────

  describe("1. $50 balance, two concurrent $30 redemptions — exactly one succeeds", () => {
    it("exactly one of the two redemptions succeeds", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      const results = await Promise.allSettled([
        redeemFromStore(store, 1, 3000),
        redeemFromStore(store, 1, 3000),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });

    it("the failing redemption throws 'Insufficient gift card balance'", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      const results = await Promise.allSettled([
        redeemFromStore(store, 1, 3000),
        redeemFromStore(store, 1, 3000),
      ]);

      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason.message).toBe("Insufficient gift card balance");
    });

    it("final balance is exactly $20 (5000 - 3000 = 2000 cents), never negative", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      await Promise.allSettled([redeemFromStore(store, 1, 3000), redeemFromStore(store, 1, 3000)]);

      expect(store.cards.get(1)!.balanceInCents).toBe(2000);
      expect(store.cards.get(1)!.balanceInCents).toBeGreaterThanOrEqual(0);
    });

    it("card status remains 'active' after one of two $30 redemptions (balance still > 0)", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      await Promise.allSettled([redeemFromStore(store, 1, 3000), redeemFromStore(store, 1, 3000)]);

      expect(store.cards.get(1)!.status).toBe("active");
    });

    it("without the lock, concurrent async readers both see sufficient balance before either writes (documents the TOCTOU race)", async () => {
      // Simulate the race: both coroutines read the balance before either commits.
      // In a real DB without FOR UPDATE, two transactions can both pass the balance
      // check and both execute the deduction — producing a negative balance.
      const card = { balanceInCents: 5000, status: "active" as GiftCardStatus };
      let successCount = 0;

      // A "racy" redeem that yields between check and write (no lock).
      // Both callers read before either writes — classic TOCTOU.
      const racyReadPhase: number[] = [];
      const racyRedeem = async (amount: number) => {
        const balanceAtRead = card.balanceInCents; // both read 5000
        racyReadPhase.push(balanceAtRead);
        await Promise.resolve(); // yield — let the other caller read too
        if (balanceAtRead >= amount) {
          successCount++;
          card.balanceInCents -= amount; // both write, going negative
        }
      };

      await Promise.all([racyRedeem(3000), racyRedeem(3000)]);

      // Both read 5000, both passed the check, both wrote — THIS IS THE BUG
      expect(racyReadPhase).toEqual([5000, 5000]); // both saw sufficient balance
      expect(successCount).toBe(2); // both "succeeded"
      expect(card.balanceInCents).toBe(-1000); // negative balance!

      // With the lock (the correct implementation), only one succeeds
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);
      const lockedResults = await Promise.allSettled([
        redeemFromStore(store, 1, 3000),
        redeemFromStore(store, 1, 3000),
      ]);
      const lockedSucceeded = lockedResults.filter((r) => r.status === "fulfilled");
      expect(lockedSucceeded).toHaveLength(1);
      expect(store.cards.get(1)!.balanceInCents).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── 2. $50 + $1 simultaneous on $50 balance ──────────────────────

  describe("2. $50 balance, $50 + $1 concurrent redemptions — one succeeds, balance never negative", () => {
    it("exactly one redemption succeeds", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      const results = await Promise.allSettled([
        redeemFromStore(store, 1, 5000), // full redemption
        redeemFromStore(store, 1, 100), // $1 redemption
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded).toHaveLength(1);
    });

    it("final balance is 0 if the $50 redemption wins, or 4900 if the $1 wins — never negative", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      await Promise.allSettled([redeemFromStore(store, 1, 5000), redeemFromStore(store, 1, 100)]);

      const balance = store.cards.get(1)!.balanceInCents;
      // Either $50 won (balance=0) or $1 won (balance=4900); never negative
      expect([0, 4900]).toContain(balance);
      expect(balance).toBeGreaterThanOrEqual(0);
    });

    it("card is marked 'redeemed' only if the full $50 redemption wins", async () => {
      // Run until the $50 redemption wins first (deterministic because the lock
      // serialises and Promise.allSettled resolves the first promise first).
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      await Promise.allSettled([redeemFromStore(store, 1, 5000), redeemFromStore(store, 1, 100)]);

      const card = store.cards.get(1)!;
      if (card.balanceInCents === 0) {
        expect(card.status).toBe("redeemed");
      } else {
        expect(card.status).toBe("active");
      }
    });

    it("the losing redemption throws either 'Insufficient gift card balance' or 'Gift card is not active'", async () => {
      // If the $50 redemption wins first, the card is marked "redeemed" and the
      // $1 attempt sees a non-active status.  If the $1 wins first, the $50
      // attempt sees an insufficient balance.  Both are valid rejections.
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      const results = await Promise.allSettled([
        redeemFromStore(store, 1, 5000),
        redeemFromStore(store, 1, 100),
      ]);

      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(["Insufficient gift card balance", "Gift card is not active"]).toContain(
        rejected.reason.message,
      );
    });

    it("three concurrent redemptions on a $50 balance: exactly one succeeds regardless of amounts", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      const results = await Promise.allSettled([
        redeemFromStore(store, 1, 5000),
        redeemFromStore(store, 1, 4000),
        redeemFromStore(store, 1, 3000),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded).toHaveLength(1);
      expect(store.cards.get(1)!.balanceInCents).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── 3. $0 balance: immediate rejection, deduct never called ──────

  describe("3. $0 balance — immediate rejection, deduction step never reached", () => {
    it("redemption on a $0 balance throws 'Insufficient gift card balance'", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 0, status: "active" }]);

      await expect(redeemFromStore(store, 1, 1)).rejects.toThrow("Insufficient gift card balance");
    });

    it("the deduct callback is never invoked when balance is $0", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 0, status: "active" }]);
      const onDeduct = vi.fn();

      await expect(redeemFromStore(store, 1, 1, onDeduct)).rejects.toThrow(
        "Insufficient gift card balance",
      );

      expect(onDeduct).not.toHaveBeenCalled();
    });

    it("the deduct callback IS invoked when balance is sufficient", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);
      const onDeduct = vi.fn();

      await redeemFromStore(store, 1, 1000, onDeduct);

      expect(onDeduct).toHaveBeenCalledTimes(1);
    });

    it("multiple concurrent redemptions on a $0 balance all fail immediately", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 0, status: "active" }]);
      const onDeduct = vi.fn();

      const results = await Promise.allSettled([
        redeemFromStore(store, 1, 100, onDeduct),
        redeemFromStore(store, 1, 200, onDeduct),
        redeemFromStore(store, 1, 50, onDeduct),
      ]);

      expect(results.every((r) => r.status === "rejected")).toBe(true);
      expect(onDeduct).not.toHaveBeenCalled();
      expect(store.cards.get(1)!.balanceInCents).toBe(0);
    });

    it("a card with status 'redeemed' also rejects even if balance were somehow > 0", async () => {
      // Defensive: status check runs before balance check
      const store = createCardStore([{ id: 1, balanceInCents: 1000, status: "redeemed" }]);

      await expect(redeemFromStore(store, 1, 100)).rejects.toThrow("Gift card is not active");
    });

    it("a card with status 'expired' rejects with 'Gift card is not active'", async () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "expired" }]);

      await expect(redeemFromStore(store, 1, 100)).rejects.toThrow("Gift card is not active");
    });
  });

  // ─── 4. CHECK constraint: negative balance rejected ───────────────

  describe("4. CHECK constraint — raw UPDATE to negative balance is rejected", () => {
    it("rawSetBalance to -100 throws a constraint violation error", () => {
      const store = createCardStore([{ id: 1, balanceInCents: 0, status: "active" }]);

      expect(() => rawSetBalance(store, 1, -100)).toThrow(
        'new row violates check constraint "gift_cards_balance_check"',
      );
    });

    it("balance remains at 0 after a rejected negative SET", () => {
      const store = createCardStore([{ id: 1, balanceInCents: 0, status: "active" }]);

      try {
        rawSetBalance(store, 1, -100);
      } catch {
        // expected
      }

      expect(store.cards.get(1)!.balanceInCents).toBe(0);
    });

    it("rawSetBalance to 0 is valid (full redemption brings balance to exactly 0)", () => {
      const store = createCardStore([{ id: 1, balanceInCents: 5000, status: "active" }]);

      expect(() => rawSetBalance(store, 1, 0)).not.toThrow();
      expect(store.cards.get(1)!.balanceInCents).toBe(0);
    });

    it("rawSetBalance to any negative value always throws, regardless of the current balance", () => {
      for (const currentBalance of [0, 100, 5000]) {
        const store = createCardStore([
          { id: 1, balanceInCents: currentBalance, status: "active" },
        ]);
        expect(() => rawSetBalance(store, 1, -1)).toThrow(/check constraint/);
      }
    });

    it("the CHECK constraint is the last line of defence: the application guard fires first", async () => {
      // The application-level balance check (redeemFromStore) catches the error
      // before the DB constraint is needed.  Both are necessary: the app check
      // gives a friendly error; the constraint prevents corruption from bugs or
      // direct SQL edits.
      const store = createCardStore([{ id: 1, balanceInCents: 500, status: "active" }]);

      // Application guard fires with a user-friendly message
      await expect(redeemFromStore(store, 1, 600)).rejects.toThrow(
        "Insufficient gift card balance",
      );

      // If someone bypasses the application guard, the constraint still fires
      expect(() => rawSetBalance(store, 1, -100)).toThrow(/check constraint/);
    });
  });
});
