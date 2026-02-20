/**
 * Training — Coming-soon section with email waitlist signup for training programs.
 *
 * Client Component — manages form state and submission with React hooks.
 */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";

export function Training() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  return (
    <section className="py-32 md:py-48 px-6">
      <motion.div
        className="mx-auto max-w-xl text-center"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <span className="text-xs tracking-widest uppercase text-muted mb-6 block">Coming Soon</span>

        <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground mb-8">
          Arriving soon.
        </h2>

        <p className="text-lg text-muted leading-relaxed mb-4">
          Structured programs for beauty professionals who want technique taught with the same rigor
          it&apos;s practiced.
        </p>

        <p className="text-sm text-muted/70 mb-12">
          Certification-based. Studio-standard. Not a course — a professional formation.
        </p>

        {submitted ? (
          <motion.p
            className="text-sm text-foreground font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Noted. We&apos;ll be in touch.
          </motion.p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 px-5 py-3.5 bg-surface text-foreground text-sm placeholder:text-muted/50 border-0 outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <Button>Join the Waitlist</Button>
          </form>
        )}
      </motion.div>
    </section>
  );
}
