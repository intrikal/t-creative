"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { OnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: OnboardingForm;
  role?: "client" | "assistant";
}

export function StepComplete({ form, role = "client" }: StepProps) {
  const firstName = form.getFieldValue("firstName");

  return (
    <div className="text-center space-y-8">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center"
      >
        <motion.svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <motion.path
            d="M8 16.5L13.5 22L24 11"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          />
        </motion.svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="space-y-3"
      >
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-foreground">
          You&apos;re all set{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-muted text-base max-w-sm mx-auto">
          {role === "assistant"
            ? "Welcome to the team! We\u2019ve saved your info \u2014 your schedule will be ready soon."
            : "Welcome to T Creative Studio. We\u2019ve saved your preferences \u2014 when you\u2019re ready, we\u2019re here."}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 justify-center"
      >
        {role === "assistant" ? (
          <>
            <Button href="/" variant="primary">
              View your schedule
            </Button>
            <Button href="/" variant="secondary">
              Go to Dashboard
            </Button>
          </>
        ) : (
          <>
            <Button href="/services" variant="primary">
              Book a Session
            </Button>
            <Button href="/" variant="secondary">
              Explore the Studio
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
