/**
 * POST /api/chat/fallback — forwards a chatbot "Something else?" question to the admin.
 *
 * Unauthenticated. Validates input, looks up the admin email, and sends via Resend.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { RESEND_FROM, isResendConfigured } from "@/lib/resend";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, question } = body as Record<string, string>;

  if (!name?.trim() || !email?.trim() || !question?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const [admin] = await db
    .select({ email: profiles.email, firstName: profiles.firstName })
    .from(profiles)
    .where(eq(profiles.role, "admin"))
    .limit(1);

  if (admin && isResendConfigured()) {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.emails.send({
      from: RESEND_FROM,
      to: admin.email,
      replyTo: email.trim(),
      subject: `Chatbot question from ${name.trim()}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 16px;font-size:20px;color:#1c1917">New question from your website chatbot</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#78716c;width:100px">Name</td><td style="padding:8px 0;color:#1c1917">${name.trim()}</td></tr>
            <tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0;color:#1c1917"><a href="mailto:${email.trim()}">${email.trim()}</a></td></tr>
            <tr><td style="padding:8px 0;color:#78716c;vertical-align:top">Question</td><td style="padding:8px 0;color:#1c1917">${question.trim()}</td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:13px;color:#a8a29e">Reply directly to this email to reach ${name.trim()}.</p>
        </div>
      `,
    });
  }

  return NextResponse.json({ success: true });
}
