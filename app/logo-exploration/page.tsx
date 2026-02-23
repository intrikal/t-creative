"use client";

import { useState } from "react";

// ── Utilities ─────────────────────────────────────────────────────────────────

function star(cx: number, cy: number, a: number): string {
  const r = a * 0.28;
  return [
    `M${cx} ${cy - a}`,
    `L${cx + r} ${cy - r}`,
    `L${cx + a} ${cy}`,
    `L${cx + r} ${cy + r}`,
    `L${cx} ${cy + a}`,
    `L${cx - r} ${cy + r}`,
    `L${cx - a} ${cy}`,
    `L${cx - r} ${cy - r}`,
    "Z",
  ].join(" ");
}

// ── Group config ──────────────────────────────────────────────────────────────

type Group =
  | "Lash"
  | "Jewelry"
  | "Crochet"
  | "Training"
  | "Consulting"
  | "Luxury"
  | "Creative"
  | "Trini";

const groupStyles: Record<Group, { bg: string; text: string; btn: string; btnActive: string }> = {
  Lash: { bg: "#fce7f0", text: "#b0445e", btn: "#fce7f0", btnActive: "#f9a8c9" },
  Jewelry: { bg: "#fef3c7", text: "#92640c", btn: "#fef3c7", btnActive: "#fcd34d" },
  Crochet: { bg: "#d1fae5", text: "#065f46", btn: "#d1fae5", btnActive: "#6ee7b7" },
  Training: { bg: "#ffedd5", text: "#9a3412", btn: "#ffedd5", btnActive: "#fdba74" },
  Consulting: { bg: "#dbeafe", text: "#1e40af", btn: "#dbeafe", btnActive: "#93c5fd" },
  Luxury: { bg: "#ede9fe", text: "#5b21b6", btn: "#ede9fe", btnActive: "#c4b5fd" },
  Creative: { bg: "#e0f2fe", text: "#0c4a6e", btn: "#e0f2fe", btnActive: "#7dd3fc" },
  Trini: { bg: "#fde6d5", text: "#7c3a1a", btn: "#fde6d5", btnActive: "#f9b88a" },
};

// ── Marks (all 64×64 viewBox) ─────────────────────────────────────────────────

// ─ LASH ──────────────────────────────────────────────────────────────────────

function LashLineMark() {
  return (
    <>
      <path
        d="M13 22 Q10 13 8 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.38"
      />
      <path
        d="M21 20 Q18 11 17 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M32 19 L32 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M43 20 Q46 11 47 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M51 22 Q54 13 56 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.38"
      />
      <path d="M8 22 H56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d={star(55, 10, 5.5)} fill="currentColor" opacity="0.65" />
    </>
  );
}

