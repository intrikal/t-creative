/**
 * ConsultingPage — Client Component rendering the Consulting page content.
 *
 * Displays HR and business consulting services with remote availability emphasis.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";

const services = [
  {
    title: "HR Strategy & Consulting",
    description:
      "Get expert guidance on HR strategy, team building, and process optimization. All consulting services are available remotely, making it easy to work together no matter where your business is located.",
  },
  {
    title: "Business Growth Consulting",
    description:
      "Strategic business consulting focused on growth, efficiency, and scaling. Remote consulting available to work around your schedule. Get expert advice on process optimization, team structure, and business strategy.",
  },
];

const benefits = [
  "Flexible scheduling that works around your business hours",
  "No travel time or costs — we meet virtually",
  "Access to expert guidance from anywhere",
  "Recorded sessions for your team to reference",
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
              className="text-base md:text-lg text-background/60 max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Strategic HR and business consulting to help your company grow. All consulting
              services are available remotely.
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
                  <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted self-start">
                    Remote
                  </span>
                </div>
                <p className="text-sm text-muted leading-relaxed mb-6">{service.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-accent">Contact for quote</span>
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
