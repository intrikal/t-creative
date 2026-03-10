/**
 * scripts/backfill-referral-codes.ts
 *
 * One-time script to generate referral codes for clients who signed up before
 * referral codes were added to the onboarding flow.
 *
 * Run with:
 *   npx tsx scripts/backfill-referral-codes.ts
 *
 * Safe to re-run — skips any profile that already has a referralCode.
 */
import { isNull, eq, and, ne } from "drizzle-orm";
import { db } from "../db";
import { profiles } from "../db/schema";

async function main() {
  const rows = await db
    .select({ id: profiles.id, firstName: profiles.firstName })
    .from(profiles)
    .where(
      and(
        isNull(profiles.referralCode),
        eq(profiles.role, "client"),
        // Only backfill clients who completed onboarding (have a firstName)
        ne(profiles.firstName, ""),
      ),
    );

  if (rows.length === 0) {
    console.log("No profiles need backfilling.");
    return;
  }

  console.log(`Backfilling ${rows.length} profiles...`);

  let success = 0;
  let skipped = 0;

  for (const row of rows) {
    const code = `${row.firstName.slice(0, 5).toUpperCase()}-${row.id.replace(/-/g, "").slice(-6).toUpperCase()}`;

    try {
      await db.update(profiles).set({ referralCode: code }).where(eq(profiles.id, row.id));
      console.log(`  ✓ ${row.firstName} (${row.id.slice(0, 8)}) → ${code}`);
      success++;
    } catch (err) {
      // Unique constraint violation means the code already exists — generate a
      // slightly different one by using more of the UUID.
      const altCode = `${row.firstName.slice(0, 4).toUpperCase()}-${row.id.replace(/-/g, "").slice(-8, -2).toUpperCase()}`;
      try {
        await db.update(profiles).set({ referralCode: altCode }).where(eq(profiles.id, row.id));
        console.log(`  ✓ ${row.firstName} (${row.id.slice(0, 8)}) → ${altCode} (alt)`);
        success++;
      } catch {
        console.error(`  ✗ ${row.firstName} (${row.id.slice(0, 8)}) — skipped:`, err);
        skipped++;
      }
    }
  }

  console.log(`\nDone. ${success} updated, ${skipped} skipped.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
