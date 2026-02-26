/**
 * CustomCursor — Premium cursor with dot + trailing ring.
 *
 * The ring shape changes based on content zone:
 * - Default: circle (beauty/craft)
 * - Over [data-cursor="square"]: square (consulting/structure)
 * - Over [data-cursor="hex"]: hexagon (3D/fabrication)
 * - Over CTAs/links: ring expands
 *
 * Only renders on desktop (pointer: fine). Hidden on touch devices.
 *
 * Client Component — uses requestAnimationFrame for smooth tracking.
 */
"use client";

import { useEffect, useRef, useState } from "react";

type CursorShape = "circle" | "square" | "hex";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isHoveringLink, setIsHoveringLink] = useState(false);
  const [shape, setShape] = useState<CursorShape>("circle");
  const mousePos = useRef({ x: 0, y: 0 });
  const ringPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Only enable on devices with fine pointer (desktop)
    const hasPointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!hasPointer || prefersReducedMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };

      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }

      if (!isVisible) setIsVisible(true);

      // Detect cursor shape from data attributes
      const target = e.target as HTMLElement;
      const cursorAttr = target.closest("[data-cursor]")?.getAttribute("data-cursor");
      if (cursorAttr === "square") setShape("square");
      else if (cursorAttr === "hex") setShape("hex");
      else setShape("circle");

      // Detect links/buttons
      const isInteractive = !!(
        target.closest("a") ||
        target.closest("button") ||
        target.closest("[role='button']")
      );
      setIsHoveringLink(isInteractive);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    // Ring follows with spring-like delay
    const animate = () => {
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * 0.12;
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * 0.12;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px)`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isVisible]);

  // Shape styling
  const ringSize = isHoveringLink ? 44 : 28;
  const ringBorderRadius = shape === "circle" ? "50%" : shape === "square" ? "4px" : "50%";
  const ringClipPath =
    shape === "hex" ? "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" : undefined;

  return (
    <>
      {/* Dot — follows cursor exactly */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none z-[10000] mix-blend-difference"
        style={{
          width: 6,
          height: 6,
          marginLeft: -3,
          marginTop: -3,
          borderRadius: "50%",
          backgroundColor: "#faf6f1",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.2s",
        }}
      />

      {/* Ring — follows with delay, changes shape */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 pointer-events-none z-[10000] mix-blend-difference"
        style={{
          width: ringSize,
          height: ringSize,
          marginLeft: -ringSize / 2,
          marginTop: -ringSize / 2,
          borderRadius: ringClipPath ? undefined : ringBorderRadius,
          clipPath: ringClipPath,
          border: "1px solid rgba(250, 246, 241, 0.5)",
          opacity: isVisible ? 1 : 0,
          transition:
            "width 0.3s, height 0.3s, border-radius 0.3s, opacity 0.2s, clip-path 0.3s, margin 0.3s",
        }}
      />
    </>
  );
}
