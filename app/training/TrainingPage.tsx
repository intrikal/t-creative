/**
 * TrainingPage — Client Component rendering certification training programs.
 *
 * Displays lash and permanent jewelry training with curriculum and pricing.
 */
"use client";

import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";

const programs = [
  {
    title: "Lash Extension Certification",
    color: "#C4907A",
    format: "In Person",
    duration: "16 hours",
    price: "Starting at $1,500",
    description:
      "Learn the art of lash extensions in this comprehensive training program. Perfect for beginners or those looking to refine their skills. Master classic and volume techniques, client consultation, and business fundamentals.",
    curriculum: [
      "Classic lash application techniques",
      "Volume lash methods (2D, 3D, 4D)",
      "Lash mapping and design",
      "Client consultation and aftercare",
    ],
  },
  {
    title: "Permanent Jewelry Certification",
    color: "#D4A574",
    format: "In Person",
    duration: "8 hours",
    price: "Starting at $1,200",
    description:
      "Master the art of permanent jewelry welding. Learn professional techniques for creating seamless bracelets, necklaces, and anklets. Perfect for those looking to add permanent jewelry to their services or start a new business.",
    curriculum: [
      "Welding techniques and safety",
      "Chain selection and sizing",
      "Bracelet, necklace, and anklet application",
      "Client consultation and aftercare",
    ],
  },
];

export function TrainingPage() {
  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Hero */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-5xl text-center">
            <motion.span
              className="text-xs tracking-widest uppercase text-muted mb-6 block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Training Programs
            </motion.span>
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Learn from an expert.
            </motion.h1>
            <motion.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Comprehensive training programs designed to help you master lash extensions and
              permanent jewelry techniques.
            </motion.p>
          </div>
        </section>

        {/* Programs */}
        <section className="pb-32 px-6">
          <div className="mx-auto max-w-4xl flex flex-col gap-8">
            {programs.map((program, i) => (
              <motion.div
                key={program.title}
                className="border border-foreground/10 overflow-hidden"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                {/* Color bar */}
                <div className="h-1.5" style={{ backgroundColor: program.color }} />

                <div className="p-8 md:p-12">
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xl md:text-2xl font-light tracking-tight text-foreground mb-2">
                        {program.title}
                      </h2>
                      <div className="flex flex-wrap gap-3">
                        <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted">
                          {program.format}
                        </span>
                        <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted">
                          {program.duration}
                        </span>
                        <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted">
                          Certification
                        </span>
                      </div>
                    </div>
                    <span className="text-lg font-medium text-accent">{program.price}</span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted leading-relaxed mb-8">{program.description}</p>

                  {/* Curriculum */}
                  <div className="mb-8">
                    <h3 className="text-xs tracking-widest uppercase text-foreground mb-4">
                      What You&apos;ll Learn
                    </h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {program.curriculum.map((item) => (
                        <li key={item} className="text-sm text-muted flex items-start gap-2">
                          <span className="text-accent mt-0.5">+</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <a
                    href="/contact"
                    className="inline-flex items-center justify-center px-6 py-3 text-xs tracking-widest uppercase border border-foreground/20 text-foreground hover:border-accent hover:text-accent transition-colors duration-200"
                  >
                    Request Training Info
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
