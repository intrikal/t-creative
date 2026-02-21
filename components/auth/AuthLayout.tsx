"use client";

import type { ReactNode } from "react";

interface AuthLayoutProps {
  panel: ReactNode;
  children: ReactNode;
  panelClassName?: string;
}

export function AuthLayout({ panel, children, panelClassName = "" }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left panel — branding / visual */}
      <div
        className={`h-[35vh] md:h-auto md:w-[45%] lg:w-[45%] bg-surface flex items-center justify-center p-6 md:p-8 lg:p-12 shrink-0 ${panelClassName}`}
      >
        {panel}
      </div>

      {/* Right — main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 md:py-0">{children}</div>
    </div>
  );
}
