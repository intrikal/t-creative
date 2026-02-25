"use client";

/**
 * components/ConditionalNavbar.tsx — Pathname-gated Navbar wrapper
 *
 * ## Problem it solves
 * The global marketing site Navbar is rendered in the root layout, which wraps
 * every route in the application. Several route subtrees (admin dashboard,
 * assistant shell, client portal, public booking page) have their own navigation
 * patterns and must not show the marketing nav.
 *
 * The idiomatic Next.js solution is nested `layout.tsx` files with route groups,
 * but that requires restructuring the file system every time a new route needs
 * nav suppression. `ConditionalNavbar` provides the same result with a single
 * client-side check — the Navbar import stays in the root layout and this
 * component decides whether to render it.
 *
 * ## How it works
 * `usePathname()` returns the current route pathname on every navigation.
 * If the pathname starts with any suppressed prefix, the component returns `null`
 * (renders nothing). Otherwise it renders `children`, which is the `<Navbar>`.
 *
 * ## Suppressed route prefixes
 * | Prefix         | Reason                                                  |
 * |----------------|---------------------------------------------------------|
 * | /dashboard     | Admin shell — has its own sidebar navigation            |
 * | /assistant     | Assistant panel — has its own layout                   |
 * | /client        | Client portal — card-based UI, no top nav needed       |
 * | /book          | Public booking storefront — standalone page, no nav    |
 *
 * ## Why a Client Component?
 * `usePathname()` is a React hook that subscribes to the router context —
 * hooks require a Client Component. The "use client" directive at the top
 * of this file confines the JS bundle cost to this one small component;
 * the Navbar itself can be a Server Component if needed.
 *
 * ## Adding new suppressed routes
 * Add a new `pathname.startsWith("/your-route")` condition to the if statement.
 * No other files need to change.
 */

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * ConditionalNavbar — renders its children (the Navbar) only on marketing routes.
 *
 * @param children - The Navbar component tree passed from the root layout.
 * @returns The Navbar, or null if the current pathname is in a suppressed subtree.
 */
export function ConditionalNavbar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/book")
  )
    return null;
  return <>{children}</>;
}
