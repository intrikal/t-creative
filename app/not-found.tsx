import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found | T Creative Studio",
  description: "The page you're looking for doesn't exist or may have moved.",
  robots: { index: false, follow: false },
};

/**
 * Not Found — branded 404 page shown when a URL doesn't match any route.
 */
export default function NotFound() {
  return (
    <main id="main-content" className="pt-16">
      <div className="py-24 md:py-32 px-6 text-center">
        <div className="mx-auto max-w-md">
          <p className="text-xs tracking-widest uppercase text-muted mb-6">404</p>
          <h1 className="text-3xl font-light tracking-tight text-foreground mb-4">
            Page not found.
          </h1>
          <p className="text-sm text-muted mb-8">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 text-xs tracking-wide uppercase bg-foreground text-background hover:bg-muted transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
