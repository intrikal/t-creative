/**
 * AboutPage — Client Component rendering the About page content.
 *
 * Displays founder bio, four service pillars, social links, and location CTA.
 */
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";
import { socials } from "@/lib/socials";

export function AboutPage() {
  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Hero — dark background with photo */}
        <section className="bg-foreground text-background py-24 md:py-32 px-6">
          <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-xs tracking-widest uppercase text-accent mb-6 block">
                About
              </span>
              <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-6">
                Hi, I&apos;m Trini.
              </h1>
              <p className="text-base text-background/70 leading-relaxed mb-4">
                A creative entrepreneur passionate about helping others feel confident and
                beautiful. With expertise spanning lash artistry, permanent jewelry design,
                handcrafted crochet, and business consulting, I bring intention and care to every
                creation.
              </p>
              <p className="text-base text-background/70 leading-relaxed">
                Based in the San Francisco Bay Area, I combine artistic vision with business acumen
                to transform both looks and businesses. I also work as an HR professional, bringing
                strategic expertise to help companies build better teams and processes.
              </p>
            </motion.div>

            <motion.div
              className="flex justify-center md:justify-end"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <div className="w-72 h-72 md:w-80 md:h-96 rounded-sm overflow-hidden relative shadow-2xl">
                <Image
                  src="/images/trini.jpg"
                  alt="Trini Lam — Founder & Creative Director of T Creative Studio"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* What I Do */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-4xl">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground mb-6">
                Four passions, one mission.
              </h2>
              <p className="text-base text-muted max-w-xl mx-auto">
                Helping you feel confident, beautiful, and empowered.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  title: "Lash Extensions",
                  description:
                    "Precision work with classic, hybrid, and volume sets. Each appointment structured around technique and care.",
                  color: "#C4907A",
                },
                {
                  title: "Permanent Jewelry",
                  description:
                    "14k gold-filled and sterling silver chains, custom-fit and welded on. Bracelets, anklets, and necklaces.",
                  color: "#D4A574",
                },
                {
                  title: "Custom Crochet",
                  description:
                    "Handcrafted pieces made to order — bags, accessories, home goods, and custom commissions.",
                  color: "#7BA3A3",
                },
                {
                  title: "Business Consulting",
                  description:
                    "HR strategy, operational infrastructure, and consulting for entrepreneurs ready to grow.",
                  color: "#5B8A8A",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Connect — Social Links */}
        <section className="py-24 md:py-32 px-6 bg-surface">
          <div className="mx-auto max-w-4xl">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-xs tracking-widest uppercase text-muted mb-6 block">
                Connect
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                Follow along.
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {socials.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group border border-foreground/8 p-6 hover:border-foreground/20 transition-all duration-200 flex items-start gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                  >
                    <Icon
                      size={20}
                      className="text-muted group-hover:text-accent transition-colors flex-shrink-0 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors block mb-0.5">
                        {s.label}
                      </span>
                      <span className="text-xs text-muted">{s.description}</span>
                    </div>
                  </motion.a>
                );
              })}
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-xs tracking-widest uppercase text-muted mb-6 block">
                Location
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground mb-6">
                Serving San Jose &amp; the Bay Area
              </h2>
              <p className="text-base text-muted leading-relaxed mb-10">
                Whether you&apos;re looking for beauty services, custom crochet work, or business
                consulting — I&apos;m here to help.
              </p>
              <a
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-wide uppercase bg-foreground text-background hover:bg-muted transition-colors duration-200"
              >
                Get in Touch
              </a>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
