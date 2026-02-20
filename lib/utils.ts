/**
 * utils.ts — CSS class name merging utility
 *
 * What: Exports a single helper function `cn()` that intelligently merges CSS
 *       class names, resolving conflicts between Tailwind CSS utility classes.
 * Why: When building UI components, you often need to combine base classes with
 *      conditional or overridden classes. Without this, conflicting Tailwind
 *      classes (e.g., "px-4" and "px-6") would both apply, causing bugs.
 *      `cn()` ensures the last class wins, just like you'd expect.
 * How: Combines two libraries — `clsx` (handles conditional class joining) and
 *      `tailwind-merge` (deduplicates conflicting Tailwind classes). This is
 *      the standard utility recommended by the shadcn/ui component library.
 *
 * Key concepts:
 * - ClassValue: Accepts strings, arrays, objects, or falsy values — so you can
 *   write `cn("base", condition && "extra")` without worrying about `false`.
 * - Used by virtually every UI component in the project.
 *
 * Related files:
 * - components/ui/*.tsx — all shadcn components use cn() for class merging
 * - components/onboarding/*.tsx — onboarding components use cn() as needed
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
