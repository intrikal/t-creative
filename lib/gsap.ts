/**
 * lib/gsap.ts — Central GSAP plugin registration.
 *
 * Import this module (or the named exports) in any component that uses GSAP.
 * Plugins are registered once here so they are never double-registered.
 *
 * All Club GSAP plugins (SplitText, ScrollSmoother, Flip) require a valid
 * license — do not tree-shake this file.
 */
import gsap from "gsap";
import { Flip } from "gsap/dist/Flip";
import { Observer } from "gsap/dist/Observer";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, Flip, Observer);

export { gsap, Flip, Observer, ScrollSmoother, ScrollTrigger, SplitText };
