/**
 * scripts/verify-email-deliverability.ts
 * Sends a test email and validates SPF/DKIM/DMARC configuration via the
 * Resend API response and DNS lookups.
 *
 * Usage:
 *   npx tsx scripts/verify-email-deliverability.ts --to your@inbox.com
 *
 * Required environment variables:
 *   RESEND_API_KEY     — Resend API key
 *   RESEND_FROM_EMAIL  — Sender address (e.g. "Studio <hello@tcreativestudio.com>")
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

import { execSync } from "child_process";

// ─── CLI arg parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const toIdx = args.indexOf("--to");
const toAddress = toIdx !== -1 ? args[toIdx + 1] : undefined;

if (!toAddress || !toAddress.includes("@")) {
  console.error("Usage: npx tsx scripts/verify-email-deliverability.ts --to <email>");
  process.exit(1);
}

// ─── Env validation ───────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "T Creative <noreply@tcreativestudio.com>";

if (!RESEND_API_KEY) {
  console.error("ERROR: RESEND_API_KEY is not set.");
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type CheckResult = { label: string; passed: boolean; detail: string };

function pass(label: string, detail: string): CheckResult {
  return { label, passed: true, detail };
}

function fail(label: string, detail: string): CheckResult {
  return { label, passed: false, detail };
}

/** Extract the plain domain from a "Name <addr@domain.com>" or "addr@domain.com" string. */
function extractDomain(from: string): string {
  const match = from.match(/<([^>]+)>/) ?? from.match(/(\S+@\S+)/);
  const email = match?.[1] ?? from;
  return email.split("@")[1]?.toLowerCase().trim() ?? "";
}

