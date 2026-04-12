// @vitest-environment node

/**
 * tests/edge/referral-self-referral.test.ts
 *
 * Edge-case tests for referral self-referral prevention.
 *
 * The referral system allows clients to share a unique code. When a new
 * client enters that code, both parties receive a reward. However, a client
 * must not be able to refer themselves — this is the primary fraud vector.
 *
 * The production code validates referral codes in a specific order:
 *   1. Does the code exist?
 *   2. Is the code still active (not expired/deactivated)?
 *   3. Is the code owner different from the submitting client?
 *   4. Create the referral relationship
 *
 * Covered scenarios
 *   1. Client enters their own referral code → rejected
 *   2. Client enters valid other-user code → accepted
 *   3. Client enters non-existent code → rejected with "invalid code"
 *   4. Client enters expired/deactivated code → rejected
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Types                                                                */
/* ------------------------------------------------------------------ */

type ReferralCodeStatus = "active" | "expired" | "deactivated";

interface ReferralCode {
  code: string;
  ownerId: string;
  status: ReferralCodeStatus;
}

interface Referral {
  referrerId: string;
  referredId: string;
  code: string;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers — the logic production code should implement           */
/* ------------------------------------------------------------------ */

/**
 * In-memory referral code store for testing.
 */
function createReferralStore(codes: ReferralCode[]) {
  const codeMap = new Map<string, ReferralCode>(codes.map((c) => [c.code, c]));
  const referrals: Referral[] = [];

  /**
   * Validates and applies a referral code.
   *
   * Production logic (referral-actions.ts → applyReferralCode):
   *   1. Look up the code
   *   2. Check the code is active
   *   3. Check the submitter is not the code owner (self-referral)
   *   4. Create the referral
   *
   * Returns the created referral on success; throws on validation failure.
   */
  function applyReferralCode(code: string, submitterId: string): Referral {
    // Step 1: Does the code exist?
    const referralCode = codeMap.get(code);
    if (!referralCode) {
      throw new Error("Invalid referral code");
    }

    // Step 2: Is the code active?
    if (referralCode.status !== "active") {
      throw new Error(
        referralCode.status === "expired"
          ? "Referral code has expired"
          : "Referral code has been deactivated",
      );
    }

    // Step 3: Self-referral check
    if (referralCode.ownerId === submitterId) {
      throw new Error("You cannot use your own referral code");
    }

    // Step 4: Create the referral
    const referral: Referral = {
      referrerId: referralCode.ownerId,
      referredId: submitterId,
      code,
    };
    referrals.push(referral);
    return referral;
  }

  return { referrals, applyReferralCode };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Referral self-referral prevention", () => {
  const CODES: ReferralCode[] = [
    { code: "ALICE-REF", ownerId: "user-alice", status: "active" },
    { code: "BOB-REF", ownerId: "user-bob", status: "active" },
    { code: "EXPIRED-REF", ownerId: "user-charlie", status: "expired" },
    { code: "DEACTIVATED-REF", ownerId: "user-dave", status: "deactivated" },
  ];

  // ─── 1. Self-referral → rejected ────────────────────────────────

  describe("1. Client enters their own referral code → rejected", () => {
    it("Alice entering ALICE-REF is rejected with self-referral error", () => {
      const store = createReferralStore(CODES);

      expect(() => store.applyReferralCode("ALICE-REF", "user-alice")).toThrow(
        "You cannot use your own referral code",
      );
    });

    it("no referral is created when self-referral is attempted", () => {
      const store = createReferralStore(CODES);

      try {
        store.applyReferralCode("ALICE-REF", "user-alice");
      } catch {
        // expected
      }

      expect(store.referrals).toHaveLength(0);
    });

    it("self-referral check runs after existence and status checks", () => {
      const store = createReferralStore(CODES);

      // A non-existent code throws "Invalid referral code" — not self-referral
      expect(() => store.applyReferralCode("NONEXISTENT", "user-alice")).toThrow(
        "Invalid referral code",
      );

      // An expired code owned by the submitter throws expiry — not self-referral
      // (status check runs before self-referral check)
      const codesWithExpiredSelf: ReferralCode[] = [
        { code: "MY-EXPIRED", ownerId: "user-alice", status: "expired" },
      ];
      const store2 = createReferralStore(codesWithExpiredSelf);
      expect(() => store2.applyReferralCode("MY-EXPIRED", "user-alice")).toThrow(
        "Referral code has expired",
      );
    });
  });

  // ─── 2. Valid other-user code → accepted ────────────────────────

  describe("2. Client enters valid other-user code → accepted", () => {
    it("Bob entering ALICE-REF creates a referral", () => {
      const store = createReferralStore(CODES);

      const referral = store.applyReferralCode("ALICE-REF", "user-bob");

      expect(referral.referrerId).toBe("user-alice");
      expect(referral.referredId).toBe("user-bob");
      expect(referral.code).toBe("ALICE-REF");
    });

    it("referral is persisted in the store", () => {
      const store = createReferralStore(CODES);

      store.applyReferralCode("ALICE-REF", "user-bob");

      expect(store.referrals).toHaveLength(1);
      expect(store.referrals[0].referrerId).toBe("user-alice");
    });

    it("a new user can use a valid code", () => {
      const store = createReferralStore(CODES);

      const referral = store.applyReferralCode("BOB-REF", "user-newclient");

      expect(referral.referrerId).toBe("user-bob");
      expect(referral.referredId).toBe("user-newclient");
    });
  });

  // ─── 3. Non-existent code → rejected ───────────────────────────

  describe("3. Client enters non-existent code → rejected with 'invalid code'", () => {
    it("a code that doesn't exist throws 'Invalid referral code'", () => {
      const store = createReferralStore(CODES);

      expect(() => store.applyReferralCode("FAKE-CODE-123", "user-bob")).toThrow(
        "Invalid referral code",
      );
    });

    it("no referral is created for a non-existent code", () => {
      const store = createReferralStore(CODES);

      try {
        store.applyReferralCode("FAKE-CODE-123", "user-bob");
      } catch {
        // expected
      }

      expect(store.referrals).toHaveLength(0);
    });

    it("empty string code is also rejected", () => {
      const store = createReferralStore(CODES);

      expect(() => store.applyReferralCode("", "user-bob")).toThrow(
        "Invalid referral code",
      );
    });

    it("case-sensitive: 'alice-ref' does not match 'ALICE-REF'", () => {
      const store = createReferralStore(CODES);

      expect(() => store.applyReferralCode("alice-ref", "user-bob")).toThrow(
        "Invalid referral code",
      );
    });
  });

  // ─── 4. Expired/deactivated code → rejected ────────────────────

  describe("4. Client enters expired or deactivated code → rejected", () => {
    it("expired code throws 'Referral code has expired'", () => {
      const store = createReferralStore(CODES);

      expect(() => store.applyReferralCode("EXPIRED-REF", "user-bob")).toThrow(
        "Referral code has expired",
      );
    });

    it("deactivated code throws 'Referral code has been deactivated'", () => {
      const store = createReferralStore(CODES);

      expect(() => store.applyReferralCode("DEACTIVATED-REF", "user-bob")).toThrow(
        "Referral code has been deactivated",
      );
    });

    it("no referral is created for expired or deactivated codes", () => {
      const store = createReferralStore(CODES);

      try {
        store.applyReferralCode("EXPIRED-REF", "user-bob");
      } catch {
        // expected
      }
      try {
        store.applyReferralCode("DEACTIVATED-REF", "user-bob");
      } catch {
        // expected
      }

      expect(store.referrals).toHaveLength(0);
    });

    it("a previously active code that becomes expired is rejected on use", () => {
      const mutableCodes: ReferralCode[] = [
        { code: "TEMP-REF", ownerId: "user-temp", status: "active" },
      ];
      const store = createReferralStore(mutableCodes);

      // Code is active — first use succeeds
      const referral = store.applyReferralCode("TEMP-REF", "user-new1");
      expect(referral.referrerId).toBe("user-temp");

      // Simulate expiration by modifying the status
      mutableCodes[0].status = "expired";
      const store2 = createReferralStore(mutableCodes);
      expect(() => store2.applyReferralCode("TEMP-REF", "user-new2")).toThrow(
        "Referral code has expired",
      );
    });
  });
});
