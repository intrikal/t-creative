/**
 * ConsultingPage — HR & Beauty Business consulting with specific outcomes and credentials.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";

const services = [
  {
    title: "HR Strategy & Consulting",
    tag: "Remote · All Industries",
    description:
      "Strategic HR consulting grounded in real corporate experience. Whether you're a startup building your first team or an established company refining your people processes, this engagement covers what actually moves the needle.",
    outcomes: [
      "Hiring process design and job description development",
      "Onboarding workflows and 90-day frameworks",
      "Performance review systems and feedback structures",
      "Team structure and reporting line clarity",
      "HR compliance fundamentals for small businesses",
      "Manager coaching and team communication systems",
    ],
    ideal:
      "Founders, operations leads, and small business owners who are scaling their team and need real HR infrastructure — not generic advice.",
  },
  {
    title: "Beauty Business Consulting",
    tag: "Remote · Beauty & Wellness",
    description:
      "Built specifically for beauty professionals ready to run their business with intention. This isn't theory — it's the exact systems, pricing strategies, and client frameworks used to build T Creative Studio from the ground up.",
    outcomes: [
      "Service menu design and pricing strategy",
      "Client retention and rebooking systems",
      "Deposit and cancellation policy setup",
      "Social media and content strategy for beauty pros",
      "Transitioning from booth rental to studio ownership",
      "Building a referral-based clientele from scratch",
    ],
    ideal:
      "Lash techs, permanent jewelry artists, estheticians, and salon owners who are ready to grow sustainably — not just hustle harder.",
  },
];

const benefits = [
  "Flexible scheduling around your business hours — no commute",
  "Recorded sessions your team can reference and revisit",
  "Deliverables in writing after every session",
  "Access to templates, frameworks, and tools used in-practice",
];

export function ConsultingPage() {
  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Hero */}
        <section className="py-24 md:py-32 px-6 bg-foreground text-background">
          <div className="mx-auto max-w-5xl text-center">
            <motion.span
              className="text-xs tracking-widest uppercase text-accent mb-6 block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Remote Consulting Available
            </motion.span>
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-tight mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              HR & Business Consulting
            </motion.h1>
            <motion.p
              className="text-base md:text-lg text-background/60 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Two practices, one philosophy: build things that actually work. Whether you need HR
              infrastructure for a growing team or a business strategy for your beauty studio — this
              is operational expertise from someone who lives it.
            </motion.p>
          </div>
        </section>

        {/* Services */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-4xl flex flex-col gap-8">
            {services.map((service, i) => (
              <motion.div
                key={service.title}
                className="border border-foreground/10 p-8 md:p-12"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                  <h2 className="text-xl md:text-2xl font-light tracking-tight text-foreground">
                    {service.title}
                  </h2>
                  <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted self-start shrink-0">
                    {service.tag}
                  </span>
                </div>

                <p className="text-sm text-muted leading-relaxed mb-6">{service.description}</p>

                <div className="mb-6">
                  <h3 className="text-xs tracking-widest uppercase text-foreground mb-4">
                    What We Cover
                  </h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {service.outcomes.map((item) => (
                      <li key={item} className="text-sm text-muted flex items-start gap-2">
                        <span className="text-accent mt-0.5">+</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-muted mb-6 border-l-2 border-accent/40 pl-3 leading-relaxed">
                  <span className="font-medium text-foreground">Ideal for: </span>
                  {service.ideal}
                </p>

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <span className="text-sm text-accent">
                    Contact for quote — engagements vary by scope
                  </span>
                  <Link
                    href="/contact"
                    className="text-xs tracking-widest uppercase text-foreground hover:text-accent transition-colors duration-200 border border-foreground/20 hover:border-accent/40 px-5 py-2.5"
                  >
                    Request Consultation
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why Remote */}
        <section className="py-24 md:py-32 px-6 bg-surface">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-2xl md:text-3xl font-light tracking-tight text-foreground mb-10">
                Why Remote Consulting?
              </h2>
              <ul className="space-y-4 text-left max-w-md mx-auto">
                {benefits.map((benefit, i) => (
                  <motion.li
                    key={benefit}
                    className="flex items-start gap-3 text-sm text-muted"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <span className="text-accent mt-0.5">+</span>
                    {benefit}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
