"use client";

import { motion } from "framer-motion";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";

export function SignedOutPage() {
  return (
    <AuthLayout panel={<AuthBrandingPanel />}>
      <div className="w-full max-w-sm text-center space-y-8">
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center"
        >
          <motion.svg width="32" height="32" viewBox="0 0 32 32" fill="none">
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
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            You&apos;ve been signed out
          </h1>
          <p className="text-sm text-muted">
            Thanks for visiting T Creative Studio. See you next time!
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Button href="/login" variant="primary">
            Sign back in
          </Button>
        </motion.div>
      </div>
    </AuthLayout>
  );
}
