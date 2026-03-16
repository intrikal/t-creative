"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { legalDocuments } from "@/db/schema";
import type { LegalSection } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type LegalDocEntry = {
  id: number;
  type: "privacy_policy" | "terms_of_service";
  version: string;
  intro: string;
  sections: LegalSection[];
  effectiveDate: string;
  changeNotes: string | null;
  isPublished: boolean;
  publishedAt: string | null;
};

export type LegalDocInput = {
  version: string;
  intro: string;
  sections: LegalSection[];
  effectiveDate: string;
  changeNotes?: string;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                             */
/* ------------------------------------------------------------------ */

export async function getLegalDoc(
  type: "privacy_policy" | "terms_of_service",
): Promise<LegalDocEntry | null> {
  try {
    await getUser();

    // Prefer published; fall back to most recent draft
    const rows = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.type, type))
      .orderBy(desc(legalDocuments.isPublished), desc(legalDocuments.id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      version: row.version,
      intro: row.intro,
      sections: (row.sections as LegalSection[]) ?? [],
      effectiveDate: row.effectiveDate,
      changeNotes: row.changeNotes,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                           */
/* ------------------------------------------------------------------ */

/**
 * Save & publish a legal document.
 *
 * If a row already exists for this type: update it in place and mark it
 * published. If no row exists: insert a new one. Either way, only one
 * row per type ends up published.
 */
export async function saveLegalDoc(
  type: "privacy_policy" | "terms_of_service",
  input: LegalDocInput,
): Promise<void> {
  try {
    await getUser();

    const existing = await db
      .select({ id: legalDocuments.id })
      .from(legalDocuments)
      .where(eq(legalDocuments.type, type))
      .orderBy(desc(legalDocuments.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(legalDocuments)
        .set({
          version: input.version,
          intro: input.intro,
          sections: input.sections,
          effectiveDate: input.effectiveDate,
          changeNotes: input.changeNotes ?? null,
          isPublished: true,
          publishedAt: new Date(),
        })
        .where(eq(legalDocuments.id, existing[0].id));
    } else {
      await db.insert(legalDocuments).values({
        type,
        version: input.version,
        intro: input.intro,
        sections: input.sections,
        effectiveDate: input.effectiveDate,
        changeNotes: input.changeNotes ?? null,
        isPublished: true,
        publishedAt: new Date(),
        sortOrder: type === "privacy_policy" ? 0 : 1,
      });
    }

    revalidatePath("/dashboard/legal");
    // Revalidate the public-facing pages
    revalidatePath(type === "privacy_policy" ? "/privacy" : "/terms");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Seed — populate DB from defaults (one-time on first visit)         */
/* ------------------------------------------------------------------ */

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "1. Information We Collect",
    paragraphs: [
      "We may collect the following categories of personal information:",
      "- Identifiers: Name, email address, phone number, mailing address, IP address.\n- Health information: Allergy information, eye conditions, skin sensitivities, and other health disclosures required to safely perform beauty services (lash extensions, permanent jewelry, hair services).\n- Commercial and financial information: Purchase history, payment card information (processed securely through third-party payment processors — we do not store full card numbers), and billing details.\n- Communications and preferences: Messages you send via our contact form, appointment notes, and service preferences.\n- Internet activity information: Browser type, pages visited, referring URLs, and other usage data collected automatically via cookies and analytics tools.",
    ],
  },
  {
    title: "2. How We Collect Information",
    paragraphs: [
      "We collect information in the following ways:",
      "- Directly from you: When you complete our contact or booking forms, submit intake forms prior to appointments, make a purchase, or communicate with us.\n- Automatically: Via cookies, web beacons, and analytics services when you visit our website.\n- Third-party services: From booking platforms, payment processors, and other service providers we use to operate our business.",
    ],
  },
  {
    title: "3. How We Use Your Information",
    paragraphs: [
      "We use the information we collect to:",
      "- Schedule, confirm, and manage appointments.\n- Perform beauty services safely, including reviewing health and allergy information before treatments.\n- Process payments and send receipts or invoices.\n- Respond to your inquiries and provide customer support.\n- Send appointment reminders, follow-up care instructions, and service-related communications.\n- Send promotional communications about our services, products, and offers (you may opt out at any time).\n- Improve our website and services through analytics and user feedback.\n- Comply with applicable legal obligations.",
    ],
  },
  {
    title: "4. Disclosure of Your Information",
    paragraphs: [
      "We may share your information with:",
      "- Service providers: Third-party vendors who assist us in operating our website and conducting our business (e.g., payment processors, booking software, email platforms, website hosting). These parties are contractually obligated to keep your information confidential and use it only to perform services on our behalf.\n- Legal compliance: When required by law, court order, or government authority, or to protect the rights and safety of T Creative Studio, our clients, or others.\n- Business transfers: In connection with a merger, acquisition, or sale of assets, your information may be transferred as a business asset.",
      "We do not sell your personal information to third parties.",
    ],
  },
  {
    title: "5. California Privacy Rights (CCPA)",
    paragraphs: [
      "If you are a California resident, the California Consumer Privacy Act (CCPA) grants you the following rights:",
      "- Right to Know: You may request information about the categories and specific pieces of personal information we have collected about you.\n- Right to Delete: You may request that we delete personal information we have collected from you, subject to certain exceptions.\n- Right to Opt-Out: You have the right to opt out of the sale of your personal information. We do not sell personal information.\n- Right to Non-Discrimination: We will not discriminate against you for exercising your CCPA rights.\n- Right to Correct: You may request correction of inaccurate personal information we hold about you.",
      "To exercise any of these rights, contact us at hello@tcreativestudio.com. We will respond to verifiable requests within 45 days.",
    ],
  },
  {
    title: "6. Health Information",
    paragraphs: [
      "Health and allergy information you provide through intake forms is used exclusively to perform services safely and to protect your health and wellbeing. This information is kept confidential and is not shared with third parties except as required by law. We retain intake forms for the duration of our service relationship and for a reasonable period thereafter consistent with applicable professional standards.",
    ],
  },
  {
    title: "7. Cookies and Tracking Technologies",
    paragraphs: [
      "Our website may use cookies and similar tracking technologies to enhance your browsing experience, analyze site traffic, and understand how visitors use our site. You can control cookies through your browser settings. Disabling cookies may affect the functionality of certain features on our site.",
    ],
  },
  {
    title: "8. Data Retention",
    paragraphs: [
      "We retain your personal information for as long as necessary to fulfill the purposes described in this policy, maintain our business records, comply with legal obligations, resolve disputes, and enforce our agreements. When your information is no longer needed, we will securely delete or anonymize it.",
    ],
  },
  {
    title: "9. Security",
    paragraphs: [
      "We implement reasonable administrative, technical, and physical safeguards to protect your personal information from unauthorized access, disclosure, alteration, or destruction. However, no data transmission over the internet or electronic storage system is completely secure. We cannot guarantee absolute security of your information.",
    ],
  },
  {
    title: "10. Children's Privacy",
    paragraphs: [
      "Our services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children under 16. If you believe we have inadvertently collected such information, please contact us and we will promptly delete it.",
    ],
  },
  {
    title: "11. Changes to This Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. When we do, we will revise the effective date at the top of this page. We encourage you to review this policy periodically. Continued use of our website or services after any changes constitutes your acceptance of the updated policy.",
    ],
  },
  {
    title: "12. Contact Us",
    paragraphs: [
      "If you have questions or concerns about this Privacy Policy or our data practices, please contact us:",
      "T Creative Studio\nSan Jose, California\nhello@tcreativestudio.com",
    ],
  },
];

const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "1. Services",
    paragraphs: [
      'T Creative Studio offers beauty and creative services including lash extensions, permanent jewelry, crochet hair installs, custom crochet crafts, beauty business consulting, HR consulting, and training programs (collectively, "Services"). Services are available to clients in the San Jose, California area.',
      "We reserve the right to refuse service to any client at our sole discretion, including for health or safety reasons.",
    ],
  },
  {
    title: "2. Bookings and Appointments",
    paragraphs: [
      "Appointments may be booked through our website, booking platform, or by contacting us directly. A booking confirmation does not guarantee your appointment until any required deposit has been received (if applicable).",
      "You are responsible for arriving on time for your appointment. Late arrivals may result in a shortened service or forfeiture of your appointment, at our discretion, without refund of any deposit.",
    ],
  },
  {
    title: "3. Cancellation and No-Show Policy",
    paragraphs: [
      "We require at least 48 hours' notice for cancellations or rescheduling. Cancellations made with less than 48 hours' notice may result in forfeiture of your deposit or a cancellation fee.",
      "No-shows (failure to appear for a scheduled appointment without prior notice) will result in forfeiture of any deposit paid and may require prepayment for future bookings.",
      "We understand that emergencies happen. If you need to cancel due to an illness or emergency, please contact us as soon as possible at hello@tcreativestudio.com and we will work with you.",
    ],
  },
  {
    title: "4. Health Disclosures and Contraindications",
    paragraphs: [
      "Certain services (including lash extensions and permanent jewelry) may not be suitable for clients with specific health conditions, allergies, or sensitivities. You are required to complete an intake form prior to your first appointment and to disclose any relevant health conditions, allergies, medications, or sensitivities.",
      "By booking a service, you represent that you have disclosed all known relevant health information and that you are not aware of any condition that would contraindicate the requested service. T Creative Studio is not liable for adverse reactions arising from undisclosed health conditions or allergies.",
      "We reserve the right to decline or discontinue a service if, in our professional judgment, proceeding would pose a risk to your health or safety.",
    ],
  },
  {
    title: "5. Patch Testing",
    paragraphs: [
      "Clients with a history of allergic reactions, sensitive skin, or known sensitivities to adhesives, metals, or other materials are strongly encouraged to request a patch test prior to receiving services. Patch testing must be scheduled in advance. By proceeding with services without a patch test, you acknowledge and accept the associated risks.",
    ],
  },
  {
    title: "6. Payment Terms",
    paragraphs: [
      "Payment is due at the time of service unless otherwise agreed in writing. We accept major credit and debit cards and other payment methods as displayed at checkout.",
      "Deposits, where required, are non-refundable unless we cancel your appointment. Full payment for products purchased through our online shop is required at the time of purchase.",
      "Prices are subject to change at any time without notice. Prices displayed at the time of booking will be honored for that appointment.",
    ],
  },
  {
    title: "7. Refund Policy",
    paragraphs: [
      "Due to the personal nature of beauty services, we do not offer refunds on completed services. If you are unsatisfied with a service, please contact us within 48 hours of your appointment and we will do our best to address your concern, which may include a complimentary touch-up or correction at our discretion.",
      "For products, we accept returns of unused, unopened items in original condition within 14 days of delivery. Sale items and digital products are final sale.",
    ],
  },
  {
    title: "8. Photographs and Media",
    paragraphs: [
      "We may photograph or video our work for portfolio, marketing, and social media purposes. By booking a service, you grant T Creative Studio a non-exclusive, royalty-free license to use photographs or videos of your results (not your face, unless you expressly consent) for promotional purposes.",
      "If you do not wish to be photographed, please let us know before or during your appointment and we will respect your preference.",
    ],
  },
  {
    title: "9. Consulting and Training Services",
    paragraphs: [
      "Consulting and training services are subject to separate agreements or scopes of work, which will be provided to you before services commence. These Terms apply to the extent not superseded by a separate written agreement.",
      "Consulting advice is provided for informational purposes based on our experience and knowledge. It does not constitute legal, financial, or professional advice. You are responsible for independently verifying any recommendations and for decisions made based on our consulting services.",
    ],
  },
  {
    title: "10. Intellectual Property",
    paragraphs: [
      "All content on tcreativestudio.com — including text, images, logos, designs, graphics, and course materials — is the property of T Creative Studio and is protected by applicable copyright and intellectual property laws. You may not reproduce, distribute, or create derivative works without our prior written consent.",
    ],
  },
  {
    title: "11. Limitation of Liability",
    paragraphs: [
      "To the fullest extent permitted by applicable law, T Creative Studio, its owner, and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our services or website, even if advised of the possibility of such damages.",
      "Our total liability for any claim arising out of or related to these Terms or our services shall not exceed the amount you paid us for the specific service giving rise to the claim.",
    ],
  },
  {
    title: "12. Disclaimer of Warranties",
    paragraphs: [
      'Our services and website are provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that services will meet your expectations, that results will be permanent or indefinite in duration, or that the website will be uninterrupted or error-free.',
      "Individual results from beauty services vary based on skin type, aftercare adherence, lifestyle factors, and other individual characteristics.",
    ],
  },
  {
    title: "13. Indemnification",
    paragraphs: [
      "You agree to indemnify, defend, and hold harmless T Creative Studio and its owner from and against any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys' fees) arising from: (a) your use of our services; (b) your violation of these Terms; (c) your failure to disclose relevant health information; or (d) your violation of any applicable law or the rights of any third party.",
    ],
  },
  {
    title: "14. Governing Law and Dispute Resolution",
    paragraphs: [
      "These Terms are governed by the laws of the State of California, without regard to its conflict of law principles. Any dispute arising under these Terms shall be resolved in the state or federal courts located in Santa Clara County, California, and you consent to the personal jurisdiction of those courts.",
    ],
  },
  {
    title: "15. Changes to These Terms",
    paragraphs: [
      "We reserve the right to modify these Terms at any time. Changes are effective immediately upon posting to our website. Your continued use of our services after any modification constitutes acceptance of the updated Terms. We encourage you to review these Terms periodically.",
    ],
  },
  {
    title: "16. Contact Us",
    paragraphs: [
      "If you have questions about these Terms, please contact us:",
      "T Creative Studio\nSan Jose, California\nhello@tcreativestudio.com",
    ],
  },
];

const PRIVACY_INTRO =
  'T Creative Studio ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website tcreativestudio.com or use our services. Please read this policy carefully. If you disagree with its terms, please discontinue use of our site and services.';

const TERMS_INTRO =
  'Please read these Terms of Service ("Terms") carefully before booking an appointment, purchasing products, or using any services provided by T Creative Studio ("we," "us," or "our"). By booking an appointment or using our services, you agree to be bound by these Terms. If you do not agree, please do not use our services.';

export async function seedLegalDefaults(): Promise<void> {
  try {
    await getUser();

    // Only seed if the table is empty
    const existing = await db.select({ id: legalDocuments.id }).from(legalDocuments).limit(1);

    if (existing.length > 0) return;

    await db.insert(legalDocuments).values([
      {
        type: "privacy_policy",
        version: "1.0",
        intro: PRIVACY_INTRO,
        sections: PRIVACY_SECTIONS,
        effectiveDate: "2025-03-16",
        isPublished: true,
        publishedAt: new Date(),
        sortOrder: 0,
      },
      {
        type: "terms_of_service",
        version: "1.0",
        intro: TERMS_INTRO,
        sections: TERMS_SECTIONS,
        effectiveDate: "2025-03-16",
        isPublished: true,
        publishedAt: new Date(),
        sortOrder: 1,
      },
    ]);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
