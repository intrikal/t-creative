/**
 * FAQ — Frequently asked questions to reduce booking friction.
 *
 * Client Component — uses React state for accordion open/close.
 * Accepts entries + policies as props for dynamic content from the admin dashboard.
 * Supports {depositPercent}, {cancelWindowHours}, {lateCancelFeePercent},
 * {noShowFeePercent} tokens in answers, interpolated from policies.
 */
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface PolicyValues {
  depositPercent: number;
  cancelWindowHours: number;
  lateCancelFeePercent: number;
  noShowFeePercent: number;
}

function interpolatePolicies(text: string, policies: PolicyValues): string {
  return text
    .replace(/\{depositPercent\}/g, String(policies.depositPercent))
    .replace(/\{cancelWindowHours\}/g, String(policies.cancelWindowHours))
    .replace(/\{lateCancelFeePercent\}/g, String(policies.lateCancelFeePercent))
    .replace(/\{noShowFeePercent\}/g, String(policies.noShowFeePercent));
}

const FALLBACK_QUESTIONS = [
  {
    question: "Where are you located?",
    answer:
      "T Creative Studio is based in San Jose, California, serving the greater Bay Area. For events and pop-ups, we travel to your location.",
  },
  {
    question: "Do I need to pay a deposit?",
    answer:
      "Yes — a 25% deposit is required to confirm your appointment. The remaining balance is due at the time of service. Deposits are processed securely through Square.",
  },
  {
    question: "What's the cancellation policy?",
    answer:
      "We require at least 48 hours notice for cancellations. Late cancellations are subject to a 50% fee, and no-shows are charged the full service amount.",
  },
  {
    question: "Can I book for a group or event?",
    answer:
      "Absolutely. We offer private lash parties (up to 6 guests), permanent jewelry pop-ups at your venue, bridal packages, and corporate team events. Reach out through the contact form to get started.",
  },
  {
    question: "Do you offer training and certifications?",
    answer:
      "Yes — we run certification programs for lash extensions, permanent jewelry welding, and beauty business consulting. Each program includes hands-on training, materials, and a certificate of completion.",
  },
  {
    question: "How do I prepare for my appointment?",
    answer:
      "Come with a clean face (no eye makeup for lash services). We'll send you a confirmation email with specific prep instructions for your service. If you have allergies or sensitivities, let us know when booking.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-foreground/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors duration-200 pr-4">
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="text-sm text-muted leading-relaxed pb-5">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ({
  entries,
  policies,
}: {
  entries?: { question: string; answer: string }[];
  policies?: PolicyValues;
}) {
  const questions = entries ?? FALLBACK_QUESTIONS;
  return (
    <section className="py-28 md:py-40 px-6 bg-background" aria-label="FAQ">
      <div className="mx-auto max-w-3xl">
        <motion.div
          className="mb-12 md:mb-16 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-5 block">FAQ</span>
          <h2 className="font-display text-3xl md:text-5xl font-light tracking-tight text-foreground">
            Common questions.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {questions.map((item) => (
            <FAQItem
              key={item.question}
              question={item.question}
              answer={policies ? interpolatePolicies(item.answer, policies) : item.answer}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
