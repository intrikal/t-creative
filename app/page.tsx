/**
 * Home — Landing page combining hero, content sections, and 3D studio.
 *
 * Server Component. Inherits metadata from root layout (this is the brand
 * homepage, so the root title/description applies directly).
 */

import { Hero } from "@/components/landing/Hero";
import { LandingContent } from "@/components/landing/LandingContent";
import { StudioSection } from "@/components/landing/StudioSection";

export default function Home() {
  return (
    <main id="main-content">
      <Hero />
      <LandingContent />
      <StudioSection />
    </main>
  );
}
