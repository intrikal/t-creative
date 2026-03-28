"use client";

/**
 * CustomCursor — GSAP-driven magnetic cursor with state-aware ring.
 *
 * Dot  (6px)  — quickTo duration 0.08 (near-instant snap).
 * Ring (32px) — quickTo duration 0.45 power3.out, scales on hover states.
 *
 * States via data-cursor on target elements:
 *   "link"   — ring expands 1.8x
 *   "drag"   — ring shows "Drag" label
 *   "view"   — ring fills, shows "View"
 *
 * Magnetic pull: any element with data-magnetic gets elastic attraction.
 * Hides on touch/coarse-pointer devices.
 */

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    const label = labelRef.current;
    if (!dot || !ring) return;

    // Touch / coarse pointer — disable entirely
    if (!window.matchMedia("(pointer: fine)").matches) {
      dot.style.display = "none";
      ring.style.display = "none";
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.documentElement.style.cursor = "none";

    // quickTo functions — GSAP handles the rAF internally, much smoother
    const dotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "none" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "none" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3.out" });

    const onMove = (e: MouseEvent) => {
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
      if (!visibleRef.current) {
        visibleRef.current = true;
        gsap.to([dot, ring], { opacity: 1, duration: 0.3 });
      }
    };

    // State changes
    const enter = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest("[data-cursor]") as HTMLElement | null;
      if (!el) return;
      const s = el.dataset.cursor;
      if (s === "link") {
        gsap.to(ring, {
          scale: 1.9,
          borderColor: "rgba(44,36,32,0.5)",
          duration: 0.35,
          ease: "power2.out",
        });
        gsap.to(dot, { scale: 0, duration: 0.2 });
      } else if (s === "drag") {
        gsap.to(ring, { scale: 2.4, duration: 0.35, ease: "power2.out" });
        gsap.to(dot, { scale: 0, duration: 0.2 });
        if (label) {
          label.textContent = "Drag";
          gsap.to(label, { opacity: 1, duration: 0.2 });
        }
      } else if (s === "view") {
        gsap.to(ring, {
          scale: 2.8,
          backgroundColor: "rgba(44,36,32,0.06)",
          duration: 0.35,
          ease: "power2.out",
        });
        gsap.to(dot, { scale: 0, duration: 0.2 });
        if (label) {
          label.textContent = "View";
          gsap.to(label, { opacity: 1, duration: 0.2 });
        }
      }
    };

    const leave = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest("[data-cursor]") as HTMLElement | null;
      if (!el) return;
      gsap.to(ring, {
        scale: 1,
        borderColor: "rgba(44,36,32,0.3)",
        backgroundColor: "transparent",
        duration: 0.4,
        ease: "power2.out",
      });
      gsap.to(dot, { scale: 1, duration: 0.3 });
      if (label) gsap.to(label, { opacity: 0, duration: 0.15 });
    };

    const onDown = () => gsap.to([dot, ring], { scale: 0.75, duration: 0.1 });
    const onUp = () => gsap.to([dot, ring], { scale: 1, duration: 0.25, ease: "back.out(1.5)" });

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", enter);
    document.addEventListener("mouseout", leave);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);

    // Magnetic buttons
    const cleanup: (() => void)[] = [];
    document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic ?? "0.3");
      const onMag = (e: MouseEvent) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        if (d < 90)
          gsap.to(el, { x: dx * strength, y: dy * strength, duration: 0.4, ease: "power2.out" });
      };
      const offMag = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("mousemove", onMag);
      el.addEventListener("mouseleave", offMag);
      cleanup.push(() => {
        el.removeEventListener("mousemove", onMag);
        el.removeEventListener("mouseleave", offMag);
      });
    });

    return () => {
      document.documentElement.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", enter);
      document.removeEventListener("mouseout", leave);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      cleanup.forEach((f) => f());
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="fixed top-0 left-0 z-[10001] pointer-events-none"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: "#2c2420",
          transform: "translate(-50%,-50%)",
          opacity: 0,
          willChange: "transform",
        }}
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="fixed top-0 left-0 z-[10000] pointer-events-none flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "1px solid rgba(44,36,32,0.3)",
          transform: "translate(-50%,-50%)",
          opacity: 0,
          willChange: "transform",
        }}
      >
        <span
          ref={labelRef}
          className="text-[7px] tracking-widest uppercase text-foreground opacity-0 font-medium select-none"
        />
      </div>
    </>
  );
}
