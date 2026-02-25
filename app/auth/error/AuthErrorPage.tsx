"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LuCircleAlert } from "react-icons/lu";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const detail = searchParams.get("detail");

  return (
    <AuthLayout panel={<AuthBrandingPanel />}>
      <div className="w-full max-w-sm text-center space-y-8">
        {/* Error icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center"
        >
          <LuCircleAlert className="w-7 h-7 text-red-500" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="space-y-3"
        >
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            {detail || "We ran into an issue during authentication. Please try again."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Button asChild variant="default">
            <Link href="/login">Try Again</Link>
          </Button>
        </motion.div>
      </div>
    </AuthLayout>
  );
}

export function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
