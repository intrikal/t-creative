"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";

interface WorkItem {
  id: string;
  caption: string;
  color: string;
  category: string;
}

// Just the best 6 — no filter needed on landing page
const WORK: WorkItem[] = [
  { id: "w1", caption: "Volume Set — Special Event", color: "#C4907A", category: "Lash" },
  { id: "w2", caption: "Permanent Bracelet — Gold Chain", color: "#D4A574", category: "Jewelry" },
  { id: "w3", caption: "Custom 3D-Printed Pendant", color: "#7BA3A3", category: "Craft" },
  { id: "w4", caption: "Cat Eye Lash Transformation", color: "#C4907A", category: "Lash" },
  { id: "w5", caption: "Welded Anklet — Sterling Silver", color: "#D4A574", category: "Jewelry" },
  { id: "w6", caption: "Handmade Crochet Market Bag", color: "#7BA3A3", category: "Craft" },
];

function WorkCard({ item }: { item: WorkItem }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [loupePos, setLoupePos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setLoupePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden cursor-crosshair flex-none w-[min(72vw,300px)]"
      data-cursor="view"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
    >
      <div
        className="aspect-[3/4] w-full"
        style={{
          background: `linear-gradient(160deg, ${item.color}44 0%, ${item.color}18 60%, ${item.color}28 100%)`,
        }}
      />

      {isHovering && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${loupePos.x}%`,
            top: `${loupePos.y}%`,
            transform: "translate(-50%, -50%)",
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.3)",
            overflow: "hidden",
            boxShadow: "0 0 24px rgba(0,0,0,0.15)",
          }}
        >
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(160deg, ${item.color}88 0%, ${item.color}44 60%, ${item.color}58 100%)`,
              transform: "scale(1.5)",
            }}
          />
        </div>
      )}

      <div className="absolute inset-0 flex flex-col justify-end p-5 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out">
        <span className="text-[10px] tracking-[0.2em] uppercase text-white/60 mb-1">
          {item.category}
        </span>
        <p className="text-sm font-light text-white leading-snug">{item.caption}</p>
      </div>
    </div>
  );
}

export function EditorialPortfolio() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const strip = stripRef.current;
      if (!strip) return;

      gsap.fromTo(
        strip,
        { x: 0 },
        {
          x: () => -(strip.scrollWidth - window.innerWidth + 96),
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: () => `+=${strip.scrollWidth}`,
            scrub: 1,
            pin: stickyRef.current,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        },
      );
    },
    { scope: sectionRef },
  );

  return (
    <section ref={sectionRef} className="bg-foreground text-background" aria-label="Portfolio">
      <div ref={stickyRef} className="h-screen flex flex-col justify-center overflow-hidden">
        {/* Header */}
        <div className="px-8 md:px-16 mb-10 flex items-end justify-between">
          <div>
            <span className="text-[10px] tracking-[0.3em] uppercase text-accent mb-4 block">
              The Work
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-light tracking-tight text-background leading-[1.1]">
              The work
              <br />
              speaks first.
            </h2>
          </div>
          <Link
            href="/portfolio"
            className="text-xs tracking-[0.25em] uppercase text-accent hover:text-background transition-colors duration-300 flex items-center gap-3"
            data-cursor="link"
          >
            View Full Portfolio
            <span className="w-6 h-px bg-current" />
          </Link>
        </div>

        {/* Horizontal strip */}
        <div
          ref={stripRef}
          className="flex gap-4 pl-8 md:pl-16 pr-24 items-end"
          style={{ willChange: "transform" }}
        >
          {WORK.map((item, i) => (
            <div key={item.id} style={{ marginBottom: i % 2 === 1 ? "3rem" : "0" }}>
              <WorkCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
