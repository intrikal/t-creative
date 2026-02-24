/**
 * Aftercare Instructions tab — read-only do's and don'ts for each service type.
 *
 * **Currently hardcoded** — displays static aftercare content for:
 * - Lash Extensions (5 do's, 5 don'ts)
 * - Permanent Jewelry (3 do's, 3 don'ts)
 * - Crochet & Braids (3 do's, 3 don'ts)
 *
 * Content is shown to clients after appointments and on the booking page.
 * Links to a dedicated "Aftercare & Policies" page for detailed editing.
 *
 * @module settings/components/AftercareTab
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AFTERCARE_SECTIONS = [
  {
    id: "lash",
    title: "Lash Extensions",
    dos: [
      "Keep lashes dry for 24\u201348 hours after appointment.",
      "Cleanse lashes 3\u20134\u00d7 per week with an oil-free lash cleanser.",
      "Brush lashes gently each morning with a clean spoolie.",
      "Sleep on your back or use a lash pillow to protect shape.",
      "Book your fill every 2\u20133 weeks to maintain fullness.",
    ],
    donts: [
      "Do not use oil-based products near the eye area.",
      "Do not pick, pull, or rub lashes \u2014 causes premature shedding.",
      "Avoid steam rooms, saunas, or prolonged hot showers for 48 hours.",
      "Do not use a mechanical eyelash curler.",
      "Avoid waterproof mascara on extensions.",
    ],
  },
  {
    id: "jewelry",
    title: "Permanent Jewelry",
    dos: [
      "Your jewelry is safe to shower, swim, and sleep in.",
      "Polish occasionally with a soft cloth to maintain shine.",
      "Visit the studio if the chain needs adjustment or re-welding.",
    ],
    donts: [
      "Avoid harsh chemicals like bleach, chlorine, or cleaning products.",
      "Do not apply lotions or perfumes directly onto the chain.",
      "Do not attempt to cut or remove at home \u2014 visit the studio.",
    ],
  },
  {
    id: "crochet",
    title: "Crochet & Braids",
    dos: [
      "Moisturize your scalp with a lightweight oil 2\u20133\u00d7 per week.",
      "Sleep with a satin bonnet or on a satin pillowcase.",
      "Wash style every 2\u20133 weeks using diluted shampoo or co-wash.",
    ],
    donts: [
      "Do not leave crochet styles in longer than 8 weeks.",
      "Avoid excess moisture or product buildup on extensions.",
      "Do not scratch aggressively \u2014 use a rat-tail comb for itching.",
    ],
  },
];

export function AftercareTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Aftercare Instructions</h2>
        <p className="text-xs text-muted mt-0.5">
          Shown to clients after their appointment and on your booking page
        </p>
      </div>
      <div className="space-y-4">
        {AFTERCARE_SECTIONS.map((section) => (
          <Card key={section.id} className="gap-0">
            <CardHeader className="pb-0 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4e6b51] mb-2">
                    Do&apos;s
                  </p>
                  <ul className="space-y-1.5">
                    {section.dos.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-foreground leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4e6b51] mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive mb-2">
                    Don&apos;ts
                  </p>
                  <ul className="space-y-1.5">
                    {section.donts.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-foreground leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted">
        To edit aftercare content in detail, go to the Aftercare &amp; Policies page.
      </p>
    </div>
  );
}