function EyeMark() {
  return (
    <>
      <path
        d="M10 26 Q20 12 32 12 Q44 12 54 26 Q44 38 32 38 Q20 38 10 26 Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="32"
        cy="26"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.35"
      />
      <circle cx="32" cy="26" r="2.2" fill="currentColor" opacity="0.7" />
      <path
        d="M14 20 Q10 11 9 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M21 14 Q19 6 18 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M32 12 L32 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M43 14 Q45 6 46 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M50 20 Q54 11 55 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path d="M32 38 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function WandMark() {
  const xs = [13, 18, 23, 28, 33, 38, 43, 48, 53];
  return (
    <>
      {xs.map((x) => (
        <path
          key={x}
          d={`M${x} 22 L${x} 11`}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.4"
        />
      ))}
      <path d="M10 22 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M28 38 H36"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M28 45 H36"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.3"
      />
    </>
  );
}

function VolumeFanMark() {
  const lashes = Array.from({ length: 13 }, (_, i) => {
    const angle = -84 + i * 14;
    const rad = (angle * Math.PI) / 180;
    const dist = Math.abs(i - 6);
    const len = dist === 0 ? 26 : dist <= 2 ? 22 : dist <= 4 ? 17 : 12;
    const opacity = dist === 0 ? 0.9 : dist <= 2 ? 0.7 : dist <= 4 ? 0.5 : 0.3;
    return {
      x2: (32 + len * Math.sin(rad)).toFixed(1),
      y2: (30 - len * Math.cos(rad)).toFixed(1),
      cx: (32 + (len / 2) * Math.sin(rad) + (i % 2 === 0 ? -1 : 1)).toFixed(1),
      cy: (30 - (len / 2) * Math.cos(rad) - 2).toFixed(1),
      opacity,
    };
  });
  return (
    <>
      {lashes.map(({ x2, y2, cx, cy, opacity }, i) => (
        <path
          key={i}
          d={`M32 30 Q${cx} ${cy} ${x2} ${y2}`}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity={opacity}
        />
      ))}
      <path d="M10 30 H54" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 30 V56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function MirrorMark() {
  return (
    <>
      <ellipse
        cx="32"
        cy="22"
        rx="18"
        ry="14"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
      />
      <ellipse
        cx="32"
        cy="22"
        rx="13"
        ry="9.5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.28"
      />
      <path d={star(32, 22, 4.5)} fill="currentColor" opacity="0.5" />
      <path d="M32 36 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M26 53 Q32 60 38 53"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function StripLashMark() {
  const lashes = [
    { x: 15, dx: -2.8, len: 14, op: 0.45 },
    { x: 21, dx: -1.8, len: 18, op: 0.65 },
    { x: 27, dx: -0.7, len: 21, op: 0.82 },
    { x: 32, dx: 0, len: 23, op: 1.0 },
    { x: 37, dx: 0.7, len: 21, op: 0.82 },
    { x: 43, dx: 1.8, len: 18, op: 0.65 },
    { x: 49, dx: 2.8, len: 14, op: 0.45 },
  ];
  return (
    <>
      <rect x="11" y="29" width="42" height="4.5" rx="2.2" fill="currentColor" opacity="0.14" />
      <path d="M11 31 H53" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {lashes.map(({ x, dx, len, op }) => (
        <path
          key={x}
          d={`M${x} 31 Q${x + dx * 0.5} ${31 - len * 0.55} ${x + dx} ${31 - len}`}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity={op}
        />
      ))}
      <path d="M32 33.5 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function TweezersLashMark() {
  return (
    <>
      <path d="M12 24 H52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 24 V56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M32 24 L24 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M32 24 L40 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M24 6 Q32 11 40 6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M21 4 Q24 7 24 6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M43 4 Q40 7 40 6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function SweepLashMark() {
  return (
    <>
      <path d="M12 26 H52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 26 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M12 26 Q22 4 48 4 Q58 4 58 14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M18 26 Q26 10 46 8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.28"
      />
      <path
        d="M24 26 Q30 16 44 12"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
        opacity="0.18"
      />
    </>
  );
}

function FeatherLashMark() {
  return (
    <>
      <path d="M14 22 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M32 4 Q44 8 46 16 Q48 22 44 24 Q38 26 32 22 Q26 26 20 24 Q16 22 18 16 Q20 8 32 4 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M32 22 L32 4"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.38"
      />
      {[-7, -3.5, 0, 3.5, 7].map((dy) => (
        <path
          key={dy}
          d={`M32 ${15 + dy} L${32 + 9 - Math.abs(dy) * 0.5} ${13 + dy}`}
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.28"
        />
      ))}
      {[-7, -3.5, 0, 3.5, 7].map((dy) => (
        <path
          key={`l${dy}`}
          d={`M32 ${15 + dy} L${32 - 9 + Math.abs(dy) * 0.5} ${13 + dy}`}
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.28"
        />
      ))}
    </>
  );
}

function LashCombMark() {
  const bristles = [15, 20, 25, 30, 35, 40, 45, 50];
  return (
    <>
      <path d="M10 24 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 24 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect
        x="11"
        y="21"
        width="42"
        height="7"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.55"
      />
      {bristles.map((x) => (
        <path
          key={x}
          d={`M${x} 21 L${x} 12`}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.5"
        />
      ))}
    </>
  );
}

// ─ JEWELRY ───────────────────────────────────────────────────────────────────

function GemPendantMark() {
  return (
    <>
      <path d="M10 18 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 18 V42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M32 42 L32 46"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 46 L40 53 L32 60 L24 53 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M24 53 L40 53" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <path d="M32 46 L32 53" stroke="currentColor" strokeWidth="1" opacity="0.35" />
    </>
  );
}

function LinkedMark() {
  return (
    <>
      {[11, 21, 31, 41, 51].map((cx) => (
        <ellipse
          key={cx}
          cx={cx}
          cy={22}
          rx={6}
          ry={3.5}
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
        />
      ))}
      {[31, 43, 55].map((cy) => (
        <ellipse
          key={cy}
          cx={32}
          cy={cy}
          rx={3.5}
          ry={6}
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
        />
      ))}
    </>
  );
}

function BrioletteMark() {
  return (
    <>
      <path d="M12 16 H52" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 16 V34" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse
        cx="32"
        cy="37"
        rx="3"
        ry="1.8"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M32 39 C20 43 18 53 25 59 Q32 64 39 59 C46 53 44 43 32 39 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M32 39 L24 56" stroke="currentColor" strokeWidth="0.8" opacity="0.28" />
      <path d="M32 39 L40 56" stroke="currentColor" strokeWidth="0.8" opacity="0.28" />
      <path d="M22 55 L42 55" stroke="currentColor" strokeWidth="0.8" opacity="0.28" />
    </>
  );
}

function ConstellationMark() {
  // Updated: circles instead of stars so it reads as pearls/gems, not occult
  return (
    <>
      <path
        d="M10 26 H54"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.15"
      />
      <path
        d="M32 26 V58"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.15"
      />
      <circle cx="32" cy="26" r="5.5" fill="currentColor" opacity="1" />
      <circle cx="14" cy="26" r="3.5" fill="currentColor" opacity="0.8" />
      <circle cx="50" cy="26" r="3.5" fill="currentColor" opacity="0.8" />
      <circle cx="32" cy="42" r="3.5" fill="currentColor" opacity="0.75" />
      <circle cx="32" cy="56" r="2.5" fill="currentColor" opacity="0.55" />
      <circle cx="23" cy="26" r="1.8" fill="currentColor" opacity="0.42" />
      <circle cx="41" cy="26" r="1.8" fill="currentColor" opacity="0.42" />
      <circle cx="32" cy="34" r="1.8" fill="currentColor" opacity="0.42" />
      <circle cx="32" cy="50" r="1.8" fill="currentColor" opacity="0.36" />
      <circle cx="18" cy="13" r="2" fill="currentColor" opacity="0.36" />
      <circle cx="46" cy="13" r="2" fill="currentColor" opacity="0.36" />
      <circle cx="8" cy="40" r="1.4" fill="currentColor" opacity="0.22" />
      <circle cx="56" cy="40" r="1.4" fill="currentColor" opacity="0.22" />
    </>
  );
}

function RadiantMark() {
  const spokes = Array.from({ length: 12 }, (_, i) => i * 30);
  const cx = 32,
    cy = 24;
  return (
    <>
      {spokes.map((deg) => {
        const r = (deg * Math.PI) / 180;
        const isCardinal = deg % 90 === 0;
        const len = isCardinal ? 20 : 13;
        return (
          <path
            key={deg}
            d={`M${(cx + 9 * Math.cos(r)).toFixed(1)} ${(cy + 9 * Math.sin(r)).toFixed(1)} L${(cx + len * Math.cos(r)).toFixed(1)} ${(cy + len * Math.sin(r)).toFixed(1)}`}
            stroke="currentColor"
            strokeWidth={isCardinal ? "1.6" : "1"}
            strokeLinecap="round"
            opacity={isCardinal ? 0.6 : 0.28}
          />
        );
      })}
      <path d="M10 24 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 24 V56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3" fill="currentColor" opacity="0.9" />
    </>
  );
}

function PearledMark() {
  return (
    <>
      <path
        d="M8 22 H56"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.35"
      />
      {[12, 21, 32, 43, 52].map((x) => (
        <circle
          key={x}
          cx={x}
          cy={22}
          r={x === 32 ? 5 : 3.8}
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      ))}
      <path d={star(32, 22, 2.8)} fill="currentColor" opacity="0.5" />
      <path d="M32 27 V56" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="44" r="3.8" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </>
  );
}

function DoubleGemMark() {
  function drop(x: number, y0: number, size: number, op: number) {
    const h = size * 1.4;
    return (
      <>
        <path
          d={`M${x} ${y0} L${x} ${y0 + 4}`}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity={op * 0.6}
        />
        <path
          d={`M${x} ${y0 + 4} L${x + size} ${y0 + 4 + h * 0.55} L${x} ${y0 + 4 + h} L${x - size} ${y0 + 4 + h * 0.55} Z`}
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinejoin="round"
          opacity={op}
        />
        <path
          d={`M${x - size} ${y0 + 4 + h * 0.55} L${x + size} ${y0 + 4 + h * 0.55}`}
          stroke="currentColor"
          strokeWidth="0.8"
          opacity={op * 0.4}
        />
      </>
    );
  }
  return (
    <>
      <path d="M14 20 H50" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 10 V20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {drop(14, 20, 5, 0.55)}
      {drop(32, 20, 7, 0.9)}
      {drop(50, 20, 5, 0.55)}
    </>
  );
}

function RopeMark() {
  return (
    <>
      <path
        d="M8 19 Q16 16 24 21 Q32 26 40 21 Q48 16 56 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 25 Q16 28 24 23 Q32 18 40 23 Q48 28 56 25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M32 24 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle
        cx="9"
        cy="22"
        r="3"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="55"
        cy="22"
        r="3"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
    </>
  );
}

function BangleMark() {
  return (
    <>
      <circle cx="32" cy="24" r="19" stroke="currentColor" strokeWidth="3" fill="none" />
      <path d="M32 5 L32 43" stroke="currentColor" strokeWidth="0" />
      <path d="M32 43 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M27 6 Q32 4 37 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </>
  );
}

function WeldedRingsMark() {
  return (
    <>
      <circle cx="22" cy="22" r="13" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="42" cy="22" r="13" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="32" cy="22" r="2.8" fill="currentColor" opacity="0.85" />
      <path d="M32 24.8 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function EarringMark() {
  return (
    <>
      <path d="M14 18 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 18 V22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle
        cx="32"
        cy="15"
        r="3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M32 22 L32 28"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M25 28 L32 58 L39 28 Z"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M25 28 H39" stroke="currentColor" strokeWidth="0.9" opacity="0.35" />
      <path d="M26 36 L38 36" stroke="currentColor" strokeWidth="0.7" opacity="0.22" />
    </>
  );
}

function InfinityChainMark() {
  return (
    <>
      <path
        d="M32 22 Q22 11 14 13 Q6 15 6 22 Q6 29 14 31 Q22 33 32 22 Q42 11 50 13 Q58 15 58 22 Q58 29 50 31 Q42 33 32 22"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="6" cy="22" r="2.2" fill="currentColor" opacity="0.4" />
      <circle cx="58" cy="22" r="2.2" fill="currentColor" opacity="0.4" />
      <circle cx="32" cy="22" r="2.2" fill="currentColor" opacity="0.55" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function CollarNecklaceMark() {
  return (
    <>
      <path
        d="M8 10 Q8 5 14 5 H50 Q56 5 56 10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M8 10 Q8 38 32 44 Q56 38 56 10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 44 L32 48"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M27 48 L32 58 L37 48 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M27 48 H37" stroke="currentColor" strokeWidth="0.9" opacity="0.35" />
      {[0.25, 0.5, 0.75].map((t) => {
        const angle = Math.PI * t;
        const px = (32 - 24 * Math.cos(angle)).toFixed(1);
        const py = (10 + 34 * Math.sin(angle) * 0.9).toFixed(1);
        return <circle key={t} cx={px} cy={py} r="1.6" fill="currentColor" opacity="0.38" />;
      })}
    </>
  );
}

// ─ CROCHET ───────────────────────────────────────────────────────────────────

function HookMark() {
  return (
    <>
      <path d="M10 20 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M32 20 V50 Q32 62 20 62 Q11 62 11 53 Q11 46 18 46"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M52 14 Q58 8 54 4 Q50 0 46 4 Q44 8 48 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
    </>
  );
}

function TasselMark() {
  const xs = [16, 21, 26, 31, 36, 41, 46];
  return (
    <>
      <path d="M12 16 H52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 6 V16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M14 23 H50"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.6"
      />
      {xs.map((x, i) => (
        <path
          key={x}
          d={`M${x} 23 Q${x + (i % 2 === 0 ? -2 : 2)} ${42} ${x + (i % 3 === 0 ? -1 : i % 3 === 1 ? 0 : 1)} ${59}`}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
          opacity="0.45"
        />
      ))}
    </>
  );
}

function KnottedMark() {
  return (
    <>
      <path d="M8 24 H26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 6 V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M26 24 Q24 32 32 32 Q40 32 38 24 Q36 16 32 16 Q28 16 26 24"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.65"
      />
      <path d="M38 24 H56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 32 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function WeaveMark() {
  return (
    <>
      <path
        d="M8 18 Q20 16 32 20 Q44 24 56 22"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M8 26 Q20 24 32 28 Q44 32 56 30"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M8 18 Q20 16 32 20 Q44 24 56 22 L56 30 Q44 32 32 28 Q20 24 8 26 Z"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M29 22 Q28 36 30 58"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M35 22 Q36 36 34 58"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path d="M29 22 Q28 36 30 58 L34 58 Q36 36 35 22 Z" fill="currentColor" fillOpacity="0.12" />
      <circle cx="32" cy="24" r="2.5" fill="currentColor" opacity="0.7" />
      {[12, 22, 42, 52].map((x) => (
        <circle
          key={x}
          cx={x}
          cy={22 + (x > 32 ? 2 : 0)}
          r="1.5"
          fill="currentColor"
          opacity="0.35"
        />
      ))}
    </>
  );
}

function YarnMark() {
  return (
    <>
      <circle cx="32" cy="28" r="20" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M14 20 Q24 14 32 28 Q40 42 50 36"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M12 32 Q20 22 32 28 Q44 34 52 24"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M18 14 Q28 22 32 28 Q36 34 42 44"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M50 20 Q56 14 54 8 Q52 4 48 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path d="M32 48 V60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function DoubleLoopMark() {
  return (
    <>
      <path
        d="M8 22 Q2 16 8 10 Q14 4 20 10 Q26 16 20 22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M56 22 Q62 16 56 10 Q50 4 44 10 Q38 16 44 22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path d="M20 22 H44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function NeedleMark() {
  return (
    <>
      <path d="M10 20 H54" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 20 V54" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M29 54 L32 62 L35 54"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
        opacity="0.65"
      />
      <rect
        x="43.5"
        y="17.5"
        width="7"
        height="5"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M56 12 Q62 8 60 18 Q58 26 47 20 Q38 14 42 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function VStitchMark() {
  return (
    <>
      <path d="M10 20 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 20 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3].map((col) => {
          const x = 9 + col * 13 + (row % 2 === 1 ? 6.5 : 0);
          const y = 24 + row * 10;
          if (x > 52) return null;
          return (
            <path
              key={`${row}-${col}`}
              d={`M${x} ${y + 8} L${x + 6.5} ${y} L${x + 13} ${y + 8}`}
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity="0.55"
            />
          );
        }),
      )}
    </>
  );
}

function CrochetFlowerMark() {
  const petals = 6;
  return (
    <>
      <path d="M14 22 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {Array.from({ length: petals }, (_, i) => {
        const angle = (i / petals) * 2 * Math.PI - Math.PI / 2;
        const px = 32 + 11 * Math.cos(angle);
        const py = 22 + 11 * Math.sin(angle);
        const rot = (i / petals) * 360;
        return (
          <ellipse
            key={i}
            cx={px.toFixed(1)}
            cy={py.toFixed(1)}
            rx="4.5"
            ry="7"
            transform={`rotate(${rot}, ${px.toFixed(1)}, ${py.toFixed(1)})`}
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            opacity="0.55"
          />
        );
      })}
      <circle cx="32" cy="22" r="3" fill="currentColor" opacity="0.75" />
    </>
  );
}

function PomPomMark() {
  return (
    <>
      <path d="M14 22 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M19 14 Q14 8 20 6 Q26 4 28 10 Q30 4 34 4 Q38 4 40 10 Q44 4 50 6 Q56 8 49 14 Q56 16 56 22 Q56 30 50 32 Q56 38 50 42 Q44 44 40 38 Q38 44 34 44 Q30 44 28 38 Q24 44 20 42 Q14 38 18 32 Q12 30 12 22 Q12 16 19 14 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.62"
      />
      <circle
        cx="32"
        cy="24"
        r="5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.28"
      />
      <path
        d="M32 43 L32 46"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
    </>
  );
}

function GrannySquareMark() {
  return (
    <>
      <path d="M10 20 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 20 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect
        x="16"
        y="22"
        width="32"
        height="28"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <path d="M16 36 H48" stroke="currentColor" strokeWidth="0.9" opacity="0.28" />
      <path d="M32 22 V50" stroke="currentColor" strokeWidth="0.9" opacity="0.28" />
      {(
        [
          [16, 22],
          [48, 22],
          [48, 50],
          [16, 50],
        ] as [number, number][]
      ).map(([x, y]) => (
        <circle
          key={`${x}${y}`}
          cx={x}
          cy={y}
          r="3"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          opacity="0.42"
        />
      ))}
      <circle
        cx="32"
        cy="36"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.55"
      />
      <circle cx="32" cy="36" r="1.6" fill="currentColor" opacity="0.5" />
    </>
  );
}

// ─ TRAINING ──────────────────────────────────────────────────────────────────

function MortarboardMark() {
  return (
    <>
      <path
        d="M32 8 L54 22 L32 36 L10 22 Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M32 8 L32 36"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.2"
      />
      <path
        d="M10 22 L54 22"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.2"
      />
      <path
        d="M54 22 Q60 22 62 30 L58 44"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <circle cx="58" cy="45" r="2.5" fill="currentColor" opacity="0.45" />
      <path d="M32 36 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function OpenBookMark() {
  return (
    <>
      <path
        d="M6 14 Q6 8 12 8 L32 14 L32 56 L12 50 Q6 48 6 42 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M58 14 Q58 8 52 8 L32 14 L32 56 L52 50 Q58 48 58 42 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M32 14 V56"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path d="M11 24 L28 24" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M11 30 L28 30" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M11 36 L28 36" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M36 24 L53 24" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M36 30 L53 30" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M36 36 L53 36" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d={star(32, 36, 3.5)} fill="currentColor" opacity="0.55" />
    </>
  );
}

function PencilMark() {
  return (
    <>
      <path d="M12 20 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="6" y="17" width="6" height="6" rx="1.2" fill="currentColor" opacity="0.4" />
      <path d="M12 17 L12 23" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <path d="M50 17 L58 20 L50 23 Z" fill="currentColor" opacity="0.6" />
      <path d="M32 20 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function ScrollMark() {
  return (
    <>
      <rect
        x="8"
        y="16"
        width="48"
        height="34"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <ellipse cx="32" cy="16" rx="24" ry="4" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <ellipse cx="32" cy="50" rx="24" ry="4" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M16 26 H48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 26 V40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="46" r="2.5" fill="currentColor" opacity="0.4" />
    </>
  );
}

function AwardMark() {
  return (
    <>
      <path
        d="M22 42 L18 58 L32 50 L46 58 L42 42"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
        opacity="0.45"
      />
      <circle cx="32" cy="26" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle
        cx="32"
        cy="26"
        r="15"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.3"
      />
      <path d="M18 22 H46" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 22 V36" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d={star(32, 14, 3.5)} fill="currentColor" opacity="0.75" />
    </>
  );
}

function ClipboardMark() {
  return (
    <>
      <path d="M14 22 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect
        x="16"
        y="22"
        width="32"
        height="36"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M26 22 Q26 15 32 15 Q38 15 38 22"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M22 33 L26 37 L34 29"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M22 42 H44"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M22 48 H40"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.3"
      />
    </>
  );
}

function MedalRibbonMark() {
  return (
    <>
      <path d="M14 20 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 20 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M26 20 L26 10 L32 14 L38 10 L38 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
      <circle cx="32" cy="34" r="14" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle
        cx="32"
        cy="34"
        r="9"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.32"
      />
      <path
        d="M25 30 H39"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M32 30 V40"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.65"
      />
    </>
  );
}

function ChalkboardMark() {
  return (
    <>
      <path d="M10 24 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 24 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect
        x="12"
        y="4"
        width="40"
        height="28"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M20 14 H44"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M32 14 V28"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M12 32 H52"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.3"
      />
      <rect x="14" y="32" width="8" height="3" rx="1" fill="currentColor" opacity="0.2" />
    </>
  );
}

// ─ CONSULTING ────────────────────────────────────────────────────────────────

function CompassMark() {
  return (
    <>
      <circle cx="32" cy="28" r="24" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M32 4  L32 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M32 46 L32 52"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M8  28 L14 28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M50 28 L56 28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path d="M32 28 L36 40 L32 50 L28 40 Z" fill="currentColor" opacity="0.22" />
      <path d="M32 28 L36 16 L32 4 L28 16 Z" fill="currentColor" opacity="0.9" />
      <circle cx="32" cy="28" r="2.5" fill="currentColor" />
    </>
  );
}

function TargetMark() {
  return (
    <>
      <circle cx="32" cy="28" r="22" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle
        cx="32"
        cy="28"
        r="14"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="32"
        cy="28"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.3"
      />
      <circle cx="32" cy="28" r="2.5" fill="currentColor" opacity="0.9" />
      <path d="M6  28 H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 28 H58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 50 V60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function ChartMark() {
  return (
    <>
      <path
        d="M6 44 H58"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <rect x="10" y="36" width="8" height="8" rx="1" fill="currentColor" opacity="0.25" />
      <rect x="22" y="26" width="8" height="18" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="34" y="14" width="8" height="30" rx="1" fill="currentColor" opacity="0.65" />
      <rect x="46" y="6" width="8" height="38" rx="1" fill="currentColor" opacity="0.85" />
      <path d="M32 44 V60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d={star(50, 4, 3)} fill="currentColor" opacity="0.75" />
    </>
  );
}

function SpeechMark() {
  return (
    <>
      <path
        d="M8 8 Q8 4 12 4 H52 Q56 4 56 8 V34 Q56 38 52 38 H38 L32 46 L26 38 H12 Q8 38 8 34 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M16 18 H48" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 18 V30" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function LightbulbMark() {
  return (
    <>
      <path
        d="M18 32 Q18 12 32 12 Q46 12 46 32 Q46 42 39 46 L25 46 Q18 42 18 32 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M25 46 H39" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
      <path d="M26 50 H38" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
      <path
        d="M29 54 L32 60 L35 54"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M22 32 H42"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M32 32 V46"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle
        cx="32"
        cy="24"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
    </>
  );
}

function RoadmapMark() {
  return (
    <>
      <path d="M10 22 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M12 42 Q20 42 24 32 Q28 22 36 17 Q44 12 52 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="1.5 3.5"
        opacity="0.5"
      />
      <circle
        cx="12"
        cy="42"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="32"
        cy="24"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.75"
      />
      <circle cx="52" cy="10" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="52" cy="10" r="1.8" fill="currentColor" opacity="0.8" />
    </>
  );
}

function PresentationMark() {
  return (
    <>
      <path d="M12 24 H52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 24 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M32 24 L18 46"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M32 24 L46 46"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.4"
      />
      <rect
        x="18"
        y="6"
        width="28"
        height="22"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.7"
      />
      <rect x="22" y="20" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="27" y="16" width="3" height="9" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="32" y="11" width="3" height="14" rx="0.5" fill="currentColor" opacity="0.7" />
      <rect x="37" y="13" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.55" />
    </>
  );
}

function KeyMark() {
  return (
    <>
      <path d="M10 22 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="14" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle
        cx="20"
        cy="14"
        r="5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.35"
      />
      <path d="M30 14 H54" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M44 14 L44 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M50 14 L50 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </>
  );
}

function NodeNetworkMark() {
  const edges: [number, number, number, number][] = [
    [32, 8, 12, 26],
    [32, 8, 52, 26],
    [12, 26, 22, 44],
    [52, 26, 42, 44],
    [12, 26, 52, 26],
  ];
  const nodes = [
    { cx: 32, cy: 8, r: 4, op: 1 },
    { cx: 12, cy: 26, r: 3, op: 0.75 },
    { cx: 52, cy: 26, r: 3, op: 0.75 },
    { cx: 22, cy: 44, r: 2.5, op: 0.6 },
    { cx: 42, cy: 44, r: 2.5, op: 0.6 },
  ];
  return (
    <>
      <path d="M10 56 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 56 V62" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {edges.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.3"
        />
      ))}
      {nodes.map(({ cx, cy, r, op }) => (
        <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" opacity={op} />
      ))}
    </>
  );
}

// ─ LUXURY ────────────────────────────────────────────────────────────────────

function CrownMark() {
  return (
    <>
      <path
        d="M16 26 L20 14 L26 26"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M28 26 L32 10 L36 26"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M38 26 L44 14 L48 26"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M8 26 H56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 26 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="14" r="2" fill="currentColor" opacity="0.65" />
      <circle cx="32" cy="10" r="2.5" fill="currentColor" opacity="0.9" />
      <circle cx="44" cy="14" r="2" fill="currentColor" opacity="0.65" />
    </>
  );
}

function SealMark() {
  // Clean stamp seal — double ring, T embossed
  return (
    <>
      <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <circle
        cx="32"
        cy="32"
        r="21"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.38"
      />
      <path d="M18 28 H46" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M32 28 V46" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </>
  );
}

function MonogramMark() {
  return (
    <>
      <path d="M6 16 H40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M23 16 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M50 14 Q30 14 30 36 Q30 58 50 58"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d={star(23, 36, 4)} fill="currentColor" opacity="0.65" />
    </>
  );
}

function ArchMark() {
  return (
    <>
      <path
        d="M8 62 L8 28 Q8 6 32 6 Q56 6 56 28 L56 62"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 62 H56"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path d="M18 36 H46" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 36 V54" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d={star(32, 20, 4)} fill="currentColor" opacity="0.7" />
    </>
  );
}

function BowMark() {
  return (
    <>
      <path d="M14 22 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M32 10 Q24 2 16 8 Q10 14 18 16 Q24 18 32 10"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M32 10 Q40 2 48 8 Q54 14 46 16 Q40 18 32 10"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.7"
      />
      <circle cx="32" cy="10" r="3" fill="currentColor" opacity="0.65" />
    </>
  );
}

function CameoMark() {
  return (
    <>
      <path d="M14 22 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="32" cy="22" rx="20" ry="16" stroke="currentColor" strokeWidth="2" fill="none" />
      <ellipse
        cx="32"
        cy="22"
        rx="16"
        ry="12"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M32 12 Q28 12 27 15 Q26 18 28 20 Q29.5 22.5 31 24"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
    </>
  );
}

function LaceMark() {
  return (
    <>
      <path d="M10 22 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {[10, 18, 26, 34, 42, 50].map((x) => (
        <path
          key={`s1${x}`}
          d={`M${x} 22 Q${x + 4} 14 ${x + 8} 22`}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      ))}
      {[14, 22, 30, 38, 46].map((x) => (
        <circle
          key={`d${x}`}
          cx={x}
          cy="26"
          r="1.5"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          opacity="0.38"
        />
      ))}
      {[10, 18, 26, 34, 42, 50].map((x) => (
        <path
          key={`s2${x}`}
          d={`M${x} 32 Q${x + 4} 24 ${x + 8} 32`}
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity="0.28"
        />
      ))}
    </>
  );
}

function RibbonBadgeMark() {
  return (
    <>
      <path d="M14 22 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 22 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="18" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
      <path
        d="M22 30 L18 46 L24 43 L32 48 L40 43 L46 46 L42 30"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M25 14 H39"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M32 14 V26"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </>
  );
}

// ─ CREATIVE ──────────────────────────────────────────────────────────────────

function BloomMark() {
  return (
    <>
      <path d="M10 28 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 28 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 28 C3 22 3 13 10 11 C17 9 17 21 10 28 Z" fill="currentColor" opacity="0.28" />
      <path d="M54 28 C61 22 61 13 54 11 C47 9 47 21 54 28 Z" fill="currentColor" opacity="0.28" />
      <path d="M32 44 C23 40 19 33 24 29 C29 25 32 36 32 44 Z" fill="currentColor" opacity="0.22" />
      <path d="M32 44 C41 40 45 33 40 29 C35 25 32 36 32 44 Z" fill="currentColor" opacity="0.22" />
      <circle cx="32" cy="58" r="2.5" fill="currentColor" opacity="0.4" />
    </>
  );
}

function ScriptMark() {
  return (
    <>
      <path
        d="M6 18 Q14 10 22 16 Q28 20 32 18 Q38 16 46 16 Q54 16 60 21"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 18 Q30 34 32 48 Q33 55 30 61"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M30 61 Q26 64 22 60"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </>
  );
}

function PaletteMark() {
  return (
    <>
      <path d="M12 24 H52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 24 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M14 16 Q8 18 8 24 Q8 32 16 34 Q24 36 30 32 Q32 30 34 32 Q42 40 48 34 Q56 26 52 18 Q48 10 40 10 Q32 10 28 12 Q20 12 14 16 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.62"
      />
      <circle
        cx="30"
        cy="32"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.42"
      />
      <circle cx="22" cy="20" r="2.8" fill="currentColor" opacity="0.55" />
      <circle cx="32" cy="14" r="2.8" fill="currentColor" opacity="0.42" />
      <circle cx="42" cy="16" r="2.8" fill="currentColor" opacity="0.55" />
      <circle cx="46" cy="26" r="2.8" fill="currentColor" opacity="0.42" />
    </>
  );
}

function BrushMark() {
  return (
    <>
      <path d="M10 24 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 24 V57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M14 6 L50 36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
      <rect
        x="41"
        y="28.5"
        width="5"
        height="10"
        transform="rotate(36, 43.5, 33.5)"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="currentColor"
        fillOpacity="0.25"
        rx="0.5"
        opacity="0.6"
      />
      <path
        d="M50 36 Q55 40 52 44 Q48 48 44 44 L50 36"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
        opacity="0.65"
      />
    </>
  );
}

function FloralMark() {
  return (
    <>
      <path d="M10 26 H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 26 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M10 26 Q4 18 12 12 Q18 8 22 16 Q24 22 18 26"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M54 26 Q60 18 52 12 Q46 8 42 16 Q40 22 46 26"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M30 26 Q32 16 34 26"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.42"
      />
      <path
        d="M32 38 Q22 36 20 44"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.38"
      />
      <path
        d="M32 38 Q42 36 44 44"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.38"
      />
      <circle cx="32" cy="26" r="2.5" fill="currentColor" opacity="0.6" />
    </>
  );
}

function ButterflyMark() {
  return (
    <>
      <path d="M14 28 H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 28 V58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M32 22 Q20 4 10 8 Q4 12 8 20 Q12 28 22 28 Q28 26 32 22"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M32 22 Q44 4 54 8 Q60 12 56 20 Q52 28 42 28 Q36 26 32 22"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M32 28 Q22 30 18 38 Q22 42 28 38 Q32 34 32 28"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.42"
      />
      <path
        d="M32 28 Q42 30 46 38 Q42 42 36 38 Q32 34 32 28"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.42"
      />
      <circle cx="32" cy="20" r="2.5" fill="currentColor" opacity="0.55" />
      <path
        d="M32 18 Q28 12 26 8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.38"
      />
      <path
        d="M32 18 Q36 12 38 8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.38"
      />
    </>
  );
}

// ─ WARM / REWORKED MARKS ─────────────────────────────────────────────────────
// These avoid the tall cross/tombstone silhouette and occult eye shapes.
// The T is embedded inside warmer containers (circles, hearts, arcs).

// — LASH (warm) —

function LashHeartMark() {
  // Two lash fans curve inward to form a heart shape at top
  return (
    <>
      <path
        d="M32 18 Q22 4 12 14 Q6 22 16 28 L32 42 L48 28 Q58 22 52 14 Q42 4 32 18 Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M20 16 Q18 10 22 8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M26 14 Q25 9 28 7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M44 16 Q46 10 42 8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M38 14 Q39 9 36 7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M32 18 L32 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path d="M24 48 H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 42 V56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LashCurlMark() {
  // Soft curved lashes inside a circle — like a beauty badge
  return (
    <>
      <circle cx="32" cy="28" r="24" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M18 30 H46" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M22 30 Q20 22 22 16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M28 30 Q27 20 29 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M32 30 L32 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M36 30 Q37 20 35 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M42 30 Q44 22 42 16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path d="M32 30 V48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LashWispMark() {
  // Flowing wisps of lashes in a wave — soft and airy
  return (
    <>
      <path
        d="M8 32 Q16 26 24 30 Q32 34 40 28 Q48 22 56 28"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 30 Q14 22 16 14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M24 30 Q23 20 25 12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M32 32 L32 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M40 28 Q41 18 39 10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M48 24 Q50 16 48 10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path d="M32 34 V56" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function LashBrushStrokeMark() {
  // Lashes as a brush stroke — artsy, beauty-forward
  return (
    <>
      <path
        d="M10 28 Q18 20 32 20 Q46 20 54 28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 26 Q12 16 16 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M22 22 Q20 14 23 8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M32 20 L32 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M42 22 Q44 14 41 8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M50 26 Q52 16 48 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path d="M32 28 V58" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="28" r="2.5" fill="currentColor" opacity="0.55" />
    </>
  );
}

// — JEWELRY (warm) —

function StackedRingsMark() {
  // Three stacked rings — clean permanent jewelry reference
  return (
    <>
      <ellipse
        cx="32"
        cy="16"
        rx="18"
        ry="6"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.5"
      />
      <ellipse
        cx="32"
        cy="26"
        rx="22"
        ry="7"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        opacity="0.75"
      />
      <ellipse
        cx="32"
        cy="36"
        rx="18"
        ry="6"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.5"
      />
      <circle cx="32" cy="26" r="2" fill="currentColor" opacity="0.6" />
      <path d="M32 43 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function CharmBraceletMark() {
  // An arc bracelet with three small hanging charms
  return (
    <>
      <path
        d="M10 22 Q10 8 32 8 Q54 8 54 22"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 14 V20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle
        cx="20"
        cy="23"
        r="3"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M32 10 V16"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M29 16 L32 24 L35 16 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <path
        d="M44 14 V20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle
        cx="44"
        cy="23"
        r="3"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.5"
      />
      <path d="M14 28 H50" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 28 V56" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function HoopEarringMark() {
  // Hoop earring with small bead accents — clean and modern
  return (
    <>
      <circle cx="32" cy="30" r="22" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <circle
        cx="32"
        cy="8"
        r="3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <circle cx="14" cy="42" r="2.5" fill="currentColor" opacity="0.4" />
      <circle cx="50" cy="42" r="2.5" fill="currentColor" opacity="0.4" />
      <circle cx="32" cy="52" r="2.5" fill="currentColor" opacity="0.55" />
      <path
        d="M20 30 H44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M32 30 V44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </>
  );
}

function HeartPendantMark() {
  // Heart pendant on a chain — universally warm
  return (
    <>
      <path
        d="M14 10 Q14 6 20 6 H44 Q50 6 50 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M14 10 Q22 10 28 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M50 10 Q42 10 36 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M32 24 Q24 12 18 18 Q14 24 22 30 L32 40 L42 30 Q50 24 46 18 Q40 12 32 24 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M24 48 H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 40 V56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// — CROCHET (warm) —

function CozyHeartMark() {
  // Heart made of yarn/chain stitches
  return (
    <>
      <path
        d="M32 22 Q22 6 14 14 Q8 22 18 30 L32 46 L46 30 Q56 22 50 14 Q42 6 32 22 Z"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
        strokeDasharray="3 2.5"
      />
      <circle cx="32" cy="32" r="2.5" fill="currentColor" opacity="0.5" />
      <path d="M24 52 H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 46 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function YarnBowMark() {
  // A cute yarn bow — soft, handmade feel
  return (
    <>
      <path
        d="M32 24 Q20 14 14 18 Q8 22 14 28 Q20 34 32 24"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M32 24 Q44 14 50 18 Q56 22 50 28 Q44 34 32 24"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.7"
      />
      <circle cx="32" cy="24" r="3.5" fill="currentColor" opacity="0.6" />
      <path
        d="M28 24 Q26 34 24 44"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M36 24 Q38 34 40 44"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path d="M14 24 H50" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 24 V58" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function BlanketFoldMark() {
  // A folded blanket/scarf — cozy and warm
  return (
    <>
      <path
        d="M12 14 H52 Q54 14 54 16 V38 Q54 40 52 40 H12 Q10 40 10 38 V16 Q10 14 12 14 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M10 26 H54" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path
        d="M14 18 Q22 22 32 18 Q42 14 50 18"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M14 30 Q22 34 32 30 Q42 26 50 30"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      <path d="M20 26 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 26 V40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 40 V58" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function CrochetHeartHookMark() {
  // Hook forming a heart shape — craft meets love
  return (
    <>
      <path
        d="M32 20 Q24 8 18 14 Q12 20 20 28 L32 40 L44 28 Q52 20 46 14 Q40 8 32 20"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M32 40 V50 Q32 58 24 58 Q18 58 18 52 Q18 47 22 47"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M18 52 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// — TRAINING (warm) —

function SproutMark() {
  // Growing sprout — warmth, growth, nurturing
  return (
    <>
      <circle cx="32" cy="36" r="2.5" fill="currentColor" opacity="0.6" />
      <path d="M32 36 V56" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M32 36 Q24 28 24 20 Q24 12 32 12 Q32 20 32 28"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M32 30 Q40 22 40 14 Q40 6 32 6 Q32 14 32 22"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      <path d="M24 20 L32 28" stroke="currentColor" strokeWidth="0.9" opacity="0.3" />
      <path d="M40 14 L32 22" stroke="currentColor" strokeWidth="0.9" opacity="0.3" />
      <path d="M18 56 H46" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function HandsHeartMark() {
  // Two cupped hands forming a heart space — teaching, giving
  return (
    <>
      <path
        d="M10 28 Q10 14 22 14 Q28 14 32 22 Q36 14 42 14 Q54 14 54 28 Q54 40 32 50 Q10 40 10 28 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M32 22 L32 50" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <path d="M22 22 H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 22 V38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 56 H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 50 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function GuidingStarMark() {
  // A soft rounded star inside a circle — friendly, guiding (not occult)
  return (
    <>
      <circle cx="32" cy="28" r="24" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle
        cx="32"
        cy="28"
        r="18"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M32 10 L36 22 L48 22 L38 30 L42 42 L32 34 L22 42 L26 30 L16 22 L28 22 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.7"
      />
      <circle cx="32" cy="28" r="3" fill="currentColor" opacity="0.5" />
    </>
  );
}

function SteppingStoneMark() {
  // Three stepping stones ascending — progress without being a chart
  return (
    <>
      <ellipse
        cx="16"
        cy="46"
        rx="10"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.45"
      />
      <ellipse
        cx="32"
        cy="34"
        rx="10"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.65"
      />
      <ellipse
        cx="48"
        cy="22"
        rx="10"
        ry="5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M16 46 Q24 40 32 34 Q40 28 48 22"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="2 3"
        fill="none"
        opacity="0.35"
      />
      <circle cx="48" cy="22" r="2" fill="currentColor" opacity="0.65" />
      <path d="M18 56 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 52 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// — MULTI-SERVICE / CREATIVE (warm) —

function CircleMonogramMark() {
  // TC initials in a soft circle — clean brand mark
  return (
    <>
      <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle
        cx="32"
        cy="32"
        r="22"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
      <path d="M14 26 H36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M25 26 V46" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M50 22 Q38 22 38 34 Q38 46 50 46"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function WreathMark() {
  // A wreath of small leaves/loops — warm, artisan badge
  const n = 10;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const cx = 32 + 20 * Math.cos(angle);
        const cy = 32 + 20 * Math.sin(angle);
        const rot = (i / n) * 360;
        return (
          <ellipse
            key={i}
            cx={cx.toFixed(1)}
            cy={cy.toFixed(1)}
            rx="3"
            ry="6"
            transform={`rotate(${rot}, ${cx.toFixed(1)}, ${cy.toFixed(1)})`}
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
            opacity="0.45"
          />
        );
      })}
      <path d="M22 30 H42" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 24 V40" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function SoftBadgeMark() {
  // Rounded badge/shield — premium but warm
  return (
    <>
      <path
        d="M10 14 Q10 8 16 8 H48 Q54 8 54 14 V34 Q54 52 32 58 Q10 52 10 34 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M18 28 H46" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 18 V42" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="28" r="2" fill="currentColor" opacity="0.45" />
    </>
  );
}

function HeartBadgeMark() {
  // T inside a heart — the warmest possible brand mark
  return (
    <>
      <path
        d="M32 16 Q22 2 12 10 Q4 18 14 28 L32 50 L50 28 Q60 18 52 10 Q42 2 32 16 Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path d="M22 26 H42" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 20 V40" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

// ─ BATCH 2 — MORE WARM MARKS ─────────────────────────────────────────────────

// — LASH (batch 2) —

function LashCrescentMark() {
  // Lashes along a crescent moon — soft, feminine, nighttime beauty
  return (
    <>
      <path
        d="M44 10 Q54 22 54 38 Q54 50 44 56 Q34 62 22 54 Q36 56 42 46 Q48 36 46 24 Q44 16 44 10 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M36 18 Q34 12 36 6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M42 22 Q42 14 44 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M46 28 Q48 20 50 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M48 36 Q52 28 54 22"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M46 44 Q52 38 56 32"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path d="M20 48 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 42 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LashButterflyMark() {
  // Lash fans shaped like butterfly wings — playful beauty
  return (
    <>
      <path
        d="M32 28 Q20 18 12 12 Q8 18 12 26 Q16 32 26 30"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M32 28 Q44 18 52 12 Q56 18 52 26 Q48 32 38 30"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M32 28 Q24 32 20 38 Q24 42 28 38"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M32 28 Q40 32 44 38 Q40 42 36 38"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M14 16 Q12 10 15 7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M22 14 Q20 8 22 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M42 14 Q44 8 42 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M50 16 Q52 10 49 7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <circle cx="32" cy="28" r="2.5" fill="currentColor" opacity="0.6" />
      <path d="M18 48 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 38 V56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LashBouquetMark() {
  // Lashes arranged like a flower bouquet
  return (
    <>
      <path
        d="M32 34 L22 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M32 34 L26 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M32 34 L32 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M32 34 L38 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M32 34 L42 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M26 34 Q32 30 38 34 Q32 38 26 34"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M28 38 Q26 46 22 52"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M36 38 Q38 46 42 52"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path d="M18 48 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 38 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LashTiaraMark() {
  // Lashes forming a tiara/crown arc — regal beauty
  return (
    <>
      <path
        d="M10 32 Q16 30 20 26 Q24 22 28 26 Q32 18 36 26 Q40 22 44 26 Q48 30 54 32"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 26 Q18 18 20 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M28 22 Q27 14 29 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M32 18 L32 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M36 22 Q37 14 35 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M44 26 Q46 18 44 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <circle cx="32" cy="4" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="20" cy="12" r="1.5" fill="currentColor" opacity="0.45" />
      <circle cx="44" cy="12" r="1.5" fill="currentColor" opacity="0.45" />
      <path d="M16 42 H48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 36 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// — JEWELRY (batch 2) —

function PearlStrandMark() {
  // String of graduated pearls in an arc
  return (
    <>
      <path
        d="M8 12 Q8 8 14 8 H50 Q56 8 56 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M8 12 Q16 32 32 36 Q48 32 56 12"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.25"
      />
      <circle
        cx="12"
        cy="16"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.45"
      />
      <circle
        cx="20"
        cy="24"
        r="3"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.6"
      />
      <circle
        cx="32"
        cy="30"
        r="4"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.8"
      />
      <circle
        cx="44"
        cy="24"
        r="3"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.6"
      />
      <circle
        cx="52"
        cy="16"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.45"
      />
      <circle cx="32" cy="30" r="1.5" fill="currentColor" opacity="0.5" />
      <path d="M20 48 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 36 V56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function SolitaireMark() {
  // Single gem in a prong setting — classic fine jewelry
  return (
    <>
      <path
        d="M22 28 L28 18 H36 L42 28 L32 42 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M28 18 L32 24 L36 18" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <path d="M22 28 H42" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <path d="M26 28 L32 42 L38 28" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
      <path
        d="M28 18 L26 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M36 18 L38 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 18 L32 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path d="M20 50 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 42 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function ToggleClaspMark() {
  // Toggle clasp — the permanent jewelry closure
  return (
    <>
      <circle cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M36 24 H52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.45" />
      <path d="M36 22 L36 26" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M40 21 L40 27" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M44 22 L44 26" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M20 42 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 36 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LayeredNecklaceMark() {
  // Two layered necklaces at different lengths — trendy, modern
  return (
    <>
      <path
        d="M12 8 Q12 4 18 4 H46 Q52 4 52 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M12 8 Q20 18 32 20 Q44 18 52 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <circle cx="32" cy="20" r="2.5" fill="currentColor" opacity="0.5" />
      <path
        d="M12 8 Q18 30 32 34 Q46 30 52 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M32 34 V38"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M28 38 L32 46 L36 38 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M20 52 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 46 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function AnkletMark() {
  // Delicate anklet chain with a small charm
  return (
    <>
      <path
        d="M6 28 Q6 14 18 10 Q30 6 42 10 Q54 14 58 28"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="22" cy="11" r="1.5" fill="currentColor" opacity="0.35" />
      <circle cx="42" cy="11" r="1.5" fill="currentColor" opacity="0.35" />
      <circle cx="52" cy="18" r="1.5" fill="currentColor" opacity="0.3" />
      <path
        d="M32 9 V14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M29 14 L32 22 L35 14 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <path d="M18 38 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 32 V56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// — CROCHET (batch 2) —

function BeanieMark() {
  // A crochet beanie hat — cozy and instantly recognizable
  return (
    <>
      <path
        d="M12 36 Q12 14 32 10 Q52 14 52 36"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path d="M12 36 H52" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {[14, 20, 26, 32, 38, 44, 50].map((x) => (
        <path
          key={x}
          d={`M${x} 36 L${x} 42`}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.4"
        />
      ))}
      <circle
        cx="32"
        cy="8"
        r="5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M12 42 H52"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path d="M32 42 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function ScallopEdgeMark() {
  // Classic crochet scallop border
  return (
    <>
      {[8, 20, 32, 44].map((x) => (
        <path
          key={x}
          d={`M${x} 26 Q${x + 6} 14 ${x + 12} 26`}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      ))}
      <path d="M8 26 H56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {[8, 20, 32, 44].map((x) => (
        <path
          key={`b${x}`}
          d={`M${x} 26 Q${x + 6} 38 ${x + 12} 26`}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      ))}
      <path d="M32 26 V56" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function AmigurumiMark() {
  // Cute round amigurumi character — playful crochet
  return (
    <>
      <circle cx="32" cy="24" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="25" cy="22" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="39" cy="22" r="2" fill="currentColor" opacity="0.6" />
      <path
        d="M27 29 Q32 34 37 29"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="18"
        cy="10"
        r="4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="46"
        cy="10"
        r="4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      <path d="M32 42 V58" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22 52 H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function ChainStitchMark() {
  // Interlocking loops forming a T — the most basic crochet stitch
  return (
    <>
      {[8, 18, 28, 38, 48].map((x) => (
        <ellipse
          key={x}
          cx={x + 4}
          cy="22"
          rx="5.5"
          ry="8"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity="0.55"
        />
      ))}
      {[8, 18, 28, 38, 48].map((x) => (
        <ellipse
          key={`v${x}`}
          cx="32"
          cy={x + 4}
          rx="8"
          ry="5.5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity="0.55"
        />
      ))}
      <circle cx="32" cy="22" r="2" fill="currentColor" opacity="0.5" />
    </>
  );
}

// — TRAINING (batch 2) —

function NestMark() {
  // A bird's nest — nurturing knowledge, safe learning
  return (
    <>
      <path
        d="M10 34 Q10 24 20 22 Q28 20 32 20 Q36 20 44 22 Q54 24 54 34 Q54 44 44 46 Q36 48 32 48 Q28 48 20 46 Q10 44 10 34 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M14 30 Q24 26 32 28 Q40 30 50 28"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M14 36 Q24 32 32 34 Q40 36 50 34"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M14 42 Q24 38 32 40 Q40 42 50 40"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      <ellipse
        cx="24"
        cy="30"
        rx="4"
        ry="5.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.55"
      />
      <ellipse
        cx="32"
        cy="28"
        rx="4"
        ry="5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.65"
      />
      <ellipse
        cx="40"
        cy="30"
        rx="4"
        ry="5.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.55"
      />
      <path d="M20 54 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 48 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function TorchMark() {
  // A torch/flame — passing the flame of knowledge
  return (
    <>
      <path d="M26 34 H38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect
        x="27"
        y="34"
        width="10"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M32 34 Q24 22 28 14 Q30 8 32 4 Q34 8 36 14 Q40 22 32 34"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.75"
      />
      <path
        d="M32 34 Q28 26 30 20 Q32 14 34 20 Q36 26 32 34"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      <path d="M32 52 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 56 H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function RisingBalloonsMark() {
  // Three balloons rising — celebration, uplift, growth
  return (
    <>
      <ellipse
        cx="20"
        cy="22"
        rx="8"
        ry="10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      <ellipse
        cx="32"
        cy="16"
        rx="9"
        ry="11"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.75"
      />
      <ellipse
        cx="44"
        cy="22"
        rx="8"
        ry="10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M20 32 Q24 36 28 40"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M32 27 L32 40"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M44 32 Q40 36 36 40"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M28 40 Q32 44 36 40"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path d="M20 48 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 44 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LadderMark() {
  // A ladder — climbing, leveling up, skill-building
  return (
    <>
      <path d="M22 4 L22 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 4 L42 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {[10, 20, 30, 40].map((y) => (
        <path
          key={y}
          d={`M22 ${y} H42`}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.5"
        />
      ))}
      <circle cx="32" cy="6" r="2.5" fill="currentColor" opacity="0.6" />
      <path d="M18 58 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 52 V62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// — LUXURY (batch 2) —

function PerfumeBottleMark() {
  // Perfume bottle — luxury beauty
  return (
    <>
      <rect
        x="20"
        y="22"
        width="24"
        height="30"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M26 22 V16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M38 22 V16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <rect
        x="28"
        y="10"
        width="8"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.6"
      />
      <rect
        x="30"
        y="6"
        width="4"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <path d="M22 36 H42" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
      <rect x="22" y="36" width="20" height="14" rx="3" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M28 30 H36"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 26 V34"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
    </>
  );
}

function DiamondFrameMark() {
  // Diamond/rhombus frame with T — elegant luxury
  return (
    <>
      <path d="M32 4 L58 32 L32 60 L6 32 Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M32 12 L50 32 L32 52 L14 32 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
      <path d="M20 32 H44" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 22 V44" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function RibbonCurlMark() {
  // An elegant curling ribbon — premium gift wrapping
  return (
    <>
      <path
        d="M12 18 Q20 8 32 12 Q44 16 48 8 Q52 2 58 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M8 30 Q16 20 28 24 Q40 28 48 22 Q54 18 60 22"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M12 42 Q20 32 32 36 Q44 40 52 34"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <circle cx="32" cy="28" r="3" fill="currentColor" opacity="0.5" />
      <path d="M20 52 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 44 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function FeatherQuillMark() {
  // Feather quill in a circle — artisan craftsmanship
  return (
    <>
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path
        d="M40 10 Q32 20 28 32 Q24 44 20 54"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M40 10 Q46 16 42 22 Q38 28 34 24 Q36 18 40 10"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M36 18 Q42 22 38 28 Q34 34 30 30 Q32 24 36 18"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M32 26 Q38 30 34 36 Q30 42 26 38 Q28 32 32 26"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.3"
      />
    </>
  );
}

// ─ BATCH 3 — EVEN MORE MARKS ─────────────────────────────────────────────────

// — LASH (batch 3) —

function LashPillowMark() {
  // Lashes resting on a soft pillow — beauty sleep
  return (
    <>
      <path
        d="M8 30 Q8 22 18 20 Q28 18 32 18 Q36 18 46 20 Q56 22 56 30 Q56 38 46 40 Q36 42 32 42 Q28 42 18 40 Q8 38 8 30 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M18 28 Q22 24 32 24 Q42 24 46 28"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M20 24 Q18 16 22 10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M26 22 Q25 14 28 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M32 20 L32 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M38 22 Q39 14 36 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M44 24 Q46 16 42 10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path d="M20 50 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 42 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LashSparkleMark() {
  // Lashes with sparkle dots — glam night out
  return (
    <>
      <path
        d="M12 30 Q20 26 32 26 Q44 26 52 30"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 28 Q14 18 18 10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M24 26 Q22 16 25 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M32 26 L32 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M40 26 Q42 16 39 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M48 28 Q50 18 46 10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      {/* sparkles */}
      <circle cx="14" cy="12" r="1.5" fill="currentColor" opacity="0.35" />
      <circle cx="50" cy="8" r="1.5" fill="currentColor" opacity="0.35" />
      <circle cx="32" cy="6" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="22" cy="10" r="1.2" fill="currentColor" opacity="0.25" />
      <circle cx="44" cy="12" r="1.2" fill="currentColor" opacity="0.25" />
      <path d="M18 42 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 34 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LashBloomMark() {
  // Lashes arranged like opening flower petals
  const n = 8;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * Math.PI + Math.PI; // half-circle, upward fan
        const len = i === 0 || i === n - 1 ? 12 : i === 1 || i === n - 2 ? 16 : 20;
        const op = i === 0 || i === n - 1 ? 0.3 : i === 1 || i === n - 2 ? 0.5 : 0.7;
        const x2 = 32 + len * Math.cos(angle);
        const y2 = 30 + len * Math.sin(angle);
        return (
          <path
            key={i}
            d={`M32 30 L${x2.toFixed(1)} ${y2.toFixed(1)}`}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={op}
          />
        );
      })}
      <circle
        cx="32"
        cy="30"
        r="5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      <circle cx="32" cy="30" r="2" fill="currentColor" opacity="0.55" />
      <path d="M32 35 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 48 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function LashRibbonMark() {
  // Lashes flowing off a curving ribbon
  return (
    <>
      <path
        d="M8 28 Q18 22 32 26 Q46 30 56 24"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M56 24 Q60 22 62 26"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M8 28 Q4 30 2 26"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M18 24 Q16 16 19 8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M26 26 Q24 16 27 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M32 26 L32 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M38 28 Q40 18 37 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M46 28 Q48 18 44 10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path d="M18 42 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 34 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// — JEWELRY (batch 3) —

function SignetRingMark() {
  // A signet ring — personalized, heirloom jewelry
  return (
    <>
      <circle cx="32" cy="30" r="20" stroke="currentColor" strokeWidth="2.2" fill="none" />
      <rect
        x="22"
        y="8"
        width="20"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M28 14 H36"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M32 11 V19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path d="M32 50 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 56 H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function CuffBraceletMark() {
  // Open cuff bracelet — bold, modern
  return (
    <>
      <path
        d="M14 10 Q6 10 6 22 Q6 34 14 34"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M50 10 Q58 10 58 22 Q58 34 50 34"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M14 10 H50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 34 H50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 22 H50" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <path
        d="M26 18 H38"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M32 14 V28"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path d="M20 46 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 38 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function GemClusterMark() {
  // Multiple small gems clustered together — sparkle, abundance
  return (
    <>
      <path
        d="M32 22 L36 16 L40 22 L32 30 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <path
        d="M22 20 L25 16 L28 20 L22 26 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M38 18 L40 14 L42 18 L38 22 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M28 30 L30 26 L32 30 L28 34 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
        opacity="0.45"
      />
      <path
        d="M36 28 L38 24 L40 28 L36 32 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
        opacity="0.45"
      />
      <path
        d="M18 16 L20 13 L22 16 L18 20 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <path
        d="M44 14 L46 11 L48 14 L44 18 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <path d="M18 42 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 36 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function TennisBraceletMark() {
  // Line of small gems — classic tennis bracelet
  return (
    <>
      <path
        d="M6 24 Q6 14 16 10 Q26 6 32 6 Q38 6 48 10 Q58 14 58 24"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {[12, 20, 28, 36, 44, 52].map((x) => {
        const y = 24 - Math.abs(32 - x) * 0.35;
        const r = x === 28 || x === 36 ? 3 : 2.5;
        const op = x === 28 || x === 36 ? 0.7 : 0.5;
        return (
          <path
            key={x}
            d={`M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z`}
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
            opacity={op}
          />
        );
      })}
      <path d="M18 36 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 30 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// — CROCHET (batch 3) —

function BasketMark() {
  // A woven basket — handmade, useful, warm
  return (
    <>
      <path
        d="M12 24 Q12 18 18 18 H46 Q52 18 52 24 V46 Q52 54 46 54 H18 Q12 54 12 46 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* weave horizontal */}
      <path d="M12 28 H52" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M12 34 H52" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M12 40 H52" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M12 46 H52" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      {/* weave vertical */}
      <path d="M22 18 V54" stroke="currentColor" strokeWidth="0.9" opacity="0.2" />
      <path d="M32 18 V54" stroke="currentColor" strokeWidth="0.9" opacity="0.2" />
      <path d="M42 18 V54" stroke="currentColor" strokeWidth="0.9" opacity="0.2" />
      {/* handle */}
      <path
        d="M18 18 Q18 6 32 6 Q46 6 46 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M24 34 H40"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 28 V42"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
    </>
  );
}

function ScrunchieMark() {
  // Crochet scrunchie/hair tie — cute accessory
  const n = 12;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * 2 * Math.PI;
        const innerR = 10;
        const outerR = 18;
        const midAngle = ((i + 0.5) / n) * 2 * Math.PI;
        const cx = 32 + ((innerR + outerR) / 2) * Math.cos(midAngle);
        const cy = 28 + ((innerR + outerR) / 2) * Math.sin(midAngle);
        const x1 = 32 + innerR * Math.cos(angle);
        const y1 = 28 + innerR * Math.sin(angle);
        const nextAngle = ((i + 1) / n) * 2 * Math.PI;
        const x2 = 32 + innerR * Math.cos(nextAngle);
        const y2 = 28 + innerR * Math.sin(nextAngle);
        return (
          <path
            key={i}
            d={`M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`}
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            opacity="0.55"
          />
        );
      })}
      <circle
        cx="32"
        cy="28"
        r="10"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M26 28 H38"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 22 V34"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path d="M32 46 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 54 H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function BabyBootieMark() {
  // Tiny crochet baby shoe — handmade gift, cute
  return (
    <>
      <path
        d="M14 30 Q14 20 24 18 Q34 16 44 20 Q52 24 52 30 Q52 38 44 40 L20 40 Q14 40 14 30 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M20 22 V14 Q20 8 28 8 Q36 8 36 14 V22"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      {/* lace detail */}
      <path
        d="M22 22 Q24 20 26 22 Q28 24 30 22 Q32 20 34 22"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.35"
      />
      <circle cx="28" cy="14" r="1.5" fill="currentColor" opacity="0.4" />
      <path d="M20 50 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 42 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function MandalaMark() {
  // Circular mandala pattern — meditative, artisan crochet
  const rings = [8, 16, 24];
  return (
    <>
      {rings.map((r) => (
        <circle
          key={r}
          cx="32"
          cy="28"
          r={r}
          stroke="currentColor"
          strokeWidth={r === 24 ? 1.8 : r === 16 ? 1.2 : 0.9}
          fill="none"
          opacity={r === 24 ? 0.7 : r === 16 ? 0.45 : 0.25}
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * 2 * Math.PI;
        const x1 = 32 + 8 * Math.cos(angle);
        const y1 = 28 + 8 * Math.sin(angle);
        const x2 = 32 + 24 * Math.cos(angle);
        const y2 = 28 + 24 * Math.sin(angle);
        return (
          <path
            key={i}
            d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`}
            stroke="currentColor"
            strokeWidth="0.8"
            opacity="0.25"
          />
        );
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * 2 * Math.PI;
        const cx = 32 + 16 * Math.cos(angle);
        const cy = 28 + 16 * Math.sin(angle);
        return (
          <circle
            key={`d${i}`}
            cx={cx.toFixed(1)}
            cy={cy.toFixed(1)}
            r="2"
            fill="currentColor"
            opacity="0.4"
          />
        );
      })}
      <circle cx="32" cy="28" r="3" fill="currentColor" opacity="0.55" />
    </>
  );
}

// — TRAINING (batch 3) —

function PuzzlePieceMark() {
  // Interlocking puzzle piece — fitting knowledge together
  return (
    <>
      <path
        d="M16 16 H28 Q28 12 32 12 Q36 12 36 16 H48 V28 Q52 28 52 32 Q52 36 48 36 V48 H36 Q36 52 32 52 Q28 52 28 48 H16 V36 Q12 36 12 32 Q12 28 16 28 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M24 28 H40"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 22 V40"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path d="M20 58 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 52 V62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function SeedlingTreeMark() {
  // Three growth stages — seed, sprout, small tree
  return (
    <>
      {/* seed */}
      <ellipse
        cx="14"
        cy="44"
        rx="4"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.45"
      />
      {/* sprout */}
      <path
        d="M32 44 V34"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M32 38 Q26 34 24 28"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M32 36 Q38 32 40 26"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.45"
      />
      {/* tree */}
      <path
        d="M52 44 V24"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M52 30 Q44 22 42 14 Q46 12 52 16 Q58 12 62 14 Q60 22 52 30"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M52 36 Q46 30 44 22"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M52 36 Q58 30 60 22"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.35"
      />
      {/* ground */}
      <path
        d="M6 44 H62"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path d="M18 54 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 48 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function WarmCompassMark() {
  // Rounded compass — direction without being corporate
  return (
    <>
      <circle cx="32" cy="28" r="22" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="32" cy="28" r="3" fill="currentColor" opacity="0.5" />
      {/* soft directional arrows */}
      <path d="M32 8 L34 14 L30 14 Z" fill="currentColor" opacity="0.7" />
      <path d="M32 48 L34 42 L30 42 Z" fill="currentColor" opacity="0.3" />
      <path d="M12 28 L18 26 L18 30 Z" fill="currentColor" opacity="0.3" />
      <path d="M52 28 L46 26 L46 30 Z" fill="currentColor" opacity="0.3" />
      {/* N E S W labels as tiny marks */}
      <circle cx="32" cy="6" r="1.2" fill="currentColor" opacity="0.6" />
      <circle cx="54" cy="28" r="1" fill="currentColor" opacity="0.3" />
      <circle cx="10" cy="28" r="1" fill="currentColor" opacity="0.3" />
      <circle cx="32" cy="50" r="1" fill="currentColor" opacity="0.3" />
      <path d="M20 58 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 50 V62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function GardenGateMark() {
  // A garden gate — opening doors, welcoming, inviting entry
  return (
    <>
      <path
        d="M12 54 V18 Q12 8 22 8 Q28 8 32 14 Q36 8 42 8 Q52 8 52 18 V54"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M12 54 H52"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* gate bars */}
      <path d="M22 8 V54" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <path d="M42 8 V54" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <path d="M32 14 V54" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      {/* crossbar */}
      <path d="M12 30 H52" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      {/* small handle */}
      <circle cx="30" cy="34" r="1.5" fill="currentColor" opacity="0.5" />
      <circle cx="34" cy="34" r="1.5" fill="currentColor" opacity="0.5" />
      <path
        d="M24 30 H40"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M32 24 V40"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.55"
      />
    </>
  );
}

// — LUXURY (batch 3) —

function VanityMirrorMark() {
  // Round vanity mirror on a stand — beauty station
  return (
    <>
      <circle cx="32" cy="22" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle
        cx="32"
        cy="22"
        r="14"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M28 22 H36"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 18 V26"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* stand */}
      <path d="M32 40 V50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M22 50 Q32 46 42 50"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 54 H44"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.6"
      />
    </>
  );
}

function ChandelierMark() {
  // Elegant chandelier with droplets — luxury beauty
  return (
    <>
      <path d="M14 12 H50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M32 6 V12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M14 12 Q14 24 22 28"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M50 12 Q50 24 42 28"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <path d="M32 12 V28" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <path
        d="M22 28 H42"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* droplets */}
      <path d="M22 28 V34" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path
        d="M19 34 L22 40 L25 34 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      <path d="M32 28 V36" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <path
        d="M28 36 L32 44 L36 36 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.6"
      />
      <path d="M42 28 V34" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path
        d="M39 34 L42 40 L45 34 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      <path d="M20 52 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 46 V58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function GiftBoxMark() {
  // Wrapped gift box with bow — special, premium
  return (
    <>
      <rect
        x="12"
        y="24"
        width="40"
        height="28"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M12 34 H52" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <path d="M32 24 V52" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      {/* bow */}
      <path
        d="M32 24 Q24 16 18 18 Q14 22 22 24"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M32 24 Q40 16 46 18 Q50 22 42 24"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <circle cx="32" cy="24" r="2.5" fill="currentColor" opacity="0.55" />
      {/* ribbon vertical */}
      <path
        d="M32 24 L32 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M28 34 H36"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M32 28 V40"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
    </>
  );
}

function OrnateFrameMark() {
  // Ornate rounded rectangle frame with corner flourishes
  return (
    <>
      <rect
        x="10"
        y="8"
        width="44"
        height="48"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <rect
        x="16"
        y="14"
        width="32"
        height="36"
        rx="3"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.3"
      />
      {/* corner flourishes */}
      <path
        d="M12 12 Q16 8 20 12"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M44 12 Q48 8 52 12"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M12 52 Q16 56 20 52"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M44 52 Q48 56 52 52"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.45"
      />
      <path d="M22 30 H42" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 20 V42" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

// — CREATIVE (batch 3) —

function ScissorsMark() {
  // Decorative scissors — crafting tool
  return (
    <>
      <circle
        cx="20"
        cy="40"
        r="8"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      <circle
        cx="44"
        cy="40"
        r="8"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      <path d="M26 36 L42 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M38 36 L22 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="32" cy="24" r="2" fill="currentColor" opacity="0.5" />
      <path d="M32 48 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 56 H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function ThreadSpoolMark() {
  // Thread spool — crafting essential
  return (
    <>
      <ellipse cx="32" cy="12" rx="16" ry="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M16 12 V44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M48 12 V44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="32" cy="44" rx="16" ry="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
      {/* thread wraps */}
      <path d="M18 20 H46" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M18 26 H46" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M18 32 H46" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      <path d="M18 38 H46" stroke="currentColor" strokeWidth="0.9" opacity="0.25" />
      {/* trailing thread */}
      <path
        d="M48 30 Q54 28 56 22 Q58 16 54 14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M24 26 H40"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M32 20 V36"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
    </>
  );
}

function RainbowArcMark() {
  // Three nested arcs — colorful, creative, joyful
  return (
    <>
      <path
        d="M8 44 Q8 14 32 14 Q56 14 56 44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M14 44 Q14 22 32 22 Q50 22 50 44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M20 44 Q20 30 32 30 Q44 30 44 44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M8 44 H56"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M26 38 H38"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 34 V44"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path d="M32 44 V60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 54 H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function MosaicMark() {
  // Small tiles forming a rounded T pattern
  const tiles: [number, number, number][] = [
    // crossbar tiles
    [10, 20, 0.4],
    [18, 20, 0.55],
    [26, 20, 0.7],
    [34, 20, 0.7],
    [42, 20, 0.55],
    [50, 20, 0.4],
    // stem tiles
    [26, 28, 0.5],
    [34, 28, 0.65],
    [26, 36, 0.55],
    [34, 36, 0.5],
    [26, 44, 0.4],
    [34, 44, 0.45],
  ];
  return (
    <>
      {tiles.map(([x, y, op]) => (
        <rect
          key={`${x}${y}`}
          x={x}
          y={y}
          width="6"
          height="6"
          rx="1.2"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
          opacity={op}
        />
      ))}
      {/* accent fills */}
      <rect x="26" y="20" width="6" height="6" rx="1.2" fill="currentColor" fillOpacity="0.15" />
      <rect x="34" y="20" width="6" height="6" rx="1.2" fill="currentColor" fillOpacity="0.15" />
      <rect x="34" y="28" width="6" height="6" rx="1.2" fill="currentColor" fillOpacity="0.1" />
      <path d="M20 58 H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 52 V62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// ─ BATCH 4 — TRINI BRAND MARKS (no T/cross shape) ───────────────────────────
// These represent Trini and what she does — lash, jewelry, crochet, training.
// No crosses, no stars, no religious imagery. Just her craft.

// — TRINI BRAND —

function TriniLipsMark() {
  // Lips silhouette — beauty, femininity, confidence
  return (
    <>
      <path
        d="M12 32 Q18 22 26 26 Q30 28 32 24 Q34 28 38 26 Q46 22 52 32 Q46 44 32 48 Q18 44 12 32 Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M12 32 Q22 30 32 34 Q42 30 52 32"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      <circle cx="22" cy="30" r="1.5" fill="currentColor" opacity="0.2" />
      <circle cx="42" cy="30" r="1.5" fill="currentColor" opacity="0.2" />
    </>
  );
}

function TriniHandMark() {
  // Open hand with heart in palm — giving, creating, teaching
  return (
    <>
      <path
        d="M24 38 Q20 38 18 34 Q16 30 18 26 L18 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M28 36 Q26 30 26 20 L26 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M32 34 V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M36 36 Q38 30 38 20 L38 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M40 38 Q44 36 46 32 Q48 28 46 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M18 38 Q18 48 24 52 Q30 56 32 56 Q34 56 40 52 Q46 48 46 38"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* heart in palm */}
      <path
        d="M32 42 Q28 38 26 40 Q24 42 28 46 L32 50 L36 46 Q40 42 38 40 Q36 38 32 42"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.55"
      />
    </>
  );
}

function TriniProfileMark() {
  // Feminine face profile silhouette — beauty, elegance
  return (
    <>
      <path
        d="M40 8 Q32 8 28 14 Q24 18 24 24 Q22 24 20 28 Q18 32 22 34 Q22 38 26 42 Q28 46 32 48 Q38 52 42 48 L42 8"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* lash detail on the eye area */}
      <path
        d="M28 22 Q30 20 34 22"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M30 20 Q32 18 34 20"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* earring */}
      <circle
        cx="42"
        cy="28"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M42 30 V36"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="42" cy="38" r="1.5" fill="currentColor" opacity="0.4" />
      {/* hair suggestion */}
      <path
        d="M40 8 Q48 6 50 12 Q52 18 48 24"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.35"
      />
    </>
  );
}

function TriniMultiToolMark() {
  // Lash wand + crochet hook + gem arranged in a fan — all her services
  return (
    <>
      {/* crochet hook — left */}
      <path
        d="M18 46 L26 14 Q26 8 22 6 Q18 4 16 8 Q16 12 20 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* lash wand — center */}
      <path
        d="M32 46 V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.75"
      />
      <rect
        x="29.5"
        y="8"
        width="5"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      {/* gem — right */}
      <path
        d="M46 46 L38 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M34 14 L38 8 L42 14 L38 20 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {/* base wrap */}
      <path
        d="M14 46 Q32 40 50 46"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 50 Q32 44 50 50"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function TriniCircleBadgeMark() {
  // Circle with lash, gem, and hook icons around the edge — multi-service badge
  return (
    <>
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* lash icon — top */}
      <path
        d="M26 14 Q28 10 32 10 Q36 10 38 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M28 12 Q30 8 32 8 Q34 8 36 12"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* gem icon — bottom right */}
      <path
        d="M44 42 L48 38 L52 42 L48 48 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* hook icon — bottom left */}
      <path
        d="M16 38 V46 Q16 50 20 50 Q24 50 24 46"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      {/* center: Trini initial as script */}
      <path
        d="M26 28 Q28 24 38 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 24 Q30 32 32 40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function TriniScriptMark() {
  // "T" as a flowing script letter (not a cross) — personal, feminine
  return (
    <>
      <path
        d="M14 18 Q20 10 32 14 Q44 18 50 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 14 Q28 30 30 44 Q31 52 26 56 Q22 58 20 54"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* decorative flourish */}
      <path
        d="M50 12 Q56 8 58 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M20 54 Q16 56 14 52"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function TriniCursiveMark() {
  // Full "Trini" in a single continuous cursive stroke — name as logo
  return (
    <>
      {/* T */}
      <path
        d="M6 16 Q10 12 18 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 14 Q10 22 12 30"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* r */}
      <path
        d="M12 30 Q14 24 18 22 Q22 20 22 26"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* i */}
      <path
        d="M22 26 Q24 22 26 26 Q28 30 26 34"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="26" cy="18" r="1.5" fill="currentColor" opacity="0.55" />
      {/* n */}
      <path
        d="M26 34 Q28 28 32 26 Q36 24 38 30 Q40 36 38 40"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* i */}
      <path
        d="M38 40 Q40 34 44 34 Q46 36 44 42 Q42 48 40 50"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="44" cy="30" r="1.5" fill="currentColor" opacity="0.55" />
      {/* flourish */}
      <path
        d="M40 50 Q44 54 50 50 Q56 46 58 40"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
    </>
  );
}

function TriniMonogramMark() {
  // Interlocked T+C in a circle — clean monogram, NOT cross-shaped
  return (
    <>
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* T as a horizontal bar with short downstroke — more like a shelf than a cross */}
      <path
        d="M16 22 Q24 18 40 22"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M28 22 Q26 32 28 40"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* C wrapping around */}
      <path
        d="M48 20 Q36 16 32 24 Q28 32 32 42 Q36 50 48 46"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
    </>
  );
}

// — MORE LASH (no cross) —

function LashWandCloseMark() {
  // Close-up of a lash wand/applicator — tool-focused, no cross
  return (
    <>
      {/* wand tube */}
      <rect
        x="8"
        y="26"
        width="36"
        height="10"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* wand tip */}
      <path d="M44 31 H56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* bristles */}
      <path
        d="M46 31 L44 24"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M48 31 L47 22"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M50 31 L50 20"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M52 31 L53 22"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M54 31 L56 24"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* bristles down */}
      <path
        d="M46 31 L44 38"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M48 31 L47 40"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M50 31 L50 42"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M52 31 L53 40"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M54 31 L56 38"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
    </>
  );
}

function LashEyeClosedMark() {
  // A closed eye with lashes — sleeping beauty, NOT staring eye
  return (
    <>
      <path
        d="M8 32 Q20 42 32 42 Q44 42 56 32"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* lashes curving up from the lid */}
      <path
        d="M12 34 Q10 26 14 20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M18 38 Q16 28 19 20"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M24 40 Q22 30 26 18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M32 42 L32 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M40 40 Q42 30 38 18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M46 38 Q48 28 45 20"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M52 34 Q54 26 50 20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
    </>
  );
}

function LashFanSoftMark() {
  // Lash fan from a single point — like a hand fan, no cross
  const n = 9;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const angle = -80 + i * 20;
        const rad = (angle * Math.PI) / 180;
        const len = 28 - Math.abs(i - 4) * 2;
        const op = 0.3 + (1 - Math.abs(i - 4) / 4) * 0.5;
        const x2 = 32 + len * Math.sin(rad);
        const y2 = 48 - len * Math.cos(rad);
        return (
          <path
            key={i}
            d={`M32 48 Q${(32 + x2) / 2 + (i < 4 ? -3 : i > 4 ? 3 : 0)} ${(48 + y2) / 2 - 4} ${x2.toFixed(1)} ${y2.toFixed(1)}`}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            opacity={op}
          />
        );
      })}
      <circle
        cx="32"
        cy="48"
        r="4"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.5"
      />
      <circle cx="32" cy="48" r="1.5" fill="currentColor" opacity="0.45" />
    </>
  );
}

// — MORE JEWELRY (no cross) —

function JewelryPliersMark() {
  // Jewelry pliers — the essential permanent jewelry tool
  return (
    <>
      <path
        d="M24 8 Q22 16 26 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M40 8 Q42 16 38 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="32" cy="28" r="5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M27 28 Q26 36 22 46 Q20 52 16 54"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M37 28 Q38 36 42 46 Q44 52 48 54"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* grip texture */}
      <path d="M20 48 L18 50" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M21 46 L19 48" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M44 48 L46 50" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M43 46 L45 48" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </>
  );
}

function ChainLinkMark() {
  // A single beautiful chain link — simple, iconic permanent jewelry
  return (
    <>
      <path
        d="M20 16 Q20 8 32 8 Q44 8 44 16 V28 Q44 36 32 36 Q20 36 20 28 Z"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
      />
      <path
        d="M20 36 Q20 28 32 28 Q44 28 44 36 V48 Q44 56 32 56 Q20 56 20 48 Z"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
      />
      {/* overlap effect */}
      <path d="M24 32 H40" stroke="currentColor" strokeWidth="1" opacity="0.2" />
    </>
  );
}

// — MORE CROCHET (no cross) —

function CrochetHookCloseMark() {
  // Close-up crochet hook with yarn loop — the craft in action
  return (
    <>
      {/* hook */}
      <path
        d="M12 48 Q12 44 16 44 L42 44 Q50 44 50 38 Q50 32 44 30 Q38 28 38 34"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* yarn loop on the hook */}
      <path
        d="M44 30 Q52 24 48 18 Q44 12 38 16 Q32 20 38 26"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* trailing yarn */}
      <path
        d="M48 18 Q54 14 56 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      {/* handle grip */}
      <path d="M16 42 L16 46" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M20 42 L20 46" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M24 42 L24 46" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </>
  );
}

function CrochetBagMark() {
  // A crocheted tote bag — practical, cute, handmade
  return (
    <>
      <path
        d="M14 24 Q14 18 20 18 H44 Q50 18 50 24 V48 Q50 54 44 54 H20 Q14 54 14 48 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* handles */}
      <path
        d="M22 18 Q22 8 28 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M42 18 Q42 8 36 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* crochet texture rows */}
      <path
        d="M16 28 Q24 32 32 28 Q40 24 48 28"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M16 34 Q24 38 32 34 Q40 30 48 34"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M16 40 Q24 44 32 40 Q40 36 48 40"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M16 46 Q24 50 32 46 Q40 42 48 46"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
    </>
  );
}

// — MORE TRAINING (no cross) —

function HandWithGemMark() {
  // A hand holding up a sparkling gem — teaching, elevating craft
  return (
    <>
      {/* hand base */}
      <path
        d="M20 58 Q16 54 16 48 Q16 40 24 38 L28 36"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M44 58 Q48 54 48 48 Q48 40 40 38 L36 36"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M28 36 Q32 32 36 36"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      {/* gem being held up */}
      <path
        d="M26 28 L30 20 H34 L38 28 L32 36 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M30 20 L32 26 L34 20" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <path d="M26 28 H38" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      {/* sparkle lines */}
      <path
        d="M22 18 L20 14"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M42 18 L44 14"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M32 16 L32 10"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.35"
      />
    </>
  );
}

function TriniAllInOneMark() {
  // Three icons in a row: lash + gem + hook — all her services at a glance
  return (
    <>
      {/* lash fan — left */}
      <path
        d="M8 34 Q10 28 12 22"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M12 34 Q13 26 15 18"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M16 34 L16 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M20 34 Q19 26 17 18"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M24 34 Q22 28 20 22"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path d="M6 34 H26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* gem — center */}
      <path
        d="M28 30 L32 22 L36 30 L32 38 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M30 26 L32 30 L34 26" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
      {/* crochet hook — right */}
      <path
        d="M40 34 H54 Q58 34 58 28 Q58 22 54 20 Q50 18 50 24"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* divider dots */}
      <circle cx="16" cy="42" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="32" cy="42" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="48" cy="42" r="1.5" fill="currentColor" opacity="0.3" />
      {/* base text area */}
      <path
        d="M10 52 H54"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.25"
      />
    </>
  );
}

// ─ BATCH 5 — TRINI: WARM + CLASSY, BEAUTY + CRAFT + EMPOWERMENT ─────────────

function TriniCrownHairMark() {
  // Feminine hair silhouette with a subtle tiara — she IS the queen, not a logo
  return (
    <>
      <path
        d="M20 56 Q16 48 16 38 Q16 26 22 20 Q28 14 32 12 Q36 14 42 20 Q48 26 48 38 Q48 48 44 56"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* hair flow */}
      <path
        d="M22 20 Q18 24 16 32"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M42 20 Q46 24 48 32"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.3"
      />
      {/* small tiara at top of head */}
      <path
        d="M26 16 Q28 10 30 14 Q32 8 34 14 Q36 10 38 16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <circle cx="28" cy="11" r="1.2" fill="currentColor" opacity="0.5" />
      <circle cx="32" cy="8" r="1.5" fill="currentColor" opacity="0.6" />
      <circle cx="36" cy="11" r="1.2" fill="currentColor" opacity="0.5" />
      {/* face hint */}
      <path
        d="M28 32 Q30 30 32 32"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M28 40 Q32 44 36 40"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
    </>
  );
}

function TriniHeartHandsMark() {
  // Two hands forming a heart — community, empowerment, love
  return (
    <>
      {/* left hand curve */}
      <path
        d="M8 32 Q8 18 18 12 Q24 8 30 12 L32 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* right hand curve */}
      <path
        d="M56 32 Q56 18 46 12 Q40 8 34 12 L32 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* heart bottom */}
      <path
        d="M8 32 Q8 46 20 52 L32 58 L44 52 Q56 46 56 32"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* fingers suggest */}
      <path
        d="M14 18 Q12 14 14 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M50 18 Q52 14 50 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* inner warmth */}
      <circle cx="32" cy="34" r="3" fill="currentColor" opacity="0.2" />
    </>
  );
}

function TriniFlowerMonogramMark() {
  // A flower where petals are made of her tools — lash, hook, gem, ring, needle
  const tools = 5;
  return (
    <>
      {Array.from({ length: tools }, (_, i) => {
        const angle = (i / tools) * 2 * Math.PI - Math.PI / 2;
        const x = 32 + 18 * Math.cos(angle);
        const y = 32 + 18 * Math.sin(angle);
        const rot = (i / tools) * 360;
        return (
          <ellipse
            key={i}
            cx={x.toFixed(1)}
            cy={y.toFixed(1)}
            rx="4"
            ry="10"
            transform={`rotate(${rot}, ${x.toFixed(1)}, ${y.toFixed(1)})`}
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            opacity="0.5"
          />
        );
      })}
      {/* center — her initial */}
      <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path
        d="M26 28 Q30 26 36 28"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M31 28 Q30 34 31 40"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </>
  );
}

function TriniWindowMark() {
  // An arched window/doorway — she opens doors for people; warm, inviting studio feel
  return (
    <>
      <path
        d="M14 56 V24 Q14 8 32 8 Q50 8 50 24 V56"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* inner arch */}
      <path
        d="M20 56 V28 Q20 16 32 16 Q44 16 44 28 V56"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      {/* her services as small icons inside */}
      {/* lash */}
      <path
        d="M28 28 Q30 24 32 28"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M29 26 Q30 22 31 26"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      {/* gem */}
      <path
        d="M30 38 L32 34 L34 38 L32 42 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      {/* hook */}
      <path
        d="M30 48 Q30 52 34 52 Q38 52 38 48 Q38 44 34 44"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </>
  );
}

function TriniShieldCrestMark() {
  // A soft crest/coat of arms with her tools inside — classy, established
  return (
    <>
      <path
        d="M32 4 Q12 8 10 20 Q8 36 18 48 Q26 56 32 60 Q38 56 46 48 Q56 36 54 20 Q52 8 32 4 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* divider */}
      <path d="M32 16 V48" stroke="currentColor" strokeWidth="0.8" opacity="0.15" />
      <path d="M16 30 H48" stroke="currentColor" strokeWidth="0.8" opacity="0.15" />
      {/* quadrant icons */}
      {/* top-left: lash fan */}
      <path
        d="M20 22 Q22 18 24 22"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M21 20 Q22 16 23 20"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* top-right: gem */}
      <path
        d="M38 20 L40 16 L42 20 L40 24 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.55"
      />
      {/* bottom-left: hook */}
      <path
        d="M22 36 Q22 42 26 42 Q30 42 30 38 Q30 34 26 34"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      {/* bottom-right: heart (teaching/love) */}
      <path
        d="M40 36 Q38 34 36 36 Q34 38 38 40 L40 42 L42 40 Q46 38 44 36 Q42 34 40 36"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.55"
      />
    </>
  );
}

function TriniNestleMark() {
  // Three nested shapes — lash curve, gem, hook — layered inside each other
  return (
    <>
      {/* outer: lash curve */}
      <path
        d="M8 36 Q8 10 32 10 Q56 10 56 36 Q56 50 44 56 Q36 60 32 60 Q28 60 20 56 Q8 50 8 36 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M16 20 Q14 14 18 10"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M24 14 Q22 8 26 6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M32 12 L32 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M40 14 Q42 8 38 6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M48 20 Q50 14 46 10"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      {/* middle: gem shape */}
      <path
        d="M22 34 L28 24 H36 L42 34 L32 48 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* inner: hook curl */}
      <path
        d="M32 30 Q28 30 28 34 Q28 38 32 38 Q36 38 36 42 Q36 46 32 46"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </>
  );
}

function TriniMirrorVanityMark() {
  // Vanity mirror reflecting lashes — beauty station, self-care
  return (
    <>
      {/* mirror circle */}
      <circle cx="32" cy="24" r="20" stroke="currentColor" strokeWidth="1.8" fill="none" />
      {/* reflection: lash curve inside */}
      <path
        d="M22 24 Q24 20 28 22 Q32 16 36 22 Q40 20 42 24"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M26 20 Q28 16 30 20"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M34 20 Q36 16 38 20"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      {/* mirror handle */}
      <path d="M32 44 V52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M26 52 Q32 56 38 52"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* highlight */}
      <path
        d="M20 16 Q18 12 22 12"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
    </>
  );
}

function TriniCameoProfileMark() {
  // Classic cameo brooch — profile inside an oval, very classy
  return (
    <>
      <ellipse cx="32" cy="32" rx="26" ry="28" stroke="currentColor" strokeWidth="2" fill="none" />
      <ellipse
        cx="32"
        cy="32"
        rx="22"
        ry="24"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
      {/* profile silhouette */}
      <path
        d="M36 14 Q30 14 28 18 Q26 22 26 26 Q24 26 22 30 Q20 34 24 36 Q24 40 28 44 Q30 48 34 50 Q38 52 40 48 Q42 44 40 40 V14"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.6"
      />
      {/* lash on profile */}
      <path
        d="M28 24 Q30 22 32 24"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      {/* earring on profile */}
      <path
        d="M40 30 V34"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.35"
      />
      <circle cx="40" cy="36" r="1.5" fill="currentColor" opacity="0.3" />
    </>
  );
}

function TriniRibbonWrapMark() {
  // A flowing ribbon wrapping into a monogram — warm, elegant movement
  return (
    <>
      <path
        d="M10 14 Q18 6 28 10 Q34 12 36 18 Q38 24 34 28 Q30 32 26 38 Q22 46 28 52 Q34 58 42 54 Q50 50 54 42"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* second ribbon strand */}
      <path
        d="M54 42 Q56 36 52 30 Q48 24 42 22 Q36 20 32 24"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* ribbon ends */}
      <path
        d="M10 14 Q6 12 4 16"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M54 42 Q58 44 60 40"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* center detail */}
      <circle cx="32" cy="32" r="2" fill="currentColor" opacity="0.35" />
    </>
  );
}

function TriniLashGemHookMark() {
  // Vertical stack: lash at top, gem in middle, hook at bottom — clean icon column
  return (
    <>
      {/* lash */}
      <path
        d="M22 12 Q24 6 28 10 Q32 4 36 10 Q40 6 42 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M26 8 Q28 4 30 8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M34 8 Q36 4 38 8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M20 14 H44"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* gem */}
      <path
        d="M26 26 L30 22 H34 L38 26 L32 34 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
        opacity="0.65"
      />
      <path d="M30 22 L32 26 L34 22" stroke="currentColor" strokeWidth="0.7" opacity="0.25" />
      <path d="M26 26 H38" stroke="currentColor" strokeWidth="0.7" opacity="0.25" />
      {/* hook */}
      <path
        d="M32 40 V50 Q32 58 26 58 Q20 58 20 52 Q20 48 24 48"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      {/* connecting dots */}
      <circle cx="32" cy="18" r="1.2" fill="currentColor" opacity="0.3" />
      <circle cx="32" cy="38" r="1.2" fill="currentColor" opacity="0.3" />
    </>
  );
}

function TriniElegantTMark() {
  // An elegant, clearly-letter T using thin/thick contrast — like a fashion magazine
  return (
    <>
      {/* thin top serif line */}
      <path
        d="M10 16 Q16 12 32 12 Q48 12 54 16"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      {/* thick crossbar */}
      <path
        d="M12 18 Q22 14 32 14 Q42 14 52 18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* elegant stem with taper */}
      <path
        d="M32 18 Q31 30 31 40 Q30 50 28 56"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* bottom flourish */}
      <path
        d="M28 56 Q24 60 20 58"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* accent dot */}
      <circle cx="52" cy="16" r="2" fill="currentColor" opacity="0.35" />
    </>
  );
}

function TriniDualArcMark() {
  // Two arcs embracing — like open arms, welcoming, community
  return (
    <>
      <path
        d="M6 44 Q6 10 32 10 Q58 10 58 44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 44 Q16 22 32 22 Q48 22 48 44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* tools nestled between the arcs */}
      {/* lash hint */}
      <path
        d="M24 16 Q26 12 28 16"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M36 16 Q38 12 40 16"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* gem below */}
      <path
        d="M30 34 L32 30 L34 34 L32 38 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.45"
      />
      {/* hook hint */}
      <path
        d="M30 44 Q30 48 34 48 Q38 48 38 44"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      {/* base */}
      <path
        d="M6 44 H58"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <circle cx="32" cy="52" r="2" fill="currentColor" opacity="0.3" />
    </>
  );
}

function TriniSilkRibbonMark() {
  // A single silk ribbon forming a soft knot — classy, feminine, warm
  return (
    <>
      <path
        d="M14 20 Q20 14 28 18 Q32 20 32 26"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M50 20 Q44 14 36 18 Q32 20 32 26"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 26 Q26 32 22 40 Q18 48 22 54"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 26 Q38 32 42 40 Q46 48 42 54"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* knot center */}
      <circle
        cx="32"
        cy="26"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      {/* trailing ends */}
      <path
        d="M22 54 Q18 58 14 56"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M42 54 Q46 58 50 56"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function TriniPetalsMark() {
  // Five petals where each petal represents a service — beauty flower
  return (
    <>
      {/* petal 1: lash shape */}
      <path
        d="M32 10 Q24 16 24 24 Q24 28 32 28 Q32 20 32 10"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.55"
      />
      {/* petal 2 */}
      <path
        d="M42 14 Q44 24 40 28 Q36 30 32 28 Q38 22 42 14"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.55"
      />
      {/* petal 3 */}
      <path
        d="M22 14 Q20 24 24 28 Q28 30 32 28 Q26 22 22 14"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.55"
      />
      {/* petal 4 */}
      <path
        d="M46 28 Q44 36 38 38 Q34 38 32 34 Q40 34 46 28"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.45"
      />
      {/* petal 5 */}
      <path
        d="M18 28 Q20 36 26 38 Q30 38 32 34 Q24 34 18 28"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.45"
      />
      {/* center */}
      <circle cx="32" cy="30" r="4" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="32" cy="30" r="1.8" fill="currentColor" opacity="0.5" />
      {/* stem */}
      <path
        d="M32 38 Q30 46 28 54"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M30 46 Q24 44 20 46"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
    </>
  );
}

function TriniThreeCirclesMark() {
  // Three overlapping circles — each a service area — creating a unified center
  return (
    <>
      <circle
        cx="24"
        cy="24"
        r="16"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="40"
        cy="24"
        r="16"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="32"
        cy="38"
        r="16"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.5"
      />
      {/* icons in each circle */}
      {/* top-left: lash */}
      <path
        d="M18 20 Q20 16 22 20"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M19 18 Q20 14 21 18"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.25"
      />
      {/* top-right: gem */}
      <path
        d="M38 18 L40 14 L42 18 L40 22 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      {/* bottom: hook */}
      <path
        d="M30 42 Q30 46 34 46 Q38 46 38 42 Q38 38 34 38"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* center overlap — the heart of Trini */}
      <circle cx="32" cy="28" r="3" fill="currentColor" opacity="0.25" />
    </>
  );
}

function TriniHandwrittenMark() {
  // "TC" in a loose handwritten style — personal, warm, human
  return (
    <>
      {/* T — loose brush stroke */}
      <path
        d="M8 14 Q14 10 28 12 Q34 13 38 16"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22 12 Q20 24 18 36 Q16 46 12 52"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* C — loose brush stroke */}
      <path
        d="M54 18 Q44 12 38 18 Q32 26 32 36 Q32 46 38 52 Q44 58 54 52"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      {/* underline flourish */}
      <path
        d="M12 52 Q24 58 38 54 Q48 50 54 52"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
    </>
  );
}

// ─ BATCH 6 — THE FULL TRINI ──────────────────────────────────────────────────
// Lash extensions + lifts, permanent & handmade jewelry, crochet (bags, toys,
// wearables, home), training (lash, jewelry, crochet, business), and 3D printing.

function TriniMakerCircleMark() {
  // Circle of ALL her tools arranged around the edge — the full picture
  return (
    <>
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="1.8" fill="none" />
      {/* top: lash wand */}
      <rect
        x="29"
        y="4"
        width="6"
        height="10"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M32 14 V18"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* top-right: gem */}
      <path
        d="M48 12 L50 8 L52 12 L50 16 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      {/* right: chain links */}
      <ellipse
        cx="56"
        cy="30"
        rx="3"
        ry="5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <ellipse
        cx="56"
        cy="38"
        rx="3"
        ry="5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      {/* bottom-right: 3D cube */}
      <path
        d="M46 50 L50 48 L54 50 L50 52 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <path d="M50 48 V44" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      {/* bottom: yarn ball */}
      <circle
        cx="32"
        cy="56"
        r="4"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M29 54 Q32 56 35 54"
        stroke="currentColor"
        strokeWidth="0.7"
        fill="none"
        opacity="0.3"
      />
      {/* bottom-left: hook */}
      <path
        d="M12 48 Q12 52 16 52 Q20 52 20 48 Q20 44 16 44"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* left: heart (teaching) */}
      <path
        d="M8 28 Q6 26 4 28 Q2 30 6 34 L8 32 L10 34 Q14 30 12 28 Q10 26 8 28"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.45"
      />
      {/* center: TC */}
      <path
        d="M24 28 Q28 26 36 28"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M30 28 Q28 34 30 40"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function TriniGridMark() {
  // 2x3 grid of her service icons — like an app icon grid
  return (
    <>
      {/* lash — top left */}
      <path
        d="M10 10 Q12 6 14 10 Q16 6 18 10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M8 12 H20"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* gem — top center */}
      <path
        d="M28 10 L32 4 L36 10 L32 16 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {/* chain — top right */}
      <ellipse
        cx="50"
        cy="6"
        rx="3.5"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      <ellipse
        cx="50"
        cy="14"
        rx="3.5"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      {/* yarn + hook — bottom left */}
      <circle
        cx="14"
        cy="34"
        r="5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M18 32 Q20 30 20 34 Q20 38 16 38"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      {/* amigurumi — bottom center */}
      <circle
        cx="32"
        cy="32"
        r="5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      <circle cx="30" cy="31" r="1" fill="currentColor" opacity="0.4" />
      <circle cx="34" cy="31" r="1" fill="currentColor" opacity="0.4" />
      <path
        d="M30 34 Q32 36 34 34"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      {/* 3D print — bottom right */}
      <path
        d="M46 30 L52 28 L56 32 L50 34 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M46 30 V34 L50 38 V34"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      <path d="M50 38 L56 36 V32" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
      {/* mentor/teach icon — center row, spanning */}
      <path
        d="M18 50 Q24 44 32 46 Q40 48 46 44"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M32 46 V52"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="32" cy="54" r="2" fill="currentColor" opacity="0.35" />
    </>
  );
}

function TriniHandsBuildMark() {
  // Two hands building/creating — one holding a hook, one holding a lash wand
  return (
    <>
      {/* left hand silhouette holding hook */}
      <path
        d="M4 44 Q4 36 10 32 Q14 30 18 32 L18 20 Q18 16 22 14 Q26 14 26 18 V32"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M26 18 V10 Q26 6 22 4 Q18 4 18 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      {/* right hand silhouette holding wand */}
      <path
        d="M60 44 Q60 36 54 32 Q50 30 46 32 L46 20 Q46 16 42 14 Q38 14 38 18 V32"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <rect
        x="36"
        y="6"
        width="4"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      {/* creating together — heart/gem shape in the space between */}
      <path
        d="M28 36 L32 28 L36 36 L32 44 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {/* base connection */}
      <path
        d="M4 44 Q16 52 32 52 Q48 52 60 44"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </>
  );
}

function TriniTransformMark() {
  // Cocoon to butterfly — transformation, what she does for clients
  return (
    <>
      {/* cocoon — left */}
      <ellipse
        cx="16"
        cy="36"
        rx="6"
        ry="10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M12 30 Q16 28 20 30"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M12 34 Q16 32 20 34"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M12 38 Q16 36 20 38"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
      {/* arrow */}
      <path
        d="M24 36 H36"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M34 33 L37 36 L34 39"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.35"
      />
      {/* butterfly — right */}
      <path
        d="M48 36 Q40 26 36 18 Q34 26 40 32"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M48 36 Q56 26 60 18 Q62 26 56 32"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M48 36 Q42 40 40 48 Q44 46 46 42"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M48 36 Q54 40 56 48 Q52 46 50 42"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.35"
      />
      <circle cx="48" cy="36" r="2" fill="currentColor" opacity="0.5" />
    </>
  );
}

function Trini3DPrintMark() {
  // 3D printer nozzle creating a heart — tech meets love
  return (
    <>
      {/* printer frame */}
      <path
        d="M10 8 H54 V14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M10 8 V14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* nozzle */}
      <path
        d="M30 14 H34 V20 L32 24 L30 20 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.55"
      />
      {/* printed heart being extruded */}
      <path
        d="M32 28 Q26 20 20 26 Q14 32 24 40 L32 48 L40 40 Q50 32 44 26 Q38 20 32 28"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeDasharray="3 2"
        opacity="0.65"
      />
      {/* base plate */}
      <path
        d="M8 54 H56"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* layer lines on heart */}
      <path
        d="M22 32 Q32 28 42 32"
        stroke="currentColor"
        strokeWidth="0.7"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M20 36 Q32 32 44 36"
        stroke="currentColor"
        strokeWidth="0.7"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M24 40 Q32 36 40 40"
        stroke="currentColor"
        strokeWidth="0.7"
        fill="none"
        opacity="0.2"
      />
    </>
  );
}

function TriniAmigurumiMark() {
  // Cute amigurumi bear she crochets — her actual product
  return (
    <>
      {/* head */}
      <circle cx="32" cy="20" r="14" stroke="currentColor" strokeWidth="1.8" fill="none" />
      {/* ears */}
      <circle
        cx="20"
        cy="10"
        r="5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="44"
        cy="10"
        r="5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      {/* face */}
      <circle cx="26" cy="18" r="2" fill="currentColor" opacity="0.55" />
      <circle cx="38" cy="18" r="2" fill="currentColor" opacity="0.55" />
      <path
        d="M28 24 Q32 28 36 24"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <circle cx="32" cy="22" r="1.5" fill="currentColor" opacity="0.35" />
      {/* body */}
      <path
        d="M22 34 Q22 50 32 52 Q42 50 42 34"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      {/* arms */}
      <path
        d="M22 38 Q16 40 14 44"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M42 38 Q48 40 50 44"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function TriniBagMark() {
  // Crocheted tote bag she makes — her actual product
  return (
    <>
      {/* bag body */}
      <path
        d="M12 22 Q10 22 10 26 V48 Q10 54 16 54 H48 Q54 54 54 48 V26 Q54 22 52 22"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* handles */}
      <path
        d="M20 22 Q20 10 28 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M44 22 Q44 10 36 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* crochet texture */}
      <path
        d="M14 30 Q22 34 32 30 Q42 26 50 30"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M14 36 Q22 40 32 36 Q42 32 50 36"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M14 42 Q22 46 32 42 Q42 38 50 42"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.2"
      />
      {/* decorative element — small gem charm on bag */}
      <path d="M32 22 V26" stroke="currentColor" strokeWidth="0.9" opacity="0.4" />
      <path
        d="M30 26 L32 30 L34 26 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function TriniWeldingMark() {
  // Welding a permanent bracelet on a wrist — her actual service
  return (
    <>
      {/* wrist */}
      <path
        d="M4 28 Q4 22 10 22 H54 Q60 22 60 28 V38 Q60 44 54 44 H10 Q4 44 4 38 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.35"
      />
      {/* chain on wrist */}
      <path d="M8 33 H26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M38 33 H56" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* welding spark at the join point */}
      <circle
        cx="32"
        cy="33"
        r="4"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.6"
      />
      <circle cx="32" cy="33" r="1.5" fill="currentColor" opacity="0.5" />
      {/* spark lines */}
      <path
        d="M32 27 V24"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M28 29 L26 27"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M36 29 L38 27"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* clasp detail */}
      <circle
        cx="26"
        cy="33"
        r="2"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      <circle
        cx="38"
        cy="33"
        r="2"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function TriniLashSetMark() {
  // Lash set on an eye pad/patch — the actual lash extension process
  return (
    <>
      {/* eye pad shape */}
      <path
        d="M6 28 Q6 18 18 14 Q28 10 32 10 Q36 10 46 14 Q58 18 58 28 Q58 38 46 42 Q36 46 32 46 Q28 46 18 42 Q6 38 6 28 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.4"
      />
      {/* closed eye line */}
      <path
        d="M12 30 Q22 38 32 38 Q42 38 52 30"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* lash extensions fanning up */}
      <path
        d="M16 32 Q14 24 17 16"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M22 34 Q20 24 23 14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M28 36 Q26 26 29 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M32 38 L32 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M36 36 Q38 26 35 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M42 34 Q44 24 41 14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M48 32 Q50 24 47 16"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
    </>
  );
}

function TriniTeachCircleMark() {
  // Person teaching a small group — mentoring, community
  return (
    <>
      {/* teacher figure — center, larger */}
      <circle cx="32" cy="14" r="5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path
        d="M26 22 Q26 30 32 32 Q38 30 38 22"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.6"
      />
      {/* student 1 — left */}
      <circle
        cx="12"
        cy="36"
        r="4"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M8 42 Q8 48 12 48 Q16 48 16 42"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.4"
      />
      {/* student 2 — right */}
      <circle
        cx="52"
        cy="36"
        r="4"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M48 42 Q48 48 52 48 Q56 48 56 42"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.4"
      />
      {/* student 3 — bottom */}
      <circle
        cx="32"
        cy="48"
        r="4"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M28 54 Q28 58 32 58 Q36 58 36 54"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.4"
      />
      {/* connection lines */}
      <path
        d="M26 22 L16 34"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="2 2"
        opacity="0.25"
      />
      <path
        d="M38 22 L48 34"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="2 2"
        opacity="0.25"
      />
      <path
        d="M32 32 L32 44"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="2 2"
        opacity="0.25"
      />
    </>
  );
}

function TriniBizEmpowerMark() {
  // Rising figure with arms up — empowerment, business growth
  return (
    <>
      {/* figure */}
      <circle cx="32" cy="14" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M32 20 V38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* arms raised up in celebration */}
      <path
        d="M32 26 Q24 20 18 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 26 Q40 20 46 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* legs as stable base */}
      <path d="M32 38 L24 50" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M32 38 L40 50" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* rising motion lines */}
      <path
        d="M14 16 L12 10"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M50 16 L52 10"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M10 20 L8 16"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.2"
      />
      <path
        d="M54 20 L56 16"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.2"
      />
      {/* base */}
      <path
        d="M16 54 H48"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.35"
      />
    </>
  );
}

function TriniLashLiftMark() {
  // Lash lift — curling lashes upward on a rod shape
  return (
    <>
      {/* silicone rod/shield shape */}
      <path
        d="M10 36 Q10 20 32 16 Q54 20 54 36"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.45"
      />
      {/* natural lashes curling over the rod */}
      <path
        d="M14 36 Q12 28 16 20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M20 36 Q18 26 22 16"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M26 36 Q24 24 28 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M32 36 Q30 22 32 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M38 36 Q40 24 36 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M44 36 Q46 26 42 16"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M50 36 Q52 28 48 20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* closed eye line */}
      <path
        d="M8 36 Q20 44 32 44 Q44 44 56 36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function TriniCozyBlanketMark() {
  // Folded cozy blanket with a heart tag — handmade home product
  return (
    <>
      <path
        d="M10 16 H54 Q56 16 56 18 V44 Q56 46 54 46 H10 Q8 46 8 44 V18 Q8 16 10 16 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* fold line */}
      <path d="M8 30 H56" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      {/* crochet texture */}
      <path
        d="M12 20 Q20 24 32 20 Q44 16 52 20"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M12 26 Q20 30 32 26 Q44 22 52 26"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M12 34 Q20 38 32 34 Q44 30 52 34"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M12 40 Q20 44 32 40 Q44 36 52 40"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      {/* heart tag */}
      <path d="M46 46 V50" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path
        d="M46 52 Q44 50 42 52 Q40 54 44 56 L46 58 L48 56 Q52 54 50 52 Q48 50 46 52"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
    </>
  );
}

function TriniScrunchieMark() {
  // Cute scrunchie on a wrist — her wearable crochet product
  return (
    <>
      {/* wrist/arm */}
      <path
        d="M16 24 Q16 18 22 16 H42 Q48 18 48 24 V44 Q48 50 42 52 H22 Q16 50 16 44 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      {/* scrunchie ring */}
      <path
        d="M14 32 Q12 28 16 26 Q20 24 24 28 Q28 24 32 26 Q36 24 40 28 Q44 24 48 26 Q52 28 50 32 Q52 36 48 38 Q44 40 40 36 Q36 40 32 38 Q28 40 24 36 Q20 40 16 38 Q12 36 14 32 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      {/* inner ring */}
      <circle
        cx="32"
        cy="32"
        r="6"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.2"
      />
    </>
  );
}

function TriniEarringsMark() {
  // Pair of handmade earrings — her jewelry product
  return (
    <>
      {/* left earring */}
      <path
        d="M18 8 V12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle
        cx="18"
        cy="6"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M18 12 V18"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M12 18 L18 32 L24 18 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M12 18 H24" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <path d="M13 22 L23 22" stroke="currentColor" strokeWidth="0.7" opacity="0.2" />
      {/* right earring — different design (shows variety) */}
      <path
        d="M46 8 V12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle
        cx="46"
        cy="6"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M46 12 V16"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="46" cy="22" r="6" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle
        cx="46"
        cy="22"
        r="2.5"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M46 28 V32"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="46" cy="35" r="3" fill="currentColor" opacity="0.35" />
      {/* "pair" connector */}
      <path
        d="M24 42 Q32 46 40 42"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.25"
      />
    </>
  );
}

function TriniFullStoryMark() {
  // A winding path with icons at each stop — her full journey/story
  return (
    <>
      {/* path */}
      <path
        d="M8 10 Q16 10 20 18 Q24 26 32 26 Q40 26 44 18 Q48 10 56 10"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M8 10 Q16 18 20 26 Q24 34 32 34 Q40 34 44 42 Q48 50 56 50"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.3"
      />
      {/* stop 1: lash */}
      <path
        d="M8 10 Q10 6 12 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <circle
        cx="10"
        cy="10"
        r="3"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      {/* stop 2: gem/jewelry */}
      <path
        d="M30 16 L32 12 L34 16 L32 20 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.55"
      />
      {/* stop 3: hook/crochet */}
      <path
        d="M24 40 Q24 44 28 44 Q32 44 32 40 Q32 36 28 36"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* stop 4: teaching (group) */}
      <circle cx="44" cy="34" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="40" cy="38" r="1.5" fill="currentColor" opacity="0.25" />
      <circle cx="48" cy="38" r="1.5" fill="currentColor" opacity="0.25" />
      {/* stop 5: 3D / future */}
      <path
        d="M52 46 L56 44 L58 48 L54 50 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M54 50 V46 L58 44"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.3"
      />
    </>
  );
}

function TriniCoasterSetMark() {
  // Stack of crocheted coasters — her home product
  return (
    <>
      <ellipse
        cx="32"
        cy="44"
        rx="22"
        ry="8"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.45"
      />
      <ellipse
        cx="32"
        cy="38"
        rx="22"
        ry="8"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.55"
      />
      <ellipse cx="32" cy="32" rx="22" ry="8" stroke="currentColor" strokeWidth="1.8" fill="none" />
      {/* top coaster detail — mandala rings */}
      <ellipse
        cx="32"
        cy="32"
        rx="14"
        ry="5"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="6"
        ry="2.5"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      <circle cx="32" cy="32" r="1.5" fill="currentColor" opacity="0.35" />
    </>
  );
}

function TriniCreativeHubMark() {
  // A honeycomb of hexagons — each cell a different service (she's a creative hub)
  const hexes: [number, number, number][] = [
    [32, 20, 0.7], // center top
    [20, 30, 0.5], // left
    [44, 30, 0.5], // right
    [32, 40, 0.6], // center bottom
    [20, 50, 0.35], // bottom left
    [44, 50, 0.35], // bottom right
  ];
  return (
    <>
      {hexes.map(([cx, cy, op], i) => {
        const r = 8;
        const pts = Array.from({ length: 6 }, (_, j) => {
          const a = (j / 6) * 2 * Math.PI - Math.PI / 6;
          return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
        }).join(" ");
        return (
          <polygon
            key={i}
            points={pts}
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            opacity={op}
          />
        );
      })}
      {/* icons in key hexagons */}
      {/* center top: lash */}
      <path
        d="M30 18 Q32 14 34 18"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* left: hook */}
      <path
        d="M18 30 Q18 34 22 34 Q26 34 26 30"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      {/* right: gem */}
      <path
        d="M42 28 L44 24 L46 28 L44 32 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
      {/* center bottom: heart */}
      <path
        d="M32 38 Q30 36 28 38 Q26 40 30 42 L32 44 L34 42 Q38 40 36 38 Q34 36 32 38"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

// ─ BATCH 7 — ACRYLICS, EARRINGS, & MORE TRINI ──────────────────────────────

function AcrylicNailsMark() {
  // Five acrylic nails — hand with polished nails, her beauty service
  return (
    <>
      {/* hand shape — just fingertips */}
      <path
        d="M10 44 Q10 36 16 34 L16 14 Q16 10 20 10 Q24 10 24 14 V30"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M24 30 V10 Q24 6 28 6 Q32 6 32 10 V28"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M32 28 V12 Q32 8 36 8 Q40 8 40 12 V30"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M40 30 V16 Q40 12 44 12 Q48 12 48 16 V34"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M48 34 Q54 36 54 44"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* nail tips — rounded acrylic shape */}
      <path
        d="M14 14 Q16 6 18 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M22 10 Q24 2 26 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M30 12 Q32 4 34 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M38 14 Q40 6 42 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      {/* palm curve */}
      <path
        d="M10 44 Q20 52 32 52 Q44 52 54 44"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.45"
      />
    </>
  );
}

function AcrylicNailSingleMark() {
  // Single stiletto acrylic nail close-up with design detail
  return (
    <>
      {/* nail shape — almond/stiletto */}
      <path
        d="M20 50 Q18 50 18 44 V24 Q18 12 32 6 Q46 12 46 24 V44 Q46 50 44 50 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* cuticle line */}
      <path
        d="M20 44 Q32 40 44 44"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.35"
      />
      {/* design on nail — little gems/dots */}
      <circle
        cx="32"
        cy="20"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <circle cx="32" cy="20" r="1" fill="currentColor" opacity="0.4" />
      <circle cx="26" cy="28" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="38" cy="28" r="1.5" fill="currentColor" opacity="0.3" />
      {/* french tip line */}
      <path
        d="M22 16 Q32 10 42 16"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
    </>
  );
}

function AcrylicKeychainMark() {
  // Acrylic keychain/charm — her 3D/acrylic product
  return (
    <>
      {/* keyring */}
      <circle cx="32" cy="12" r="6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle
        cx="32"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.3"
      />
      {/* connector */}
      <path
        d="M32 18 V24"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* acrylic charm shape — rounded rectangle */}
      <rect
        x="18"
        y="24"
        width="28"
        height="32"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* design on charm — heart */}
      <path
        d="M32 34 Q28 28 24 32 Q20 36 28 42 L32 46 L36 42 Q44 36 40 32 Q36 28 32 34"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.45"
      />
      {/* acrylic shine */}
      <path
        d="M22 30 Q20 28 22 26"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
    </>
  );
}

function AcrylicPourMark() {
  // Acrylic pour art — paint flowing/mixing
  return (
    <>
      <rect
        x="10"
        y="10"
        width="44"
        height="44"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* flowing acrylic pour pattern */}
      <path
        d="M10 30 Q20 22 32 28 Q44 34 54 26"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M10 38 Q22 30 32 36 Q42 42 54 34"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M10 22 Q18 18 28 22 Q38 26 48 20 Q52 18 54 20"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.3"
      />
      {/* cell/lacing detail */}
      <circle
        cx="24"
        cy="26"
        r="3"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      <circle
        cx="40"
        cy="32"
        r="2.5"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      <circle
        cx="32"
        cy="42"
        r="2"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.15"
      />
    </>
  );
}

function EarringDangleMark() {
  // Dangly statement earring — handmade jewelry product
  return (
    <>
      {/* ear hook */}
      <path
        d="M32 4 Q38 4 38 10 Q38 16 32 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* chain/links */}
      <path
        d="M32 16 V22"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* tier 1 — bar */}
      <path d="M24 22 H40" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* hanging chains */}
      <path
        d="M26 22 V30"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M32 22 V32"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M38 22 V30"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* tier 2 — shapes at bottom */}
      <circle
        cx="26"
        cy="33"
        r="3"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M30 32 L32 38 L34 32 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle
        cx="38"
        cy="33"
        r="3"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      {/* bottom drops */}
      <path d="M26 36 V40" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <circle cx="26" cy="42" r="1.5" fill="currentColor" opacity="0.35" />
      <path d="M32 38 V44" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <circle cx="32" cy="46" r="2" fill="currentColor" opacity="0.4" />
      <path d="M38 36 V40" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <circle cx="38" cy="42" r="1.5" fill="currentColor" opacity="0.35" />
    </>
  );
}

function EarringStudsMark() {
  // Collection of stud earrings — showing variety she makes
  return (
    <>
      {/* stud 1 — circle */}
      <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" opacity="0.35" />
      {/* stud 2 — heart */}
      <path
        d="M40 14 Q38 10 34 12 Q30 14 36 20 L40 24 L44 20 Q50 14 46 12 Q42 10 40 14"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
      {/* stud 3 — star/flower */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
        const x = 16 + 6 * Math.cos(a);
        const y = 42 + 6 * Math.sin(a);
        return (
          <circle
            key={i}
            cx={x.toFixed(1)}
            cy={y.toFixed(1)}
            r="2.5"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
            opacity="0.45"
          />
        );
      })}
      <circle cx="16" cy="42" r="2" fill="currentColor" opacity="0.4" />
      {/* stud 4 — teardrop */}
      <path
        d="M40 36 Q36 40 36 46 Q36 52 40 54 Q44 52 44 46 Q44 40 40 36 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
      <circle cx="40" cy="46" r="2" fill="currentColor" opacity="0.3" />
    </>
  );
}

function EarringHuggiesMark() {
  // Huggie hoop earrings — modern everyday jewelry
  return (
    <>
      {/* left ear silhouette hint */}
      <path
        d="M18 14 Q8 18 6 30 Q4 42 14 48"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.25"
      />
      {/* huggie hoop — left */}
      <circle cx="16" cy="34" r="8" stroke="currentColor" strokeWidth="2.2" fill="none" />
      <circle
        cx="16"
        cy="34"
        r="4"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      <circle cx="16" cy="26" r="1.5" fill="currentColor" opacity="0.4" />
      {/* right ear silhouette hint */}
      <path
        d="M46 14 Q56 18 58 30 Q60 42 50 48"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.25"
      />
      {/* huggie hoop — right */}
      <circle cx="48" cy="34" r="8" stroke="currentColor" strokeWidth="2.2" fill="none" />
      <circle
        cx="48"
        cy="34"
        r="4"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      <circle cx="48" cy="26" r="1.5" fill="currentColor" opacity="0.4" />
      {/* small charm on one */}
      <path d="M48 42 V46" stroke="currentColor" strokeWidth="0.9" opacity="0.4" />
      <path
        d="M46 46 L48 50 L50 46 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function TriniAcrylicEarringMark() {
  // Acrylic earring — showing her specific product (acrylic + earring combined)
  return (
    <>
      {/* ear hook */}
      <path
        d="M32 6 Q40 6 40 14 Q40 20 34 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M34 20 V24"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* acrylic charm shape — organic/blob */}
      <path
        d="M20 24 Q16 28 18 36 Q20 44 28 48 Q34 50 40 46 Q48 40 48 32 Q48 24 40 24 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* acrylic swirl pattern inside */}
      <path
        d="M24 30 Q30 28 34 34 Q38 40 36 44"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M22 36 Q28 32 32 38 Q36 44 42 40"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.2"
      />
      {/* shine */}
      <path
        d="M24 28 Q22 26 24 24"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
      />
    </>
  );
}

function TriniEverythingCircleMark() {
  // Circle with ALL services as tiny icons around the rim — the definitive Trini mark
  return (
    <>
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="1.8" fill="none" />
      {/* 12 o'clock: lash */}
      <path
        d="M30 6 Q32 2 34 6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M28 8 H36"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* 2 o'clock: acrylic nail */}
      <path
        d="M50 10 Q54 8 54 14 Q54 18 50 16"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      {/* 3 o'clock: gem */}
      <path
        d="M56 30 L58 28 L60 30 L58 34 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.45"
      />
      {/* 4 o'clock: earring */}
      <circle
        cx="54"
        cy="44"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <path d="M54 47 V49" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
      <circle cx="54" cy="50" r="1" fill="currentColor" opacity="0.3" />
      {/* 6 o'clock: chain link */}
      <ellipse
        cx="32"
        cy="58"
        rx="4"
        ry="2.5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.45"
      />
      {/* 8 o'clock: yarn ball */}
      <circle
        cx="10"
        cy="44"
        r="3"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M8 43 Q10 44 12 43"
        stroke="currentColor"
        strokeWidth="0.6"
        fill="none"
        opacity="0.25"
      />
      {/* 9 o'clock: hook */}
      <path
        d="M4 30 Q4 34 8 34 Q12 34 12 30 Q12 26 8 26"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* 10 o'clock: 3D cube */}
      <path
        d="M10 16 L14 14 L16 18 L12 20 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.4"
      />
      {/* 11 o'clock: heart (teaching) */}
      <path
        d="M22 8 Q20 6 18 8 Q16 10 20 12 L22 14 L24 12 Q28 10 26 8 Q24 6 22 8"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.45"
      />
      {/* center — simple "T" script */}
      <path
        d="M24 28 Q28 26 38 28"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M30 28 Q28 34 30 42"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function TriniToolBeltMark() {
  // A curved belt/band with all her tools hanging from it — like a maker's apron
  return (
    <>
      {/* belt arc */}
      <path
        d="M4 18 Q16 10 32 10 Q48 10 60 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* hanging tools */}
      {/* lash wand */}
      <path
        d="M12 16 V28"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <rect
        x="10"
        y="28"
        width="4"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
      {/* nail file */}
      <path
        d="M22 14 V34"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path d="M20 34 H24" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      {/* gem/pendant */}
      <path d="M32 12 V20" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path
        d="M28 20 L32 28 L36 20 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* crochet hook */}
      <path
        d="M42 14 V30 Q42 36 38 36 Q34 36 34 32 Q34 28 38 28"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* earring */}
      <path d="M52 16 V22" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <circle
        cx="52"
        cy="26"
        r="4"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <circle cx="52" cy="26" r="1.5" fill="currentColor" opacity="0.3" />
      {/* base text area */}
      <path
        d="M10 48 H54"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.2"
      />
    </>
  );
}

function TriniMoodboardMark() {
  // A collage/mood board of overlapping shapes — each a different product
  return (
    <>
      {/* polaroid/frame 1 — lash close-up */}
      <rect
        x="4"
        y="4"
        width="20"
        height="22"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M8 14 Q12 10 16 14 Q20 10 22 14"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.35"
      />
      {/* frame 2 — earring */}
      <rect
        x="22"
        y="8"
        width="18"
        height="20"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.55"
      />
      <circle
        cx="31"
        cy="16"
        r="4"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      <path d="M31 20 V24" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      {/* frame 3 — acrylic */}
      <rect
        x="38"
        y="4"
        width="22"
        height="22"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M42 14 Q48 10 54 16"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M40 18 Q46 14 56 20"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      {/* frame 4 — crochet bag */}
      <rect
        x="4"
        y="28"
        width="22"
        height="22"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M10 34 Q14 30 18 34"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      <rect
        x="8"
        y="36"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.35"
      />
      {/* frame 5 — gem/chain */}
      <rect
        x="24"
        y="30"
        width="18"
        height="22"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M31 36 L33 32 L35 36 L33 40 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
      <path d="M33 40 V48" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      {/* frame 6 — 3D print */}
      <rect
        x="40"
        y="28"
        width="20"
        height="24"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M46 36 L50 34 L54 36 L50 38 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M46 36 V40 L50 42 V38"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M50 42 L54 40 V36"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.3"
      />
    </>
  );
}

function TriniEverythingTreeMark() {
  // A tree where each branch holds a different product — rooted, growing
  return (
    <>
      {/* trunk */}
      <path d="M32 58 V30" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {/* roots */}
      <path
        d="M32 58 Q24 60 18 58"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M32 58 Q40 60 46 58"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.3"
      />
      {/* branches with product icons */}
      {/* left branch: lash */}
      <path
        d="M32 42 Q24 40 16 36"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M14 36 Q16 32 18 36"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      {/* right branch: earring */}
      <path
        d="M32 42 Q40 40 48 36"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="50"
        cy="36"
        r="3"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      {/* left upper: hook */}
      <path
        d="M32 34 Q22 30 12 24"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M10 24 Q10 28 14 28 Q18 28 18 24"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      {/* right upper: gem */}
      <path
        d="M32 34 Q42 30 52 24"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M50 22 L52 18 L54 22 L52 26 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
      {/* top left: acrylic nail */}
      <path
        d="M32 30 Q24 24 14 16"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M12 16 Q14 10 16 16"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      {/* top right: 3D */}
      <path
        d="M32 30 Q40 24 50 16"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M48 14 L52 12 L54 16 L50 18 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      {/* crown: heart (teaching/love) */}
      <path
        d="M32 30 V18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 14 Q28 8 24 12 Q20 16 28 20 L32 24 L36 20 Q44 16 40 12 Q36 8 32 14"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
    </>
  );
}

// ── Preview tile ──────────────────────────────────────────────────────────────

// ─ BATCH 8 — MORE TRINI ─────────────────────────────────────────────────────

function TriniNailGemComboMark() {
  // Acrylic nail with a gem embedded — two of her skills fused
  return (
    <>
      <path
        d="M18 54 Q16 54 16 48 V26 Q16 10 32 4 Q48 10 48 26 V48 Q48 54 46 54 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M18 46 Q32 42 46 46"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      {/* gem on nail */}
      <path
        d="M26 24 L32 16 L38 24 L32 34 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
        opacity="0.65"
      />
      <path d="M26 24 H38" stroke="currentColor" strokeWidth="0.7" opacity="0.25" />
      <path d="M30 20 L32 24 L34 20" stroke="currentColor" strokeWidth="0.7" opacity="0.25" />
      {/* tiny accent gems */}
      <circle cx="24" cy="18" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="40" cy="18" r="1.5" fill="currentColor" opacity="0.3" />
    </>
  );
}

function TriniHandsWeaveMark() {
  // Two hands weaving/crocheting — the act of creating
  return (
    <>
      {/* left hand */}
      <path
        d="M6 34 Q6 28 12 26 L20 24 V16 Q20 12 24 14 V24"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M24 24 V10 Q24 6 28 8 V22"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* yarn/thread between hands */}
      <path
        d="M28 18 Q32 14 36 18 Q40 22 44 18 Q48 14 50 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M28 24 Q34 20 40 24 Q46 28 50 24"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* right hand */}
      <path
        d="M58 34 Q58 28 52 26 L44 24 V16 Q44 12 40 14 V24"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M40 24 V10 Q40 6 36 8 V22"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* product forming below — a bag shape */}
      <path
        d="M20 36 Q20 50 32 52 Q44 50 44 36"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M22 40 Q32 44 42 40"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M22 44 Q32 48 42 44"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.2"
      />
    </>
  );
}

function TriniSparkleEyeMark() {
  // Closed eye with long lashes and sparkle — beauty moment, NOT occult
  return (
    <>
      {/* closed eye — gentle curve */}
      <path
        d="M6 34 Q16 44 32 44 Q48 44 58 34"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* glamorous lashes */}
      <path
        d="M10 36 Q8 28 12 20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M18 40 Q16 30 20 18"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M26 42 Q24 30 28 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M32 44 L32 10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M38 42 Q40 30 36 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M46 40 Q48 30 44 18"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M54 36 Q56 28 52 20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      {/* sparkle dots — glam, not occult */}
      <circle cx="32" cy="8" r="1.8" fill="currentColor" opacity="0.45" />
      <circle cx="22" cy="14" r="1.2" fill="currentColor" opacity="0.25" />
      <circle cx="44" cy="12" r="1.2" fill="currentColor" opacity="0.25" />
      <circle cx="14" cy="20" r="1" fill="currentColor" opacity="0.15" />
      <circle cx="52" cy="18" r="1" fill="currentColor" opacity="0.15" />
    </>
  );
}

function TriniNailEarringPairMark() {
  // A manicured hand with an earring dangling from one finger — playful
  return (
    <>
      {/* hand/fingers — just two fingers */}
      <path
        d="M22 56 Q20 50 22 42 V18 Q22 12 26 12 Q30 12 30 18 V36"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M30 36 V14 Q30 8 34 8 Q38 8 38 14 V42 Q40 50 38 56"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      {/* nail tips */}
      <path
        d="M22 18 Q24 10 26 18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M30 14 Q32 6 34 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* earring hanging from fingertip */}
      <path d="M34 14 V18" stroke="currentColor" strokeWidth="0.9" opacity="0.4" />
      <circle
        cx="34"
        cy="22"
        r="4"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.55"
      />
      <path d="M34 26 V30" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <path
        d="M32 30 L34 36 L36 30 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinejoin="round"
        opacity="0.5"
      />
      {/* ring on finger */}
      <path
        d="M22 34 H30"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
    </>
  );
}

function TriniWreathEverythingMark() {
  // Wreath made of her actual products instead of leaves
  const items = 8;
  return (
    <>
      {/* wreath circle guide */}
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="0" fill="none" />
      {/* lash fan — 12 oclock */}
      <path
        d="M28 10 Q30 6 32 10 Q34 6 36 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M26 12 H38"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* nail — 1:30 */}
      <path
        d="M46 12 Q48 8 50 14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* earring — 3 oclock */}
      <circle
        cx="54"
        cy="28"
        r="3"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      <path d="M54 31 V34" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
      <circle cx="54" cy="36" r="1.5" fill="currentColor" opacity="0.3" />
      {/* gem — 4:30 */}
      <path
        d="M48 44 L50 40 L52 44 L50 48 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      {/* yarn — 6 oclock */}
      <circle
        cx="32"
        cy="54"
        r="4"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M30 52 Q32 54 34 52"
        stroke="currentColor"
        strokeWidth="0.6"
        fill="none"
        opacity="0.25"
      />
      {/* hook — 7:30 */}
      <path
        d="M14 44 Q14 48 18 48 Q22 48 22 44 Q22 40 18 40"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* chain — 9 oclock */}
      <ellipse
        cx="10"
        cy="28"
        rx="3"
        ry="5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <ellipse
        cx="10"
        cy="36"
        rx="3"
        ry="5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      {/* 3D cube — 10:30 */}
      <path
        d="M14 12 L18 10 L20 14 L16 16 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M16 16 V18 L20 16 V14"
        stroke="currentColor"
        strokeWidth="0.7"
        fill="none"
        opacity="0.3"
      />
      {/* center */}
      <circle cx="32" cy="32" r="2.5" fill="currentColor" opacity="0.3" />
    </>
  );
}

function TriniSpiralMark() {
  // A golden-ratio spiral with icons at each turn — growth journey
  return (
    <>
      <path
        d="M32 32 Q32 24 38 22 Q46 20 48 28 Q52 38 42 44 Q30 52 20 44 Q8 34 16 20 Q24 6 40 8 Q58 10 58 30 Q58 52 38 58"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* icons along the spiral */}
      <path
        d="M36 24 Q38 20 40 24"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <circle
        cx="46"
        cy="34"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M34 46 L36 42 L38 46 L36 50 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M18 38 Q18 42 22 42"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M20 20 Q22 16 24 20"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M44 12 L46 10 L48 14 L44 16 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      <circle cx="32" cy="32" r="2" fill="currentColor" opacity="0.4" />
    </>
  );
}

function TriniCrownServicesMark() {
  // A crown where each point is a different service icon — she's the queen of all trades
  return (
    <>
      {/* crown base */}
      <path d="M8 40 H56" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 40 V36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M56 40 V36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* crown points with service icons */}
      {/* point 1: lash */}
      <path d="M8 36 L14 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M12 20 Q14 14 16 20"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      {/* point 2: nail */}
      <path
        d="M14 18 L24 28 L26 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M24 16 Q26 10 28 16"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      {/* point 3: gem (center, tallest) */}
      <path
        d="M26 14 L32 28 L32 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M28 10 L32 4 L36 10 L32 14 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.55"
      />
      {/* point 4: earring */}
      <path
        d="M32 6 L38 28 L38 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle
        cx="40"
        cy="14"
        r="2.5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.45"
      />
      {/* point 5: hook */}
      <path
        d="M38 14 L50 28 L56 36"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M48 20 Q48 24 52 24"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      {/* base gems */}
      <circle cx="20" cy="40" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="32" cy="40" r="2.5" fill="currentColor" opacity="0.4" />
      <circle cx="44" cy="40" r="2" fill="currentColor" opacity="0.3" />
    </>
  );
}

function TriniDiamondGridMark() {
  // Diamond-shaped grid of her 6 main services — modern, balanced
  return (
    <>
      {/* lash — top */}
      <path
        d="M30 8 Q32 4 34 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M28 10 H36"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* nail — top right */}
      <path
        d="M48 18 Q50 12 52 18"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      {/* earring — right */}
      <circle
        cx="52"
        cy="34"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.55"
      />
      <circle cx="52" cy="34" r="1.5" fill="currentColor" opacity="0.3" />
      {/* hook — bottom right */}
      <path
        d="M46 48 Q46 52 50 52 Q54 52 54 48 Q54 44 50 44"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* yarn — bottom */}
      <circle
        cx="32"
        cy="54"
        r="4"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M30 52 Q32 54 34 52"
        stroke="currentColor"
        strokeWidth="0.7"
        fill="none"
        opacity="0.25"
      />
      {/* gem — bottom left */}
      <path
        d="M12 46 L16 42 L20 46 L16 52 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      {/* chain — left */}
      <ellipse
        cx="10"
        cy="30"
        rx="3"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      <ellipse
        cx="10"
        cy="38"
        rx="3"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        opacity="0.5"
      />
      {/* 3D — top left */}
      <path
        d="M14 16 L18 14 L20 18 L16 20 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.45"
      />
      <path
        d="M16 20 V22 L20 20 V18"
        stroke="currentColor"
        strokeWidth="0.7"
        fill="none"
        opacity="0.3"
      />
      {/* diamond outline connecting them all */}
      <path
        d="M32 2 L60 32 L32 62 L4 32 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.15"
      />
      {/* center dot */}
      <circle cx="32" cy="32" r="3" fill="currentColor" opacity="0.25" />
    </>
  );
}

function TriniHandHeartServicesMark() {
  // Heart shape made of ALL her product icons arranged along the outline
  return (
    <>
      {/* heart path — large */}
      <path
        d="M32 14 Q22 2 12 10 Q4 18 14 30 L32 52 L50 30 Q60 18 52 10 Q42 2 32 14"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.15"
      />
      {/* icons placed along the heart path */}
      {/* top left: lash */}
      <path
        d="M18 10 Q20 6 22 10"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M16 12 H24"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* top center: nail */}
      <path
        d="M30 8 Q32 4 34 8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* top right: earring */}
      <circle
        cx="44"
        cy="10"
        r="3"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <path d="M44 13 V15" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
      <circle cx="44" cy="16.5" r="1" fill="currentColor" opacity="0.3" />
      {/* right: gem */}
      <path
        d="M52 22 L54 18 L56 22 L54 26 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      {/* lower right: chain */}
      <ellipse
        cx="46"
        cy="36"
        rx="2.5"
        ry="4"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.45"
      />
      {/* bottom: heart center */}
      <circle cx="32" cy="42" r="2.5" fill="currentColor" opacity="0.35" />
      {/* lower left: hook */}
      <path
        d="M16 34 Q16 38 20 38 Q24 38 24 34 Q24 30 20 30"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* left: yarn */}
      <circle
        cx="8"
        cy="22"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M6 20 Q8 22 10 20"
        stroke="currentColor"
        strokeWidth="0.6"
        fill="none"
        opacity="0.25"
      />
    </>
  );
}

function TriniInitialsFlowMark() {
  // "TC" where the letters flow into each other with product accents
  return (
    <>
      {/* T — flowing */}
      <path
        d="M6 14 Q14 8 30 12 Q36 14 40 18"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22 12 Q18 28 16 42 Q14 52 10 56"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* C — flowing into it */}
      <path
        d="M56 16 Q46 10 40 18 Q34 28 36 40 Q38 50 46 54 Q52 56 58 52"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      {/* product accents scattered */}
      {/* lash near T top */}
      <path
        d="M28 8 Q30 4 32 8"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.35"
      />
      {/* gem at the join */}
      <path
        d="M38 20 L40 16 L42 20 L40 24 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      {/* hook curl at T bottom */}
      <path
        d="M10 56 Q6 58 6 54 Q6 50 10 50"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      {/* earring dot at C end */}
      <circle cx="58" cy="52" r="2" fill="currentColor" opacity="0.3" />
    </>
  );
}

function TriniSunriseMark() {
  // Sunrise with service icons as rays — new day, beauty, warmth
  return (
    <>
      {/* horizon */}
      <path
        d="M4 42 H60"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* sun half-circle */}
      <path
        d="M14 42 Q14 22 32 22 Q50 22 50 42"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* rays — each a service */}
      {/* lash */}
      <path
        d="M32 22 V8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M30 10 Q32 6 34 10"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.35"
      />
      {/* nail */}
      <path
        d="M44 24 L52 14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M50 14 Q52 10 54 14"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.35"
      />
      {/* earring */}
      <path
        d="M50 34 L58 30"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle
        cx="60"
        cy="30"
        r="2"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      {/* hook */}
      <path
        d="M14 34 L6 30"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M4 30 Q4 34 8 34"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.35"
      />
      {/* gem */}
      <path
        d="M20 24 L12 14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M10 12 L12 8 L14 12 L12 16 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      {/* warmth text area */}
      <path
        d="M16 52 H48"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.2"
      />
    </>
  );
}

function TriniPaletteBoardMark() {
  // An artist palette with her products as the "paint dots"
  return (
    <>
      <path
        d="M14 18 Q8 22 8 30 Q8 40 18 44 Q28 48 34 42 Q36 40 38 42 Q48 52 54 42 Q62 30 56 22 Q50 12 40 12 Q32 12 28 16 Q20 14 14 18 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <circle
        cx="34"
        cy="42"
        r="4"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.35"
      />
      {/* "paint dots" = her products */}
      {/* lash dot */}
      <path
        d="M18 24 Q20 20 22 24"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* gem dot */}
      <path
        d="M30 18 L32 14 L34 18 L32 22 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.5"
      />
      {/* nail dot */}
      <path
        d="M42 16 Q44 12 46 16"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      {/* earring dot */}
      <circle
        cx="50"
        cy="24"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <circle cx="50" cy="24" r="1" fill="currentColor" opacity="0.3" />
      {/* yarn dot */}
      <circle
        cx="18"
        cy="34"
        r="3"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      {/* hook */}
      <path
        d="M44 32 Q44 36 48 36"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function TriniBookOpenMark() {
  // Open book/portfolio showing her services — teacher + maker
  return (
    <>
      <path
        d="M4 12 Q4 8 10 8 L32 14 V56 L10 50 Q4 48 4 44 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M60 12 Q60 8 54 8 L32 14 V56 L54 50 Q60 48 60 44 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <path d="M32 14 V56" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      {/* left page: her products */}
      <path
        d="M10 22 Q12 18 14 22"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      <circle
        cx="20"
        cy="24"
        r="2.5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M10 32 L12 28 L14 32 L12 36 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M20 32 Q20 36 24 36"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.35"
      />
      {/* right page: teaching */}
      <circle
        cx="42"
        cy="22"
        r="3"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M38 28 Q38 32 42 32 Q46 32 46 28"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.35"
      />
      <circle cx="38" cy="38" r="2" fill="currentColor" opacity="0.2" />
      <circle cx="46" cy="38" r="2" fill="currentColor" opacity="0.2" />
      <circle cx="42" cy="42" r="2" fill="currentColor" opacity="0.2" />
    </>
  );
}

function TriniInfinityLoopMark() {
  // Infinity loop with products flowing through it — endless creativity
  return (
    <>
      <path
        d="M32 32 Q22 18 14 20 Q6 22 6 32 Q6 42 14 44 Q22 46 32 32 Q42 18 50 20 Q58 22 58 32 Q58 42 50 44 Q42 46 32 32"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* products along the loop */}
      <path
        d="M12 26 Q14 22 16 26"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
      <circle
        cx="12"
        cy="38"
        r="2"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M50 24 L52 20 L54 24 L52 28 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M48 38 Q48 42 52 42"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />
      <circle cx="32" cy="32" r="2.5" fill="currentColor" opacity="0.35" />
    </>
  );
}

// ── Preview tile ──────────────────────────────────────────────────────────────

function Preview({
  bg,
  color,
  children,
}: {
  bg: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: 76,
        height: 76,
        borderRadius: 14,
        background: bg,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
      }}
    >
      <svg width="54" height="54" viewBox="0 0 64 64" fill="none">
        {children}
      </svg>
    </div>
  );
}

// ── Logo catalog ──────────────────────────────────────────────────────────────

const logos: {
  id: string;
  name: string;
  tagline: string;
  description: string;
  mark: React.ReactNode;
  group: Group;
}[] = [
  // LASH
  {
    id: "lash-line",
    name: "Lash Line",
    tagline: "Refined original",
    group: "Lash",
    description:
      "Five curved lashes fan from the T crossbar with a 4-pt sparkle. The signature mark.",
    mark: <LashLineMark />,
  },
  {
    id: "the-eye",
    name: "The Eye",
    tagline: "Almond eye",
    group: "Lash",
    description:
      "T crossbar becomes a full almond eye with iris, pupil, and five lashes. Unmistakably lash.",
    mark: <EyeMark />,
  },
  {
    id: "wand",
    name: "Wand",
    tagline: "Lash applicator",
    group: "Lash",
    description: "T crossbar is a lash brush ferrule — bristle ticks fan upward. Tool-coded.",
    mark: <WandMark />,
  },
  {
    id: "volume-fan",
    name: "Volume Fan",
    tagline: "Volume set",
    group: "Lash",
    description: "13 curved lashes in a dense semicircle fan — center longest, outer lashes fade.",
    mark: <VolumeFanMark />,
  },
  {
    id: "mirror",
    name: "Mirror",
    tagline: "Beauty tool",
    group: "Lash",
    description: "Oval mirror frame at top, T stem as handle. A sparkle reflects in the glass.",
    mark: <MirrorMark />,
  },
  {
    id: "lash-strip",
    name: "Lash Strip",
    tagline: "Band of lashes",
    group: "Lash",
    description:
      "Seven curved lashes arc upward from a band — the classic strip lash in mark form.",
    mark: <StripLashMark />,
  },
  {
    id: "tweezers",
    name: "Tweezers",
    tagline: "Precision tool",
    group: "Lash",
    description:
      "Two prongs meet at a point, holding a single curved fiber. Precision and technique.",
    mark: <TweezersLashMark />,
  },
  {
    id: "sweep",
    name: "Sweep",
    tagline: "Single curl",
    group: "Lash",
    description: "One long dramatic lash sweeps across the full T — a single statement curl.",
    mark: <SweepLashMark />,
  },
  {
    id: "feather",
    name: "Feather",
    tagline: "Soft plume",
    group: "Lash",
    description: "Feather-shaped mark with pointed tip and symmetric barbs. Soft, airy, luxe.",
    mark: <FeatherLashMark />,
  },
  {
    id: "lash-comb",
    name: "Lash Comb",
    tagline: "Mascara wand",
    group: "Lash",
    description: "A mascara wand tube with upward bristles above the crossbar. Tool-forward.",
    mark: <LashCombMark />,
  },

  // JEWELRY
  {
    id: "gem-pendant",
    name: "Gem Pendant",
    tagline: "Diamond drop",
    group: "Jewelry",
    description: "Clean minimal T with a faceted diamond drop on the stem. Restrained luxury.",
    mark: <GemPendantMark />,
  },
  {
    id: "linked",
    name: "Linked",
    tagline: "Chain mark",
    group: "Jewelry",
    description: "T letterform built entirely from oval chain links. Textural, handcrafted.",
    mark: <LinkedMark />,
  },
  {
    id: "briolette",
    name: "Briolette",
    tagline: "Teardrop gem",
    group: "Jewelry",
    description: "Minimal T with a faceted briolette gem on a chain connector.",
    mark: <BrioletteMark />,
  },
  {
    id: "constellation",
    name: "Gem Drop",
    tagline: "Pearl strand",
    group: "Jewelry",
    description:
      "T implied by graduated circles — largest at center, fading outward. Pearls, gems, drops.",
    mark: <ConstellationMark />,
  },
  {
    id: "radiant",
    name: "Radiant",
    tagline: "Welding spark",
    group: "Jewelry",
    description: "12 rays burst from the T junction — references the spark of a jewelry welder.",
    mark: <RadiantMark />,
  },
  {
    id: "pearled",
    name: "Pearled",
    tagline: "Bead strand",
    group: "Jewelry",
    description:
      "Crossbar strung with pearl circles, largest at center. A single bead on the stem.",
    mark: <PearledMark />,
  },
  {
    id: "double-gem",
    name: "Double Gem",
    tagline: "Multi-drop",
    group: "Jewelry",
    description: "Three gem drops from the crossbar — small at ends, large at center.",
    mark: <DoubleGemMark />,
  },
  {
    id: "rope",
    name: "Rope Twist",
    tagline: "Twisted strand",
    group: "Jewelry",
    description: "Crossbar is a two-strand twisted rope with knot finials. Chain meets craft.",
    mark: <RopeMark />,
  },
  {
    id: "bangle",
    name: "Bangle",
    tagline: "Open bangle",
    group: "Jewelry",
    description:
      "Bold circle bangle with a small clasp gap at top, stem dropping below. Simple, timeless.",
    mark: <BangleMark />,
  },
  {
    id: "welded-rings",
    name: "Welded Rings",
    tagline: "Two rings joined",
    group: "Jewelry",
    description:
      "Two interlocking rings fused at the center — the welded permanent jewelry process.",
    mark: <WeldedRingsMark />,
  },
  {
    id: "earring-drop",
    name: "Drop Earring",
    tagline: "Classic drop",
    group: "Jewelry",
    description:
      "Stud post with a faceted drop hanging from a fine wire. Clean fine jewelry reference.",
    mark: <EarringMark />,
  },
  {
    id: "infinity-chain",
    name: "Infinity Chain",
    tagline: "Eternal link",
    group: "Jewelry",
    description: "The ∞ infinity symbol drawn as a smooth chain, anchored by two end nodes.",
    mark: <InfinityChainMark />,
  },
  {
    id: "collar-necklace",
    name: "Collar",
    tagline: "Statement necklace",
    group: "Jewelry",
    description: "U-shaped collar necklace with three chain nodes and a central drop pendant.",
    mark: <CollarNecklaceMark />,
  },

  // CROCHET
  {
    id: "hook",
    name: "Hook",
    tagline: "Crochet hook",
    group: "Crochet",
    description: "Crossbar is the grip; stem curves into a hook at the bottom. Personal and warm.",
    mark: <HookMark />,
  },
  {
    id: "tassel",
    name: "Tassel",
    tagline: "Fringe",
    group: "Crochet",
    description: "T sits at top; seven hanging fringe strands release below. Fashion-craft coded.",
    mark: <TasselMark />,
  },
  {
    id: "knotted",
    name: "Knotted",
    tagline: "Lace knot",
    group: "Crochet",
    description: "T crossbar and stem interweave at the junction forming a Celtic-inspired loop.",
    mark: <KnottedMark />,
  },
  {
    id: "weave",
    name: "Weave",
    tagline: "Textile band",
    group: "Crochet",
    description:
      "T strokes are woven ribbon bands with filled planes and overlay dots. Fabric texture.",
    mark: <WeaveMark />,
  },
  {
    id: "yarn",
    name: "Yarn Ball",
    tagline: "Crochet yarn",
    group: "Crochet",
    description: "Yarn ball circle with curved strand lines and a thread tail. Unmistakably craft.",
    mark: <YarnMark />,
  },
  {
    id: "double-loop",
    name: "Double Loop",
    tagline: "Slip stitch",
    group: "Crochet",
    description: "Both crossbar ends curl back in yarn loops. Instantly crochet-coded.",
    mark: <DoubleLoopMark />,
  },
  {
    id: "needle",
    name: "Needle & Thread",
    tagline: "Craft precision",
    group: "Crochet",
    description: "T stem narrows to a needle point; thread loops through the eye at the crossbar.",
    mark: <NeedleMark />,
  },
  {
    id: "v-stitch",
    name: "V Stitch",
    tagline: "Chevron pattern",
    group: "Crochet",
    description: "Rows of V/chevron stitches fill the grid — the most recognisable crochet stitch.",
    mark: <VStitchMark />,
  },
  {
    id: "crochet-flower",
    name: "Loop Flower",
    tagline: "6-petal loop",
    group: "Crochet",
    description: "Six oval loops radiate from the center, forming a handmade crochet flower motif.",
    mark: <CrochetFlowerMark />,
  },
  {
    id: "pom-pom",
    name: "Pom Pom",
    tagline: "Fluffy ball",
    group: "Crochet",
    description: "Organic fluffy outline with an inner circle and tie stem. Soft and playful.",
    mark: <PomPomMark />,
  },
  {
    id: "granny-square",
    name: "Granny Square",
    tagline: "Classic motif",
    group: "Crochet",
    description: "The iconic granny square frame with corner petals and a center bloom detail.",
    mark: <GrannySquareMark />,
  },

  // TRAINING
  {
    id: "mortarboard",
    name: "Mortarboard",
    tagline: "Graduation cap",
    group: "Training",
    description:
      "Diamond mortarboard viewed from above — cap shape + tassel cord + T stem. Education first.",
    mark: <MortarboardMark />,
  },
  {
    id: "open-book",
    name: "Open Book",
    tagline: "Knowledge",
    group: "Training",
    description:
      "Two open book pages spread wide; spine doubles as T center. Text lines suggest curriculum.",
    mark: <OpenBookMark />,
  },
  {
    id: "pencil",
    name: "Pencil",
    tagline: "Learning tool",
    group: "Training",
    description: "T crossbar is a pencil body — eraser left, sharpened tip right.",
    mark: <PencilMark />,
  },
  {
    id: "scroll",
    name: "Certificate",
    tagline: "Diploma",
    group: "Training",
    description: "Rolled scroll with T on the face and a wax seal dot. Credential and achievement.",
    mark: <ScrollMark />,
  },
  {
    id: "award",
    name: "Award",
    tagline: "Merit badge",
    group: "Training",
    description:
      "Circular badge with ribbon tails, star at top, T inside. Achievement and recognition.",
    mark: <AwardMark />,
  },
  {
    id: "clipboard",
    name: "Clipboard",
    tagline: "Checklist & goals",
    group: "Training",
    description:
      "Clipboard with clip at top, a check mark, and ruled lines below. Structured and clear.",
    mark: <ClipboardMark />,
  },
  {
    id: "medal-ribbon",
    name: "Medal",
    tagline: "Achievement",
    group: "Training",
    description: "V ribbon above, circular medal below with T centered inside. Honour and mastery.",
    mark: <MedalRibbonMark />,
  },
  {
    id: "chalkboard",
    name: "Chalkboard",
    tagline: "Classroom",
    group: "Training",
    description: "Rectangular board with T chalked on the face and a chalk tray. Teaching space.",
    mark: <ChalkboardMark />,
  },

  // CONSULTING
  {
    id: "compass",
    name: "Compass",
    tagline: "Direction",
    group: "Consulting",
    description:
      "T crossbar = E-W arm, stem = S. A bold needle points north. Direction and clarity.",
    mark: <CompassMark />,
  },
  {
    id: "target",
    name: "Target",
    tagline: "Bullseye",
    group: "Consulting",
    description: "T crosshair on a three-ring bullseye. Precision, focus, and outcomes.",
    mark: <TargetMark />,
  },
  {
    id: "chart",
    name: "Bar Chart",
    tagline: "Growth metrics",
    group: "Consulting",
    description: "Four rising bars on a baseline. Tallest gets a star. Growth and momentum.",
    mark: <ChartMark />,
  },
  {
    id: "speech",
    name: "Speech",
    tagline: "Advisory voice",
    group: "Consulting",
    description: "T inside a chat bubble with a tail. Communication, advisory, dialogue.",
    mark: <SpeechMark />,
  },
  {
    id: "lightbulb",
    name: "Lightbulb",
    tagline: "Ideas & insight",
    group: "Consulting",
    description: "T filament inside a bulb. Insight, creativity, problem-solving.",
    mark: <LightbulbMark />,
  },
  {
    id: "roadmap",
    name: "Roadmap",
    tagline: "Strategy path",
    group: "Consulting",
    description: "Three milestone nodes on a rising dotted path. The journey from start to goal.",
    mark: <RoadmapMark />,
  },
  {
    id: "presentation",
    name: "Presentation",
    tagline: "Easel chart",
    group: "Consulting",
    description: "Easel frame with a rising bar chart on the board. Strategy and results.",
    mark: <PresentationMark />,
  },
  {
    id: "key",
    name: "Key",
    tagline: "Unlock potential",
    group: "Consulting",
    description: "Round-bow key with a double-notch blade. Unlocking opportunities and access.",
    mark: <KeyMark />,
  },
  {
    id: "network-nodes",
    name: "Network",
    tagline: "Connected",
    group: "Consulting",
    description: "Five nodes in a tree network, root at top. Community, referral, and connection.",
    mark: <NodeNetworkMark />,
  },

  // LUXURY
  {
    id: "crown",
    name: "Crown",
    tagline: "Studio royalty",
    group: "Luxury",
    description: "Three gem-tipped V-peaks from the crossbar. Crown echoes a lash fan.",
    mark: <CrownMark />,
  },
  {
    id: "seal",
    name: "Wax Seal",
    tagline: "Stamp mark",
    group: "Luxury",
    description:
      "Double concentric circles with T embossed — clean round stamp. Boutique and official.",
    mark: <SealMark />,
  },
  {
    id: "monogram",
    name: "TC Monogram",
    tagline: "Initials",
    group: "Luxury",
    description: "T and C interlock with a gem sparkle at their overlap. Both founder and studio.",
    mark: <MonogramMark />,
  },
  {
    id: "arch",
    name: "Arch",
    tagline: "Studio doorway",
    group: "Luxury",
    description: "T inside a boutique arch — the doorway to the studio. Place-coded luxury.",
    mark: <ArchMark />,
  },
  {
    id: "bow",
    name: "Bow",
    tagline: "Gift ribbon",
    group: "Luxury",
    description: "Two loops tied at a center knot. The universal mark of something precious.",
    mark: <BowMark />,
  },
  {
    id: "cameo",
    name: "Cameo",
    tagline: "Portrait oval",
    group: "Luxury",
    description: "Oval brooch frame with inner border and a profile silhouette. Vintage fine art.",
    mark: <CameoMark />,
  },
  {
    id: "lace",
    name: "Lace Edge",
    tagline: "Delicate trim",
    group: "Luxury",
    description: "Two rows of scalloped lace with eyelet holes between. Delicate and bridal.",
    mark: <LaceMark />,
  },
  {
    id: "ribbon-badge",
    name: "Ribbon Badge",
    tagline: "Rosette",
    group: "Luxury",
    description: "Circular rosette with V-cut ribbon tails. Premium, award, prestige.",
    mark: <RibbonBadgeMark />,
  },

  // CREATIVE
  {
    id: "bloom",
    name: "Bloom",
    tagline: "Botanical",
    group: "Creative",
    description: "Teardrop leaves cap the crossbar ends; paired leaves branch from stem.",
    mark: <BloomMark />,
  },
  {
    id: "script",
    name: "Script",
    tagline: "Calligraphic",
    group: "Creative",
    description: "Single flowing monoline T with entry swash and exit serif. Editorial.",
    mark: <ScriptMark />,
  },
  {
    id: "palette",
    name: "Palette",
    tagline: "Artist's palette",
    group: "Creative",
    description: "A paint palette with thumb hole and four color dots. Art meets beauty.",
    mark: <PaletteMark />,
  },
  {
    id: "brush",
    name: "Paintbrush",
    tagline: "Creative stroke",
    group: "Creative",
    description:
      "Angled brush with ferrule band and soft bristle tip. Where creativity meets craft.",
    mark: <BrushMark />,
  },
  {
    id: "floral",
    name: "Floral T",
    tagline: "Botanical leaves",
    group: "Creative",
    description: "T crossbar with leaf forms at each end, small bud at top, side leaves on stem.",
    mark: <FloralMark />,
  },
  {
    id: "butterfly",
    name: "Butterfly",
    tagline: "Transformation",
    group: "Creative",
    description:
      "Four wings open above the crossbar. Antennae rise from the body. Growth and change.",
    mark: <ButterflyMark />,
  },

  // WARM LASH (no tombstone/eye shapes)
  {
    id: "lash-heart",
    name: "Lash Heart",
    tagline: "Love + lashes",
    group: "Lash",
    description:
      "Two lash fans curve inward to form a heart. Warmth meets beauty — unmistakably lash without the evil eye.",
    mark: <LashHeartMark />,
  },
  {
    id: "lash-curl",
    name: "Lash Circle",
    tagline: "Beauty badge",
    group: "Lash",
    description:
      "Five curved lashes inside a soft circle — reads as a beauty badge, not a cross. Clean and modern.",
    mark: <LashCurlMark />,
  },
  {
    id: "lash-wisp",
    name: "Lash Wisp",
    tagline: "Flowing lashes",
    group: "Lash",
    description: "Lashes flow along a gentle wave instead of a flat bar. Airy, soft, and natural.",
    mark: <LashWispMark />,
  },
  {
    id: "lash-brush",
    name: "Lash Arch",
    tagline: "Soft arch",
    group: "Lash",
    description:
      "Lashes fan from a curved arch instead of a flat crossbar. Feels like a brow, not a tombstone.",
    mark: <LashBrushStrokeMark />,
  },

  // WARM JEWELRY
  {
    id: "stacked-rings",
    name: "Stacked Rings",
    tagline: "Ring stack",
    group: "Jewelry",
    description:
      "Three stacked elliptical rings — largest in the middle. Clean permanent jewelry reference.",
    mark: <StackedRingsMark />,
  },
  {
    id: "charm-bracelet",
    name: "Charm Bracelet",
    tagline: "Bracelet + charms",
    group: "Jewelry",
    description:
      "An arc bracelet with three dangling charms — a circle, a gem, and a circle. Playful and personal.",
    mark: <CharmBraceletMark />,
  },
  {
    id: "hoop-earring",
    name: "Hoop",
    tagline: "Statement hoop",
    group: "Jewelry",
    description: "Bold hoop earring with bead accents and a stud post. Modern, clean, wearable.",
    mark: <HoopEarringMark />,
  },
  {
    id: "heart-pendant",
    name: "Heart Pendant",
    tagline: "Chain + heart",
    group: "Jewelry",
    description:
      "A heart pendant hanging from a delicate chain. The most universally warm jewelry mark.",
    mark: <HeartPendantMark />,
  },

  // WARM CROCHET
  {
    id: "cozy-heart",
    name: "Cozy Heart",
    tagline: "Stitched heart",
    group: "Crochet",
    description:
      "Heart outlined in a dashed stitch pattern — like it was crocheted. Warm and handmade.",
    mark: <CozyHeartMark />,
  },
  {
    id: "yarn-bow",
    name: "Yarn Bow",
    tagline: "Handmade bow",
    group: "Crochet",
    description: "A cute yarn bow with trailing ends. Soft, gift-like, handmade feel.",
    mark: <YarnBowMark />,
  },
  {
    id: "blanket-fold",
    name: "Blanket",
    tagline: "Cozy fold",
    group: "Crochet",
    description: "A folded blanket/scarf with gentle wave texture. Cozy, warm, and inviting.",
    mark: <BlanketFoldMark />,
  },
  {
    id: "heart-hook",
    name: "Heart Hook",
    tagline: "Hook + heart",
    group: "Crochet",
    description: "A crochet hook curves out of a heart shape — where craft meets love.",
    mark: <CrochetHeartHookMark />,
  },

  // WARM TRAINING
  {
    id: "sprout",
    name: "Sprout",
    tagline: "Growth",
    group: "Training",
    description:
      "A growing sprout with two leaves — nurturing, growth, new skills. Warm alternative to a mortarboard.",
    mark: <SproutMark />,
  },
  {
    id: "hands-heart",
    name: "Giving Hands",
    tagline: "Teaching + care",
    group: "Training",
    description: "Two cupped hands forming a heart-like space. Teaching, giving, and community.",
    mark: <HandsHeartMark />,
  },
  {
    id: "guiding-star",
    name: "Guiding Circle",
    tagline: "Friendly guide",
    group: "Training",
    description:
      "A soft star inside a double circle — reads as a badge of guidance, not occult. Friendly and trustworthy.",
    mark: <GuidingStarMark />,
  },
  {
    id: "stepping-stone",
    name: "Stepping Stones",
    tagline: "Progress path",
    group: "Training",
    description:
      "Three ascending oval stones with a dotted path. Progress without the corporate bar chart.",
    mark: <SteppingStoneMark />,
  },

  // WARM CREATIVE / MULTI-SERVICE
  {
    id: "circle-monogram",
    name: "TC Circle",
    tagline: "Monogram badge",
    group: "Creative",
    description:
      "T and C initials inside a clean double circle. The simplest, most versatile brand mark.",
    mark: <CircleMonogramMark />,
  },
  {
    id: "wreath",
    name: "Leaf Wreath",
    tagline: "Artisan wreath",
    group: "Creative",
    description: "A wreath of small leaf loops surrounds a centered T. Artisan, organic, handmade.",
    mark: <WreathMark />,
  },
  {
    id: "soft-badge",
    name: "Soft Badge",
    tagline: "Shield mark",
    group: "Creative",
    description: "Rounded shield with T inside — premium but warm. Works as a trust/quality badge.",
    mark: <SoftBadgeMark />,
  },
  {
    id: "heart-badge",
    name: "Heart Badge",
    tagline: "T in a heart",
    group: "Creative",
    description:
      "The T nestled inside a heart. The warmest, most approachable brand mark possible.",
    mark: <HeartBadgeMark />,
  },

  // BATCH 2 — LASH
  {
    id: "lash-crescent",
    name: "Crescent Lash",
    tagline: "Moon lashes",
    group: "Lash",
    description:
      "Lashes sweep along a crescent moon shape. Soft, feminine, nighttime beauty vibes.",
    mark: <LashCrescentMark />,
  },
  {
    id: "lash-butterfly",
    name: "Lash Wings",
    tagline: "Butterfly lashes",
    group: "Lash",
    description: "Lash fans shaped like butterfly wings with wispy details. Playful and pretty.",
    mark: <LashButterflyMark />,
  },
  {
    id: "lash-bouquet",
    name: "Lash Bouquet",
    tagline: "Beauty bouquet",
    group: "Lash",
    description:
      "Five lashes arranged like a wrapped flower bouquet with trailing ribbon. Beauty meets botanical.",
    mark: <LashBouquetMark />,
  },
  {
    id: "lash-tiara",
    name: "Lash Tiara",
    tagline: "Regal lashes",
    group: "Lash",
    description:
      "Lashes rise from a tiara-shaped arc with gem dots at the tips. Regal beauty queen energy.",
    mark: <LashTiaraMark />,
  },

  // BATCH 2 — JEWELRY
  {
    id: "pearl-strand",
    name: "Pearl Strand",
    tagline: "Graduated pearls",
    group: "Jewelry",
    description: "A string of graduated pearls draped in a classic arc. Timeless and elegant.",
    mark: <PearlStrandMark />,
  },
  {
    id: "solitaire",
    name: "Solitaire",
    tagline: "Prong setting",
    group: "Jewelry",
    description:
      "A single faceted gem in a three-prong setting. The classic engagement ring / fine jewelry reference.",
    mark: <SolitaireMark />,
  },
  {
    id: "toggle-clasp",
    name: "Toggle Clasp",
    tagline: "Permanent closure",
    group: "Jewelry",
    description:
      "A circle-and-bar toggle clasp — the closure used in permanent jewelry. Industry-specific.",
    mark: <ToggleClaspMark />,
  },
  {
    id: "layered-necklace",
    name: "Layered",
    tagline: "Double chain",
    group: "Jewelry",
    description:
      "Two necklaces at different lengths — shorter with a bead, longer with a gem drop. Trendy and modern.",
    mark: <LayeredNecklaceMark />,
  },
  {
    id: "anklet",
    name: "Anklet",
    tagline: "Dainty chain",
    group: "Jewelry",
    description:
      "A delicate draped chain with small bead accents and a tiny charm. Feminine and dainty.",
    mark: <AnkletMark />,
  },

  // BATCH 2 — CROCHET
  {
    id: "beanie",
    name: "Beanie",
    tagline: "Cozy hat",
    group: "Crochet",
    description:
      "A crochet beanie with ribbed brim and fluffy pom pom on top. Cozy and instantly recognizable.",
    mark: <BeanieMark />,
  },
  {
    id: "scallop-edge",
    name: "Scallop Edge",
    tagline: "Crochet border",
    group: "Crochet",
    description:
      "Double row of classic crochet scallops — the iconic border stitch. Unmistakably handmade.",
    mark: <ScallopEdgeMark />,
  },
  {
    id: "amigurumi",
    name: "Amigurumi",
    tagline: "Cute creature",
    group: "Crochet",
    description:
      "A round crocheted character with little ears and a sweet smile. Playful and loveable.",
    mark: <AmigurumiMark />,
  },
  {
    id: "chain-stitch",
    name: "Chain Stitch",
    tagline: "Foundation chain",
    group: "Crochet",
    description: "Interlocking oval loops forming a T shape — the most fundamental crochet stitch.",
    mark: <ChainStitchMark />,
  },

  // BATCH 2 — TRAINING
  {
    id: "nest",
    name: "Nest",
    tagline: "Nurturing space",
    group: "Training",
    description:
      "A woven bird's nest with three eggs. Nurturing, safe learning, growing new skills.",
    mark: <NestMark />,
  },
  {
    id: "torch",
    name: "Torch",
    tagline: "Pass the flame",
    group: "Training",
    description: "A torch with a warm flame — passing knowledge and lighting the way forward.",
    mark: <TorchMark />,
  },
  {
    id: "rising-balloons",
    name: "Balloons",
    tagline: "Celebration",
    group: "Training",
    description:
      "Three balloons rising up with trailing strings. Celebration, uplift, and achievement.",
    mark: <RisingBalloonsMark />,
  },
  {
    id: "ladder",
    name: "Ladder",
    tagline: "Level up",
    group: "Training",
    description:
      "A simple ladder with rungs and a dot at the top. Climbing, skill-building, leveling up.",
    mark: <LadderMark />,
  },

  // BATCH 2 — LUXURY
  {
    id: "perfume-bottle",
    name: "Perfume",
    tagline: "Luxury beauty",
    group: "Luxury",
    description:
      "An elegant perfume bottle with stopper, neck, and a liquid fill line. Luxury beauty.",
    mark: <PerfumeBottleMark />,
  },
  {
    id: "diamond-frame",
    name: "Diamond Frame",
    tagline: "Elegant frame",
    group: "Luxury",
    description: "T centered inside a double diamond/rhombus frame. Geometric elegance.",
    mark: <DiamondFrameMark />,
  },
  {
    id: "ribbon-curl",
    name: "Ribbon Curl",
    tagline: "Gift ribbon",
    group: "Luxury",
    description:
      "Three curling ribbons flowing across with a center knot. Premium gift wrapping energy.",
    mark: <RibbonCurlMark />,
  },
  {
    id: "feather-quill",
    name: "Quill",
    tagline: "Artisan craft",
    group: "Luxury",
    description:
      "A feather quill with barb details inside a circle. Artisan craftsmanship and fine detail.",
    mark: <FeatherQuillMark />,
  },

  // BATCH 3 — LASH
  {
    id: "lash-pillow",
    name: "Lash Pillow",
    tagline: "Beauty sleep",
    group: "Lash",
    description:
      "Lashes resting on a soft pillow shape. Beauty sleep vibes — gentle, nurturing, restful.",
    mark: <LashPillowMark />,
  },
  {
    id: "lash-sparkle",
    name: "Lash Sparkle",
    tagline: "Glam night",
    group: "Lash",
    description:
      "Lashes rising from a soft curve with scattered sparkle dots. Glam night out energy.",
    mark: <LashSparkleMark />,
  },
  {
    id: "lash-bloom",
    name: "Lash Bloom",
    tagline: "Petal fan",
    group: "Lash",
    description:
      "Lashes radiating outward like opening flower petals from a center circle. Beauty meets botanical.",
    mark: <LashBloomMark />,
  },
  {
    id: "lash-ribbon",
    name: "Lash Ribbon",
    tagline: "Flowing ribbon",
    group: "Lash",
    description:
      "Lashes flowing upward from a curving ribbon band with soft curled ends. Movement and grace.",
    mark: <LashRibbonMark />,
  },

  // BATCH 3 — JEWELRY
  {
    id: "signet-ring",
    name: "Signet Ring",
    tagline: "Personalized ring",
    group: "Jewelry",
    description:
      "A bold ring with a flat face embossed with T. Heirloom, personalized, statement piece.",
    mark: <SignetRingMark />,
  },
  {
    id: "cuff-bracelet",
    name: "Cuff",
    tagline: "Bold cuff",
    group: "Jewelry",
    description: "An open cuff bracelet with clean lines. Bold, modern, sculptural jewelry.",
    mark: <CuffBraceletMark />,
  },
  {
    id: "gem-cluster",
    name: "Gem Cluster",
    tagline: "Sparkle cluster",
    group: "Jewelry",
    description:
      "Multiple small gems clustered together in varying sizes. Sparkle, abundance, and richness.",
    mark: <GemClusterMark />,
  },
  {
    id: "tennis-bracelet",
    name: "Tennis Bracelet",
    tagline: "Diamond line",
    group: "Jewelry",
    description:
      "A curved line of small diamond shapes — the classic tennis bracelet. Timeless luxury.",
    mark: <TennisBraceletMark />,
  },

  // BATCH 3 — CROCHET
  {
    id: "basket",
    name: "Basket",
    tagline: "Woven basket",
    group: "Crochet",
    description: "A woven basket with handle and crosshatch texture. Handmade, useful, warm.",
    mark: <BasketMark />,
  },
  {
    id: "scrunchie",
    name: "Scrunchie",
    tagline: "Hair accessory",
    group: "Crochet",
    description:
      "A ruffled crochet scrunchie — a circle of gathered scallop loops. Cute and wearable.",
    mark: <ScrunchieMark />,
  },
  {
    id: "baby-bootie",
    name: "Baby Bootie",
    tagline: "Tiny shoe",
    group: "Crochet",
    description:
      "A tiny crochet baby shoe with lace detail. The quintessential handmade baby gift.",
    mark: <BabyBootieMark />,
  },
  {
    id: "mandala",
    name: "Mandala",
    tagline: "Circle pattern",
    group: "Crochet",
    description:
      "Concentric circles with radiating spokes and decorative dots. Meditative crochet artistry.",
    mark: <MandalaMark />,
  },

  // BATCH 3 — TRAINING
  {
    id: "puzzle-piece",
    name: "Puzzle",
    tagline: "Fit together",
    group: "Training",
    description:
      "An interlocking puzzle piece with T inside. Knowledge fitting together, problem solving.",
    mark: <PuzzlePieceMark />,
  },
  {
    id: "seedling-tree",
    name: "Growth Stages",
    tagline: "Seed to tree",
    group: "Training",
    description:
      "Three stages — seed, sprout, small tree — on a ground line. The full growth journey.",
    mark: <SeedlingTreeMark />,
  },
  {
    id: "warm-compass",
    name: "Compass Rose",
    tagline: "Find your way",
    group: "Training",
    description:
      "A soft compass with gentle directional arrows. Finding your way — warm and guiding.",
    mark: <WarmCompassMark />,
  },
  {
    id: "garden-gate",
    name: "Garden Gate",
    tagline: "Open door",
    group: "Training",
    description:
      "An arched garden gate with vertical bars. Opening doors, welcoming, inviting entry.",
    mark: <GardenGateMark />,
  },

  // BATCH 3 — LUXURY
  {
    id: "vanity-mirror",
    name: "Vanity Mirror",
    tagline: "Beauty station",
    group: "Luxury",
    description:
      "A round vanity mirror on a curved stand. The beauty station, self-care and reflection.",
    mark: <VanityMirrorMark />,
  },
  {
    id: "chandelier",
    name: "Chandelier",
    tagline: "Elegant drops",
    group: "Luxury",
    description: "An elegant chandelier with three hanging gem drops. Dripping in luxury.",
    mark: <ChandelierMark />,
  },
  {
    id: "gift-box",
    name: "Gift Box",
    tagline: "Wrapped present",
    group: "Luxury",
    description:
      "A wrapped gift box with a bow on top. Special, premium, the feeling of unwrapping something precious.",
    mark: <GiftBoxMark />,
  },
  {
    id: "ornate-frame",
    name: "Ornate Frame",
    tagline: "Gallery frame",
    group: "Luxury",
    description:
      "A rounded rectangle frame with corner flourishes. Gallery-worthy, curated, fine art.",
    mark: <OrnateFrameMark />,
  },

  // BATCH 3 — CREATIVE
  {
    id: "scissors",
    name: "Scissors",
    tagline: "Craft scissors",
    group: "Creative",
    description:
      "Decorative scissors with finger loops and crossed blades. The universal craft tool.",
    mark: <ScissorsMark />,
  },
  {
    id: "thread-spool",
    name: "Thread Spool",
    tagline: "Spool of thread",
    group: "Creative",
    description:
      "A thread spool with wrap lines and a trailing thread tail. The foundation of every craft.",
    mark: <ThreadSpoolMark />,
  },
  {
    id: "rainbow-arc",
    name: "Rainbow",
    tagline: "Joyful arcs",
    group: "Creative",
    description: "Three nested arcs of decreasing size. Colorful, creative, and joyful.",
    mark: <RainbowArcMark />,
  },
  {
    id: "mosaic",
    name: "Mosaic",
    tagline: "Tile pattern",
    group: "Creative",
    description:
      "Small rounded tiles arranged in a T pattern. Handcrafted mosaic — every piece matters.",
    mark: <MosaicMark />,
  },

  // BATCH 4 — TRINI BRAND (no cross/religious shapes)
  {
    id: "trini-lips",
    name: "Lips",
    tagline: "Beauty + confidence",
    group: "Trini",
    description:
      "A feminine lips silhouette. Beauty, confidence, and self-expression — no crosses, no ambiguity.",
    mark: <TriniLipsMark />,
  },
  {
    id: "trini-hand",
    name: "Giving Hand",
    tagline: "Create + teach",
    group: "Trini",
    description:
      "An open hand with a small heart in the palm. Creating, teaching, and giving — everything Trini does.",
    mark: <TriniHandMark />,
  },
  {
    id: "trini-profile",
    name: "Profile",
    tagline: "Beauty silhouette",
    group: "Trini",
    description:
      "A feminine face profile with lash detail and an earring. Elegance, beauty, and personal style.",
    mark: <TriniProfileMark />,
  },
  {
    id: "trini-tools",
    name: "Tool Fan",
    tagline: "All her crafts",
    group: "Trini",
    description:
      "Lash wand, crochet hook, and gem arranged in a fan from a wrapped base. All of Trini's services in one mark.",
    mark: <TriniMultiToolMark />,
  },
  {
    id: "trini-badge",
    name: "Trini Badge",
    tagline: "Multi-service",
    group: "Trini",
    description:
      "Circle badge with lash, gem, and hook icons around a flowing script T. All her services in a clean badge.",
    mark: <TriniCircleBadgeMark />,
  },
  {
    id: "trini-script",
    name: "Script T",
    tagline: "Flowing letter",
    group: "Trini",
    description:
      "A single flowing calligraphic T with entry swash and exit curl. NOT a cross — clearly a letter.",
    mark: <TriniScriptMark />,
  },
  {
    id: "trini-cursive",
    name: "Trini Cursive",
    tagline: "Name as logo",
    group: "Trini",
    description:
      "The name 'Trini' written in a continuous cursive stroke with a flourish tail. Her name IS the logo.",
    mark: <TriniCursiveMark />,
  },
  {
    id: "trini-monogram",
    name: "TC Rounded",
    tagline: "Soft monogram",
    group: "Trini",
    description:
      "T and C intertwined inside a circle — the T is a curved script, NOT a rigid cross. Soft and personal.",
    mark: <TriniMonogramMark />,
  },

  // BATCH 4 — LASH (no cross)
  {
    id: "lash-wand-close",
    name: "Lash Wand",
    tagline: "Applicator close-up",
    group: "Lash",
    description:
      "Close-up of a mascara wand with bristles radiating up and down. Horizontal — no cross shape at all.",
    mark: <LashWandCloseMark />,
  },
  {
    id: "lash-closed-eye",
    name: "Closed Eye",
    tagline: "Sleeping beauty",
    group: "Lash",
    description:
      "A closed eye with lashes curving upward. Peaceful, feminine — NOT the staring evil-eye. Just beauty sleep.",
    mark: <LashEyeClosedMark />,
  },
  {
    id: "lash-fan-soft",
    name: "Lash Fan",
    tagline: "Elegant fan",
    group: "Lash",
    description:
      "Curved lashes radiating from a single point like a hand fan. No crossbar, no cross shape.",
    mark: <LashFanSoftMark />,
  },

  // BATCH 4 — JEWELRY (no cross)
  {
    id: "jewelry-pliers",
    name: "Pliers",
    tagline: "Jewelry tool",
    group: "Jewelry",
    description:
      "Jewelry pliers with a pivot joint — the essential permanent jewelry tool. Industry-specific.",
    mark: <JewelryPliersMark />,
  },
  {
    id: "chain-link",
    name: "Chain Link",
    tagline: "Connected links",
    group: "Jewelry",
    description:
      "Two interlocking oval chain links — simple, iconic, clearly jewelry. No cross shape.",
    mark: <ChainLinkMark />,
  },

  // BATCH 4 — CROCHET (no cross)
  {
    id: "hook-closeup",
    name: "Hook Close-up",
    tagline: "Hook + yarn",
    group: "Crochet",
    description:
      "Close-up of a crochet hook catching a yarn loop. The craft in action — unmistakably crochet.",
    mark: <CrochetHookCloseMark />,
  },
  {
    id: "crochet-bag",
    name: "Crochet Bag",
    tagline: "Handmade tote",
    group: "Crochet",
    description:
      "A crocheted tote bag with wavy texture rows and arched handles. Practical, cute, handmade.",
    mark: <CrochetBagMark />,
  },

  // BATCH 4 — TRAINING (no cross)
  {
    id: "hand-gem",
    name: "Hand + Gem",
    tagline: "Elevating craft",
    group: "Training",
    description:
      "Two hands holding up a sparkling gem — teaching, elevating others' craft. Empowering.",
    mark: <HandWithGemMark />,
  },
  {
    id: "all-in-one",
    name: "All Services",
    tagline: "Lash + gem + hook",
    group: "Trini",
    description:
      "Three icons side by side — lash fan, faceted gem, crochet hook — with dots below. All of Trini at a glance.",
    mark: <TriniAllInOneMark />,
  },

  // BATCH 5 — TRINI: warm + classy, beauty + craft + empowerment
  {
    id: "trini-crown-hair",
    name: "Crown Hair",
    tagline: "Queen energy",
    group: "Trini",
    description:
      "Feminine hair silhouette with a subtle tiara at the crown. She IS the queen — warm, elegant, confident.",
    mark: <TriniCrownHairMark />,
  },
  {
    id: "trini-heart-hands",
    name: "Heart Hands",
    tagline: "Community + love",
    group: "Trini",
    description:
      "Two hands curving to form a heart shape. Community, empowerment, and love — the heart of everything Trini does.",
    mark: <TriniHeartHandsMark />,
  },
  {
    id: "trini-flower-mono",
    name: "Service Flower",
    tagline: "Blooming brand",
    group: "Trini",
    description:
      "A five-petal flower where each petal represents a service, with her initial at the center. Blooming from within.",
    mark: <TriniFlowerMonogramMark />,
  },
  {
    id: "trini-window",
    name: "Studio Window",
    tagline: "Open doors",
    group: "Trini",
    description:
      "An arched doorway with her three service icons nestled inside. She opens doors — welcoming, warm, inviting.",
    mark: <TriniWindowMark />,
  },
  {
    id: "trini-shield",
    name: "Trini Crest",
    tagline: "Established brand",
    group: "Trini",
    description:
      "A soft crest divided into four quadrants — lash, gem, hook, and heart. Classy, established, multi-talented.",
    mark: <TriniShieldCrestMark />,
  },
  {
    id: "trini-nestle",
    name: "Nested Services",
    tagline: "Layered craft",
    group: "Trini",
    description:
      "Three layered shapes — lash curve outside, gem in the middle, hook curl inside. All her skills wrapped together.",
    mark: <TriniNestleMark />,
  },
  {
    id: "trini-mirror",
    name: "Lash Mirror",
    tagline: "Self-care beauty",
    group: "Trini",
    description:
      "A vanity mirror reflecting lashes inside. Self-care, beauty station, the moment before she transforms a client.",
    mark: <TriniMirrorVanityMark />,
  },
  {
    id: "trini-cameo",
    name: "Trini Cameo",
    tagline: "Classic portrait",
    group: "Trini",
    description:
      "A classic cameo brooch with a feminine profile, lash detail, and earring. Timeless, classy, unmistakably Trini.",
    mark: <TriniCameoProfileMark />,
  },
  {
    id: "trini-ribbon-wrap",
    name: "Silk Ribbon",
    tagline: "Elegant flow",
    group: "Trini",
    description:
      "A flowing ribbon that wraps and curves into itself. Elegance in motion — warm, classy, and refined.",
    mark: <TriniRibbonWrapMark />,
  },
  {
    id: "trini-stack",
    name: "Icon Stack",
    tagline: "Lash · gem · hook",
    group: "Trini",
    description:
      "Her three services stacked vertically — lashes on top, gem in the center, hook at the bottom. Clean and iconic.",
    mark: <TriniLashGemHookMark />,
  },
  {
    id: "trini-elegant-t",
    name: "Fashion T",
    tagline: "Magazine letter",
    group: "Trini",
    description:
      "An elegant T with thin/thick contrast and a bottom flourish — like a fashion magazine masthead. Classy, not a cross.",
    mark: <TriniElegantTMark />,
  },
  {
    id: "trini-dual-arc",
    name: "Open Arms",
    tagline: "Welcoming arcs",
    group: "Trini",
    description:
      "Two arcs like open arms embracing, with service icons nestled between. Welcoming, warm, community.",
    mark: <TriniDualArcMark />,
  },
  {
    id: "trini-silk-knot",
    name: "Silk Knot",
    tagline: "Tied together",
    group: "Trini",
    description:
      "A single silk ribbon forming a soft knot with trailing ends. Everything tied together — classy, feminine, warm.",
    mark: <TriniSilkRibbonMark />,
  },
  {
    id: "trini-petals",
    name: "Service Petals",
    tagline: "Beauty bloom",
    group: "Trini",
    description:
      "Five petals — each representing a facet of her work — with a center bloom and a single stem. She makes things grow.",
    mark: <TriniPetalsMark />,
  },
  {
    id: "trini-three-circles",
    name: "Triple Overlap",
    tagline: "Unified services",
    group: "Trini",
    description:
      "Three overlapping circles — lash, jewelry, crochet — creating a shared center. Where all her skills meet as one.",
    mark: <TriniThreeCirclesMark />,
  },
  {
    id: "trini-handwritten",
    name: "Handwritten TC",
    tagline: "Personal touch",
    group: "Trini",
    description:
      "T and C in a loose, handwritten brush style with an underline flourish. Personal, warm, human — like she wrote it herself.",
    mark: <TriniHandwrittenMark />,
  },

  // BATCH 6 — THE FULL TRINI
  {
    id: "trini-maker-circle",
    name: "Maker Circle",
    tagline: "Every service",
    group: "Trini",
    description:
      "Circle ringed with ALL her tools — lash wand, gem, chain, 3D cube, yarn, hook, heart. The complete Trini.",
    mark: <TriniMakerCircleMark />,
  },
  {
    id: "trini-grid",
    name: "Service Grid",
    tagline: "Everything she does",
    group: "Trini",
    description:
      "A 2x3 grid of icons — lash, gem, chain, yarn+hook, amigurumi, 3D print — with a mentoring arc below. The full menu.",
    mark: <TriniGridMark />,
  },
  {
    id: "trini-hands-build",
    name: "Builder Hands",
    tagline: "Hands that create",
    group: "Trini",
    description:
      "Two hands — one with a hook, one with a wand — creating a gem shape between them. She builds beautiful things.",
    mark: <TriniHandsBuildMark />,
  },
  {
    id: "trini-transform",
    name: "Transform",
    tagline: "Cocoon to butterfly",
    group: "Trini",
    description:
      "A cocoon on the left, an arrow, and a butterfly on the right. She transforms — clients, students, materials.",
    mark: <TriniTransformMark />,
  },
  {
    id: "trini-3d-print",
    name: "3D Heart",
    tagline: "Tech meets love",
    group: "Trini",
    description:
      "A 3D printer nozzle extruding a heart shape with visible layer lines. Tech meets handmade, the future of Trini.",
    mark: <Trini3DPrintMark />,
  },
  {
    id: "trini-amigurumi",
    name: "Ami Bear",
    tagline: "Crochet creature",
    group: "Trini",
    description:
      "A cute crocheted bear with round ears, dot eyes, and a smile. Her actual product — loveable and handmade.",
    mark: <TriniAmigurumiMark />,
  },
  {
    id: "trini-tote",
    name: "Crochet Tote",
    tagline: "Handmade bag",
    group: "Trini",
    description:
      "A crocheted tote bag with wavy texture, arched handles, and a tiny gem charm. Her actual handmade product.",
    mark: <TriniBagMark />,
  },
  {
    id: "trini-welding",
    name: "Weld Spark",
    tagline: "Permanent jewelry",
    group: "Trini",
    description:
      "A chain being welded closed on a wrist — spark at the join point. Her actual permanent jewelry service in action.",
    mark: <TriniWeldingMark />,
  },
  {
    id: "trini-lash-set",
    name: "Lash Set",
    tagline: "Extensions in action",
    group: "Trini",
    description:
      "Lash extensions fanning upward from a closed eye on a pad. Her actual lash service — the client on the table.",
    mark: <TriniLashSetMark />,
  },
  {
    id: "trini-lash-lift",
    name: "Lash Lift",
    tagline: "Natural curl",
    group: "Trini",
    description:
      "Natural lashes curling over a silicone rod with a closed eye beneath. Her lash lift service.",
    mark: <TriniLashLiftMark />,
  },
  {
    id: "trini-teach",
    name: "Teach Circle",
    tagline: "Mentor + students",
    group: "Trini",
    description:
      "A larger figure connected to three smaller figures by dotted lines. She teaches lash, jewelry, crochet, AND business.",
    mark: <TriniTeachCircleMark />,
  },
  {
    id: "trini-empower",
    name: "Rise Up",
    tagline: "Empowerment",
    group: "Trini",
    description:
      "A figure with arms raised in celebration, motion lines radiating. She empowers others to build their own businesses.",
    mark: <TriniBizEmpowerMark />,
  },
  {
    id: "trini-blanket",
    name: "Cozy Blanket",
    tagline: "Home comfort",
    group: "Trini",
    description:
      "A folded crochet blanket with wavy texture and a heart-shaped hang tag. Made with love for someone's home.",
    mark: <TriniCozyBlanketMark />,
  },
  {
    id: "trini-scrunchie",
    name: "Scrunchie",
    tagline: "Wearable crochet",
    group: "Trini",
    description:
      "A ruffled crochet scrunchie on a wrist. Her wearable product — cute, practical, handmade.",
    mark: <TriniScrunchieMark />,
  },
  {
    id: "trini-earrings",
    name: "Earring Pair",
    tagline: "Handmade jewelry",
    group: "Trini",
    description:
      "A pair of different handmade earrings — one geometric drop, one circle hoop. Shows the variety she creates.",
    mark: <TriniEarringsMark />,
  },
  {
    id: "trini-journey",
    name: "Full Journey",
    tagline: "Her whole story",
    group: "Trini",
    description:
      "A winding path with stops at lash, gem, hook, teaching circle, and 3D cube. Her full creative journey.",
    mark: <TriniFullStoryMark />,
  },
  {
    id: "trini-coasters",
    name: "Coaster Stack",
    tagline: "Home decor",
    group: "Trini",
    description:
      "A stack of three crocheted coasters with mandala detail on top. Her home product — simple and beautiful.",
    mark: <TriniCoasterSetMark />,
  },
  {
    id: "trini-hub",
    name: "Creative Hub",
    tagline: "Honeycomb of skills",
    group: "Trini",
    description:
      "Hexagonal honeycomb cells — each holding a service icon (lash, hook, gem, heart). She's a creative hub, every cell connected.",
    mark: <TriniCreativeHubMark />,
  },

  // BATCH 7 — ACRYLICS & EARRINGS
  {
    id: "acrylic-nails",
    name: "Acrylic Nails",
    tagline: "Polished hand",
    group: "Trini",
    description:
      "A hand showing five acrylic nails with rounded tips. Her nail art service — polished and pretty.",
    mark: <AcrylicNailsMark />,
  },
  {
    id: "acrylic-single",
    name: "Nail Art",
    tagline: "Stiletto nail",
    group: "Trini",
    description:
      "A single stiletto acrylic nail close-up with gem details and a french tip line. Nail art as a craft.",
    mark: <AcrylicNailSingleMark />,
  },
  {
    id: "acrylic-keychain",
    name: "Acrylic Keychain",
    tagline: "Custom charm",
    group: "Trini",
    description:
      "An acrylic keychain charm on a key ring — rounded shape with a heart design inside. Her custom acrylic product.",
    mark: <AcrylicKeychainMark />,
  },
  {
    id: "acrylic-pour",
    name: "Acrylic Pour",
    tagline: "Art pour",
    group: "Trini",
    description:
      "Flowing acrylic pour art on a canvas with cell/lacing detail. The artistry of her acrylic work.",
    mark: <AcrylicPourMark />,
  },
  {
    id: "earring-dangle",
    name: "Statement Earring",
    tagline: "Dangle earring",
    group: "Trini",
    description:
      "A layered dangle earring with bars, chains, circles, and gem drops. Her handmade statement jewelry.",
    mark: <EarringDangleMark />,
  },
  {
    id: "earring-studs",
    name: "Stud Collection",
    tagline: "Earring variety",
    group: "Trini",
    description:
      "Four different stud earrings — circle, heart, flower, teardrop. Shows the full variety she makes.",
    mark: <EarringStudsMark />,
  },
  {
    id: "earring-huggies",
    name: "Huggies",
    tagline: "Hoop earrings",
    group: "Trini",
    description:
      "A pair of huggie hoop earrings on ears, one with a tiny gem charm. Everyday modern jewelry she creates.",
    mark: <EarringHuggiesMark />,
  },
  {
    id: "acrylic-earring",
    name: "Acrylic Earring",
    tagline: "Acrylic + earring",
    group: "Trini",
    description:
      "An earring with an organic acrylic charm — swirl pattern inside the shape. Where her acrylic and earring skills meet.",
    mark: <TriniAcrylicEarringMark />,
  },
  {
    id: "trini-everything",
    name: "Everything Circle",
    tagline: "The full Trini",
    group: "Trini",
    description:
      "Circle with ALL her services as icons around the rim — lash, acrylic nail, gem, earring, chain, yarn, hook, 3D cube, heart. The definitive mark.",
    mark: <TriniEverythingCircleMark />,
  },
  {
    id: "trini-tool-belt",
    name: "Maker Belt",
    tagline: "All her tools",
    group: "Trini",
    description:
      "A curved belt with her tools hanging from it — lash wand, nail file, gem pendant, crochet hook, earring. Like a maker's apron.",
    mark: <TriniToolBeltMark />,
  },
  {
    id: "trini-moodboard",
    name: "Mood Board",
    tagline: "Product collage",
    group: "Trini",
    description:
      "A collage of overlapping frames — each showing a product: lashes, earring, acrylic, crochet bag, gem, 3D print. Her creative world.",
    mark: <TriniMoodboardMark />,
  },
  {
    id: "trini-tree",
    name: "Creative Tree",
    tagline: "Rooted + growing",
    group: "Trini",
    description:
      "A tree where each branch holds a different product — lash, earring, hook, gem, acrylic nail, 3D cube — with a heart crown. Rooted and always growing.",
    mark: <TriniEverythingTreeMark />,
  },

  // BATCH 8 — MORE TRINI
  {
    id: "nail-gem-combo",
    name: "Nail + Gem",
    tagline: "Acrylic nail art",
    group: "Trini",
    description:
      "A single stiletto acrylic nail with an embedded gem design and accent stones. Two of her skills fused into one.",
    mark: <TriniNailGemComboMark />,
  },
  {
    id: "hands-weave",
    name: "Hands Weaving",
    tagline: "Creating by hand",
    group: "Trini",
    description:
      "Two hands weaving yarn with a bag forming below. The act of creating — her hands making something beautiful.",
    mark: <TriniHandsWeaveMark />,
  },
  {
    id: "sparkle-eye",
    name: "Glam Eye",
    tagline: "Sparkle lashes",
    group: "Trini",
    description:
      "A closed eye with glamorous lash extensions and scattered sparkle dots above. Beauty moment — NOT occult, just glam.",
    mark: <TriniSparkleEyeMark />,
  },
  {
    id: "nail-earring-pair",
    name: "Nail + Earring",
    tagline: "Nails holding jewelry",
    group: "Trini",
    description:
      "A manicured hand with acrylic nails, holding a dangling earring, with a ring. Her products on display.",
    mark: <TriniNailEarringPairMark />,
  },
  {
    id: "wreath-everything",
    name: "Product Wreath",
    tagline: "All products",
    group: "Trini",
    description:
      "A wreath made of her actual products — lash, nail, earring, gem, yarn, hook, chain, 3D cube — instead of leaves.",
    mark: <TriniWreathEverythingMark />,
  },
  {
    id: "spiral-journey",
    name: "Creative Spiral",
    tagline: "Golden spiral",
    group: "Trini",
    description:
      "A golden-ratio spiral with service icons at each turn. Her creative journey spiraling outward — always growing.",
    mark: <TriniSpiralMark />,
  },
  {
    id: "crown-services",
    name: "Service Crown",
    tagline: "Queen of all trades",
    group: "Trini",
    description:
      "A crown where each point holds a different service icon — lash, nail, gem, earring, hook. She's the queen of all trades.",
    mark: <TriniCrownServicesMark />,
  },
  {
    id: "diamond-grid",
    name: "Diamond Grid",
    tagline: "All services balanced",
    group: "Trini",
    description:
      "Her services arranged in a diamond pattern — lash, nail, earring, hook, yarn, gem, chain, 3D — balanced and connected.",
    mark: <TriniDiamondGridMark />,
  },
  {
    id: "heart-services",
    name: "Heart of Services",
    tagline: "Love in every craft",
    group: "Trini",
    description:
      "A heart outline with all her product icons placed along the shape — lash, nail, earring, gem, chain, yarn, hook.",
    mark: <TriniHandHeartServicesMark />,
  },
  {
    id: "tc-flow",
    name: "TC Flow",
    tagline: "Initials + accents",
    group: "Trini",
    description:
      "Flowing 'TC' letters with product accents — lash at the top, gem at the join, hook at the tail, earring dot at the end.",
    mark: <TriniInitialsFlowMark />,
  },
  {
    id: "sunrise",
    name: "Sunrise",
    tagline: "New day beauty",
    group: "Trini",
    description:
      "A half-sun rising over a horizon, with service icons as the rays — lash, nail, earring, hook, gem. New day, new beauty.",
    mark: <TriniSunriseMark />,
  },
  {
    id: "palette-board",
    name: "Creator Palette",
    tagline: "Colors of craft",
    group: "Trini",
    description:
      "An artist palette where each paint dot is one of her products — lash, gem, nail, earring, yarn, hook.",
    mark: <TriniPaletteBoardMark />,
  },
  {
    id: "book-portfolio",
    name: "Portfolio Book",
    tagline: "Maker + teacher",
    group: "Trini",
    description:
      "An open book — left page shows her products (lash, earring, gem, hook), right page shows teaching. Maker + mentor.",
    mark: <TriniBookOpenMark />,
  },
  {
    id: "infinity-loop",
    name: "Infinity Create",
    tagline: "Endless creativity",
    group: "Trini",
    description:
      "An infinity loop with product icons flowing through it — lash, earring, gem, hook. Endless creativity.",
    mark: <TriniInfinityLoopMark />,
  },
];

// ── Filter bar ────────────────────────────────────────────────────────────────

const FILTERS: ("All" | Group)[] = [
  "All",
  "Trini",
  "Lash",
  "Jewelry",
  "Crochet",
  "Training",
  "Consulting",
  "Luxury",
  "Creative",
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LogoExplorationPage() {
  const [active, setActive] = useState<"All" | Group>("All");

  const filtered = active === "All" ? logos : logos.filter((l) => l.group === active);

  return (
    <div style={{ minHeight: "100vh", background: "#faf6f1", padding: "56px 32px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#96604a",
              marginBottom: 8,
            }}
          >
            T Creative Studio
          </p>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: "#2c2420",
              margin: "0 0 8px",
              lineHeight: 1.1,
            }}
          >
            Logo Exploration
          </h1>
          <p style={{ fontSize: 14, color: "#6b5d52", margin: 0 }}>
            {logos.length} concepts across lash, jewelry, crochet, training, consulting, luxury, and
            creative.
          </p>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 36 }}>
          {FILTERS.map((f) => {
            const isActive = active === f;
            const style = f !== "All" ? groupStyles[f as Group] : null;
            return (
              <button
                key={f}
                onClick={() => setActive(f)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: isActive
                    ? style
                      ? style.btnActive
                      : "#2c2420"
                    : style
                      ? style.btn
                      : "#e8e0d8",
                  color: isActive
                    ? style
                      ? style.text
                      : "#faf6f1"
                    : style
                      ? style.text
                      : "#6b5d52",
                  transform: isActive ? "scale(1.04)" : "scale(1)",
                  boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
                }}
              >
                {f}{" "}
                {f !== "All" && (
                  <span style={{ opacity: 0.6, fontWeight: 400 }}>
                    ({logos.filter((l) => l.group === f).length})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Count */}
        <p style={{ fontSize: 11, color: "#9e8a7a", marginBottom: 20 }}>
          Showing {filtered.length} of {logos.length} concepts
        </p>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 18,
          }}
        >
          {filtered.map(({ id, name, tagline, description, mark, group }) => {
            const badge = groupStyles[group];
            return (
              <div
                key={id}
                style={{
                  background: "white",
                  borderRadius: 18,
                  border: "1px solid #e8e0d8",
                  padding: 22,
                }}
              >
                {/* Three colorways */}
                <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                  <Preview bg="#faf6f1" color="#2c2420">
                    {mark}
                  </Preview>
                  <Preview bg="#2c2420" color="#f3ece4">
                    {mark}
                  </Preview>
                  <Preview bg="#f3ece4" color="#96604a">
                    {mark}
                  </Preview>
                </div>
                {/* Labels */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#96604a",
                      margin: 0,
                    }}
                  >
                    {tagline}
                  </p>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 20,
                      background: badge.bg,
                      color: badge.text,
                    }}
                  >
                    {group}
                  </span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 500, color: "#2c2420", margin: "0 0 6px" }}>
                  {name}
                </p>
                <p style={{ fontSize: 12, color: "#6b5d52", lineHeight: 1.6, margin: 0 }}>
                  {description}
                </p>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 11, color: "#9e8a7a", textAlign: "center", marginTop: 48 }}>
          All marks use <code style={{ fontFamily: "monospace" }}>currentColor</code> — they adapt
          to any background or accent.
        </p>
      </div>
    </div>
  );
}
