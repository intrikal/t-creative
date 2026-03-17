"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";

type Props = {
  beforeSrc: string;
  afterSrc: string;
  alt: string;
};

/**
 * Interactive before/after comparison slider.
 * Drag the handle or tap anywhere to reveal the transformation.
 */
export function BeforeAfterSlider({ beforeSrc, afterSrc, alt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50); // percentage 0–100
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updatePosition(e.clientX);
    },
    [updatePosition],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    },
    [isDragging, updatePosition],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setPosition((p) => Math.max(0, p - 2));
    } else if (e.key === "ArrowRight") {
      setPosition((p) => Math.min(100, p + 2));
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] w-full select-none overflow-hidden cursor-col-resize"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-label={`Before and after comparison: ${alt}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* After image (full, behind) */}
      <Image
        src={afterSrc}
        alt={`After: ${alt}`}
        fill
        className="object-cover pointer-events-none"
        sizes="(max-width: 768px) 90vw, 560px"
        draggable={false}
      />

      {/* Before image (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <Image
          src={beforeSrc}
          alt={`Before: ${alt}`}
          fill
          className="object-cover pointer-events-none"
          sizes="(max-width: 768px) 90vw, 560px"
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-sm"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center backdrop-blur-sm">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-neutral-700">
            <path
              d="M7 4L3 10L7 16M13 4L17 10L13 16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 text-[10px] uppercase tracking-widest text-white/80 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-sm pointer-events-none">
        Before
      </span>
      <span className="absolute top-3 right-3 text-[10px] uppercase tracking-widest text-white/80 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-sm pointer-events-none">
        After
      </span>
    </div>
  );
}
