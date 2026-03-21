/**
 * Founder — Trini's editorial introduction. Between Acts II and III.
 *
 * Portrait rendered as a draggable card stack using @react-spring/web + @use-gesture/react,
 * matching the codesandbox.io/p/sandbox/to6uf interaction pattern.
 */
"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSprings, animated, to as interpolate } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { motion, useScroll, useTransform } from "framer-motion";

// Photo paths for the card stack — ordered bottom-to-top (last item renders on top).
// Array structure enables useSprings to create one spring per card and bind to map indices.
const PHOTOS = [
  "/images/trini-4.jpg",
  "/images/trini-3.jpg",
  "/images/trini-2.jpg",
  "/images/trini.jpg", // top card last
];

// Resting stack position for each card — slight y offset (i * -4) and random rotation
// give the pile a natural, scattered look. Math.random() is intentional here:
// it runs once per card on initial render, giving each card a unique tilt.
const to = (i: number) => ({
  x: 0,
  y: i * -4,
  scale: 1,
  rot: -6 + Math.random() * 12,
  delay: i * 80,
});

// Cards fly in from y:-1000 (above viewport) with scale 1.5 on mount — dramatic entrance.
const from = () => ({ x: 0, rot: 0, scale: 1.5, y: -1000 });

// Template literal builds a CSS transform string from rotation and scale spring values.
// perspective(1200px) + rotateX(8deg) creates a slight isometric tilt that makes the
// card stack feel three-dimensional. rotateY and rotateZ respond to drag movement.
const trans = (r: number, s: number) =>
  `perspective(1200px) rotateX(8deg) rotateY(${r / 14}deg) rotateZ(${r}deg) scale(${s})`;

/**
 * CardStack — Draggable card stack interaction using react-spring + use-gesture.
 * Users drag cards off-screen to reveal the one beneath. Once all cards are swiped,
 * the stack resets after a 600ms delay. No props — reads from module-level PHOTOS array.
 */
