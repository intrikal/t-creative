"use client";

import { motion } from "framer-motion";
import { LuLock } from "react-icons/lu";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";

export function UnauthorizedPage() {
  return (
    <AuthLayout panel={<AuthBrandingPanel />}>
      <div className="w-full max-w-sm text-center space-y-8">
        {/* Lock icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto w-16 h-16 rounded-full bg-surface flex items-center justify-center"
        >
          <LuLock className="w-7 h-7 text-muted" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="space-y-3"
        >
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            You don&apos;t have access
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            You don&apos;t have permission to view this page. If you think this is a mistake, please
            contact us.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Button href="/" variant="primary">
            Go Home
          </Button>
        </motion.div>
      </div>
    </AuthLayout>
  );
}
