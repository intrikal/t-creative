/**
 * GET /api/commission-report — Export commission report as CSV or PDF.
 *
 * Query params:
 *   staffId  — profile ID of the staff member
 *   from     — start date (YYYY-MM-DD)
 *   to       — end date (YYYY-MM-DD)
 *   format   — "csv" | "pdf" (default csv)
 *
 * Auth: admin can export for any staff, staff can export own report only.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { generateCommissionReport } from "@/app/dashboard/assistants/actions";
import { generateCommissionPdf } from "@/lib/generate-commission-pdf";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";

const paramsSchema = z.object({
  staffId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(["csv", "pdf"]).default("csv"),
});

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function cents(n: number): string {
  return (n / 100).toFixed(2);
}

export async function GET(request: Request) {
  try {
    /* ── Auth ── */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile] = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* ── Parse params ── */
    const { searchParams } = new URL(request.url);
    const parsed = paramsSchema.safeParse({
      staffId: searchParams.get("staffId"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      format: searchParams.get("format") ?? "csv",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid params", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { staffId, from, to, format } = parsed.data;

    /* ── Authorization: admin for any, staff for own ── */
    const isAdmin = profile.role === "admin";
    const isOwn = user.id === staffId;
    if (!isAdmin && !isOwn) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* ── Generate report ── */
    const report = await generateCommissionReport(staffId, from, to);

    if (format === "pdf") {
      const bp = await getPublicBusinessProfile();
      const pdfBuffer = await generateCommissionPdf(
        report,
        bp.businessName,
        bp.location,
      );
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="commission-report-${from}-to-${to}.pdf"`,
        },
      });
    }

    /* ── CSV ── */
    const headers = [
      "Date",
      "Client",
      "Service",
      "Category",
      "Price",
      "Rate",
      "Commission",
      "Tip",
      "Tip Earned",
      "Total Earned",
    ];

    const rows = report.entries.map((e) => [
      csvCell(e.date),
      csvCell(e.client),
      csvCell(e.service),
      csvCell(e.serviceCategory),
      cents(e.priceInCents),
      report.commissionType === "flat_fee"
        ? cents(report.flatFeeInCents) + "/session"
        : `${e.commissionRate}%`,
      cents(e.commissionInCents),
      cents(e.tipInCents),
      cents(e.tipEarnedInCents),
      cents(e.totalEarnedInCents),
    ]);

    // Summary row
    rows.push([
      "TOTAL",
      "",
      `${report.totals.sessions} sessions`,
      "",
      cents(report.totals.revenueInCents),
      "",
      cents(report.totals.commissionInCents),
      cents(report.totals.tipsInCents),
      cents(report.totals.tipEarnedInCents),
      cents(report.totals.totalEarnedInCents),
    ]);

    const csv = [
      `Commission Report: ${report.staffName}`,
      `Period: ${report.periodLabel}`,
      `Commission: ${report.commissionType === "flat_fee" ? "$" + cents(report.flatFeeInCents) + "/session" : report.rate + "%"}`,
      `Tip Split: ${report.tipSplitPercent}%`,
      "",
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="commission-report-${from}-to-${to}.csv"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
