/**
 * Stats — Key metrics strip for social proof.
 *
 * Used on the landing page as a compact credibility band between content sections.
 * Client Component — uses Framer Motion for staggered number reveals.
 *
 * Values are computed server-side (live DB counts) and can be overridden via SiteContent.
 */
"use client";

import { m } from "framer-motion";

interface StatsProps {
  clientsServed: string;
  averageRating: string;
  rebookingRate: string;
  servicesCount: string;
}

export function Stats({ clientsServed, averageRating, rebookingRate, servicesCount }: StatsProps) {
  const stats = [
    { value: clientsServed, label: "Clients Served" },
    { value: averageRating, label: "Average Rating" },
    { value: rebookingRate, label: "Rebooking Rate" },
    { value: servicesCount, label: "Services Under One Roof" },
  ];

  return (
    <section className="py-20 md:py-28 px-6 bg-surface">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, i) => (
            <m.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <p className="text-4xl md:text-5xl font-light tracking-tight text-accent mb-2">
                {stat.value}
              </p>
              <p className="text-xs tracking-widest uppercase text-muted">{stat.label}</p>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
