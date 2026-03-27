/**
 * ImmersiveIntro — Narrative section revealing the studio philosophy phrase by phrase.
 *
 * Used on the landing page between the hero and feature sections.
 * No props — narrative content is static brand copy.
 */

const phrases = [
  "Most studios separate the craft from the business.",
  "The appointment from the invoice. The portfolio from the product.",
  "The experience from the system that supports it.",
  "We refused.",
  "T Creative Studio is a single, continuous space —",
  "where beauty work, client relationships, scheduling, payments,",
  "messaging, and creative output live under one roof.",
  "Not bolted together. Designed together.",
];

export function ImmersiveIntro() {
  return (
    <section className="relative py-32 md:py-48 px-6">
      <div className="relative mx-auto max-w-3xl">
        {phrases.map((phrase, i) => (
          <p
            key={i}
            className={`text-xl md:text-2xl lg:text-3xl leading-relaxed mb-4 ${
              phrase === "We refused." || phrase === "Not bolted together. Designed together."
                ? "font-medium text-foreground mt-8"
                : "text-muted"
            }`}
          >
            {phrase}
          </p>
        ))}
      </div>
    </section>
  );
}