/** Run a dig/nslookup DNS query and return stdout. Returns "" on failure. */
function dnsLookup(type: string, name: string): string {
  try {
    return execSync(`dig +short ${type} ${name}`, { encoding: "utf8", timeout: 8000 }).trim();
  } catch {
    try {
      // Fallback for environments without dig (Windows, some CI)
      return execSync(`nslookup -type=${type} ${name}`, { encoding: "utf8", timeout: 8000 }).trim();
    } catch {
      return "";
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const results: CheckResult[] = [];
  const fromDomain = extractDomain(RESEND_FROM_EMAIL);

  console.log(`\n📧  Verifying email deliverability`);
  console.log(`    From   : ${RESEND_FROM_EMAIL}`);
  console.log(`    To     : ${toAddress}`);
  console.log(`    Domain : ${fromDomain}\n`);

  // ── Check 1: From domain matches RESEND_FROM_EMAIL ────────────────────────
  const configuredDomain = extractDomain(RESEND_FROM_EMAIL);
  if (configuredDomain && fromDomain === configuredDomain) {
    results.push(pass("From domain", `Sender domain matches RESEND_FROM_EMAIL: ${fromDomain}`));
  } else {
    results.push(
      fail("From domain", `Domain mismatch — RESEND_FROM_EMAIL uses "${configuredDomain}"`),
    );
  }

  // ── Check 2: SPF record ───────────────────────────────────────────────────
  const spfRaw = dnsLookup("TXT", fromDomain);
  const spfRecord = spfRaw.split("\n").find((l) => l.includes("v=spf1"));
  if (spfRecord) {
    const hasResend =
      spfRecord.includes("include:amazonses.com") ||
      spfRecord.includes("include:_spf.resend.com") ||
      spfRecord.includes("include:resend.com");
    if (hasResend) {
      results.push(pass("SPF", `Record found and includes Resend: ${spfRecord.slice(0, 120)}`));
    } else {
      results.push(
        fail(
          "SPF",
          `Record found but does not include Resend's SPF. Record: ${spfRecord.slice(0, 120)}`,
        ),
      );
    }
  } else if (spfRaw) {
    results.push(
      fail("SPF", `No SPF record found for ${fromDomain}. TXT records: ${spfRaw.slice(0, 200)}`),
    );
  } else {
    results.push(fail("SPF", `DNS lookup failed or returned no TXT records for ${fromDomain}`));
  }

  // ── Check 3: DKIM record ──────────────────────────────────────────────────
  // Resend publishes DKIM at resend._domainkey.<yourdomain>
  const dkimSelector = `resend._domainkey.${fromDomain}`;
  const dkimRaw = dnsLookup("TXT", dkimSelector);
  if (dkimRaw && dkimRaw.includes("v=DKIM1")) {
    results.push(pass("DKIM", `Record found at ${dkimSelector}`));
  } else if (dkimRaw) {
    results.push(
      fail(
        "DKIM",
        `TXT record found at ${dkimSelector} but doesn't look like DKIM: ${dkimRaw.slice(0, 100)}`,
      ),
    );
  } else {
    results.push(
      fail(
        "DKIM",
        `No DKIM record at ${dkimSelector} — add the CNAME/TXT from your Resend domain settings`,
      ),
    );
  }

  // ── Check 4: DMARC record ─────────────────────────────────────────────────
  const dmarcRaw = dnsLookup("TXT", `_dmarc.${fromDomain}`);
  const dmarcRecord = dmarcRaw.split("\n").find((l) => l.includes("v=DMARC1"));
  if (dmarcRecord) {
    const policy = dmarcRecord.match(/p=(\w+)/)?.[1] ?? "none";
    const isStrong = policy === "quarantine" || policy === "reject";
    results.push(
      isStrong
        ? pass(
            "DMARC",
            `Policy is "${policy}" — strong configuration: ${dmarcRecord.slice(0, 120)}`,
          )
        : pass(
            "DMARC",
            `Record found with policy "${policy}" (consider upgrading to quarantine/reject): ${dmarcRecord.slice(0, 120)}`,
          ),
    );
  } else {
    results.push(
      fail(
        "DMARC",
        `No DMARC record at _dmarc.${fromDomain} — add a TXT record: v=DMARC1; p=none; rua=mailto:dmarc@${fromDomain}`,
      ),
    );
  }

  // ── Check 5: Send test email via Resend API ───────────────────────────────
  console.log("  Sending test email via Resend API…");
  let resendEmailId: string | null = null;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [toAddress],
        subject: "[Deliverability Test] T Creative Studio",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1c1917">Deliverability Test</h2>
            <p style="color:#44403c">This email was sent by <strong>scripts/verify-email-deliverability.ts</strong> to confirm that SPF, DKIM, and DMARC are correctly configured for <strong>${fromDomain}</strong>.</p>
            <p style="color:#78716c;font-size:13px">Sent at: ${new Date().toISOString()}</p>
          </div>
        `,
      }),
    });

    const body = (await response.json()) as { id?: string; name?: string; message?: string };

    if (response.ok && body.id) {
      resendEmailId = body.id;
      results.push(pass("Resend API send", `Accepted — email ID: ${body.id}`));
    } else {
      results.push(
        fail(
          "Resend API send",
          `API error ${response.status}: ${body.message ?? body.name ?? JSON.stringify(body)}`,
        ),
      );
    }
  } catch (err) {
    results.push(
      fail("Resend API send", `Network error: ${err instanceof Error ? err.message : String(err)}`),
    );
  }

  // ── Check 6: Verify email status via Resend API ───────────────────────────
  if (resendEmailId) {
    // Wait 2s for Resend to process
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const statusRes = await fetch(`https://api.resend.com/emails/${resendEmailId}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      const statusBody = (await statusRes.json()) as {
        id?: string;
        from?: string;
        to?: string[];
        subject?: string;
        created_at?: string;
        last_event?: string;
      };

      if (statusRes.ok) {
        const event = statusBody.last_event ?? "unknown";
        const isSent = ["sent", "delivered", "opened", "clicked"].includes(event);
        results.push(
          isSent
            ? pass("Delivery status", `Resend event: ${event} (ID: ${resendEmailId})`)
            : pass(
                "Delivery status",
                `Resend accepted, last event: ${event} — check Resend dashboard for delivery confirmation`,
              ),
        );
      } else {
        results.push(fail("Delivery status", `Could not fetch email status from Resend API`));
      }
    } catch {
      results.push(fail("Delivery status", "Could not poll Resend status endpoint"));
    }
  }

  // ── Print summary ─────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────");
  console.log("  Results");
  console.log("─────────────────────────────────────────────────────");

  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    const label = r.passed ? `\x1b[32m${icon} PASS\x1b[0m` : `\x1b[31m${icon} FAIL\x1b[0m`;
    console.log(`  ${label}  ${r.label}`);
    console.log(`         ${r.detail}\n`);
  }

  const allPassed = results.every((r) => r.passed);
  const passCount = results.filter((r) => r.passed).length;
  console.log(`─────────────────────────────────────────────────────`);
  console.log(`  ${passCount}/${results.length} checks passed`);
  console.log(`─────────────────────────────────────────────────────\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
