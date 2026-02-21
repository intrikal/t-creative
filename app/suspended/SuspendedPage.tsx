"use client";

import { motion } from "framer-motion";
import { LuTriangleAlert } from "react-icons/lu";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";
import { AuthLayout } from "@/components/auth/AuthLayout";

export function SuspendedPage() {
  return (
    <AuthLayout panel={<AuthBrandingPanel />}>
      <div className="w-full max-w-sm text-center space-y-8">
        {/* Warning icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center"
        >
          <LuTriangleAlert className="w-7 h-7 text-amber-500" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="space-y-3"
        >
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            Your account has been suspended
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            If you believe this is an error, please reach out so we can help.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="space-y-2"
        >
          <p className="text-sm text-muted">
            Contact us at{" "}
            <a href="mailto:hello@tcreativestudio.com" className="text-accent hover:underline">
              hello@tcreativestudio.com
            </a>
          </p>
        </motion.div>
      </div>
    </AuthLayout>
  );
}