function CardStack() {
  // gone: Set tracking which card indices have been swiped away.
  // useState with initializer function (lazy init) creates the Set once and persists it
  // across renders without re-creating. Set chosen over array for O(1) .has() lookups.
  const [gone] = useState(() => new Set<number>());

  // useSprings creates one spring per photo. Each spring holds x, y, rot, scale values.
  // Spread ...to(i) sets the resting position; from: from() sets the initial fly-in state.
  const [springs, api] = useSprings(PHOTOS.length, (i) => ({
    ...to(i),
    from: from(),
  }));

  // useDrag binds drag gesture handlers to each card. Destructuring extracts:
  // - args: [index] — the card index passed via bind(i) in the JSX
  // - active — whether the user is currently dragging
  // - movement: [mx] — horizontal pixel displacement from drag start
  // - direction: [xDir] — drag direction (-1 = left, 1 = right)
  // - velocity: [vx] — drag speed for flick detection
  const bind = useDrag(
    ({ args: [index], active, movement: [mx], direction: [xDir], velocity: [vx] }) => {
      // Flick detection: velocity > 0.2 means the card was swiped fast enough to dismiss.
      const trigger = vx > 0.2;
      // Direction normalized to -1 or 1 for calculating the off-screen exit position.
      const dir = xDir < 0 ? -1 : 1;

      if (!active && trigger) gone.add(index);

      // api.start updates springs — only the dragged card (index === i) gets new values.
      // Ternary chain for x: gone cards fly off-screen, active drags follow cursor, resting = 0.
      api.start((i) => {
        if (index !== i) return;
        const isGone = gone.has(index);
        const x = isGone ? (200 + window.innerWidth) * dir : active ? mx : 0;
        const rot = mx / 100 + (isGone ? dir * 10 * vx : 0);
        const scale = active ? 1.08 : 1;

        return {
          x,
          rot,
          scale,
          delay: undefined,
          config: {
            friction: 50,
            tension: active ? 800 : isGone ? 200 : 500,
          },
        };
      });

      // Reset all cards once the stack is exhausted
      if (!active && gone.size === PHOTOS.length) {
        setTimeout(() => {
          gone.clear();
          api.start((i) => to(i));
        }, 600);
      }
    },
  );

  return (
    <div className="relative w-72 md:w-80 lg:w-96" style={{ aspectRatio: "3/4" }}>
      {/* Decorative offset border */}
      <motion.div
        className="absolute border border-foreground/25 rounded-sm pointer-events-none"
        style={{ inset: 0, translate: "14px 14px" }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.9, ease: "easeOut" }}
      />

      {/* springs.map() renders one animated layer per photo. Each spring provides
          x, y, rot, scale values. interpolate([rot, scale], trans) combines rotation
          and scale into a single CSS transform string via the trans() helper.
          bind(i) passes the card index to the drag handler for per-card targeting. */}
      {springs.map(({ x, y, rot, scale }, i) => (
        <animated.div key={i} className="absolute inset-0" style={{ x, y, zIndex: i }}>
          <animated.div
            {...bind(i)}
            className="absolute inset-0 overflow-hidden rounded-sm shadow-md cursor-grab active:cursor-grabbing"
            style={{ transform: interpolate([rot, scale], trans) }}
          >
            <Image
              src={PHOTOS[i]}
              alt="Trini Lam — founder of T Creative Studio"
              fill
              className="object-cover object-top select-none"
              draggable={false}
              sizes="(max-width: 768px) 288px, (max-width: 1024px) 320px, 384px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/15 via-transparent to-transparent pointer-events-none" />
          </animated.div>
        </animated.div>
      ))}

      {/* Drag hint */}
      <div className="absolute -bottom-6 inset-x-0 flex justify-center pointer-events-none">
        <span className="text-[9px] tracking-[0.25em] uppercase text-muted select-none">
          drag to explore
        </span>
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function Founder() {
  // useRef for scroll-linked parallax on the section.
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  // Subtle 8% scale increase on scroll — adds depth without being distracting.
  // Currently defined but applied via the brand's scroll system (may be wired to a future image element).
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.0, 1.08]);

  return (
    <section ref={sectionRef} className="bg-background overflow-hidden" aria-label="Meet Trini">
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center py-16 md:py-24 px-6 md:px-12 gap-12 md:gap-16">
        {/* Card stack */}
        <motion.div
          className="w-full md:w-[45%] flex justify-center md:justify-end pb-8"
          initial={{ opacity: 0, x: -32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <CardStack />
        </motion.div>

        {/* Identity copy */}
        <motion.div
          className="w-full md:w-[55%] flex flex-col justify-center py-8 md:py-0"
          initial={{ opacity: 0, x: 32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-6 block">
            The Architect
          </span>

          <motion.h2
            className="font-display text-5xl md:text-6xl lg:text-7xl font-light tracking-tight text-foreground leading-[1.05] mb-2"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            whileInView={{ clipPath: "inset(0 0% 0 0)" }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            Trini Lam.
          </motion.h2>

          <motion.div
            className="w-px h-8 bg-foreground/15 ml-1 mb-4"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.7 }}
            style={{ transformOrigin: "top" }}
          />

          <p className="font-display text-lg md:text-xl text-foreground/70 italic leading-relaxed max-w-sm mb-6">
            She doesn&apos;t pick a lane. She builds the road.
          </p>

          <p className="text-sm text-muted leading-relaxed max-w-sm mb-10">
            Some people specialize. Trini systematized. She discovered that the same discipline that
            places a lash at the exact angle to catch light also restructures a business to run
            without her in the room. T Creative Studio is the proof: one methodology, applied across
            every material she touches.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/book/tcreativestudio"
              className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-foreground w-fit group"
            >
              <span className="nav-link-reveal pb-px">Book an Appointment</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-muted hover:text-foreground transition-colors duration-200 w-fit"
            >
              About Trini
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
