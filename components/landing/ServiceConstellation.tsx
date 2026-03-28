"use client";

/**
 * ServiceConstellation — Ambient SVG node network for the CTA section background.
 *
 * Renders the 4 service zones as connected nodes with:
 *   - Scroll-triggered entrance: nodes scale + fade in, edges draw via stroke-dashoffset
 *   - Continuous idle: each node floats on its own sinusoidal path (GSAP, no rAF loop)
 *   - Zone colors from lib/zones for brand coherence
 *
 * Placed behind the dark overlay in CallToAction — visible before wipe, faint through it.
 * Pure SVG + GSAP. No D3 dependency needed for 4 nodes.
 */

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap";
import { ZONES, ZONE_ORDER } from "@/lib/zones";

// Node positions (0–100 in SVG viewBox 100×60), reflecting studio spatial layout:
// lash top-left, crochet top-right, consulting bottom-left, jewelry bottom-right
const NODE_POSITIONS: Record<string, { cx: number; cy: number }> = {
  lash: { cx: 28, cy: 22 },
  crochet: { cx: 72, cy: 18 },
  consulting: { cx: 24, cy: 48 },
  jewelry: { cx: 68, cy: 52 },
};

// Edges — each service connects to its nearest neighbor(s)
const EDGES = [
  ["lash", "crochet"],
  ["lash", "consulting"],
  ["crochet", "jewelry"],
  ["consulting", "jewelry"],
  ["lash", "jewelry"], // diagonal — the "T" creative cross
];

export function ServiceConstellation() {
  const svgRef = useRef<SVGSVGElement>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || readyRef.current) return;
    readyRef.current = true;

    // ── Entrance: edges draw in, then nodes bloom ──
    const edges = svg.querySelectorAll<SVGLineElement>(".const-edge");
    const nodes = svg.querySelectorAll<SVGGElement>(".const-node");
    const labels = svg.querySelectorAll<SVGTextElement>(".const-label");

    // Compute line length manually (lines don't have getTotalLength, only paths do)
    edges.forEach((edge) => {
      const dx =
        parseFloat(edge.getAttribute("x2") ?? "0") - parseFloat(edge.getAttribute("x1") ?? "0");
      const dy =
        parseFloat(edge.getAttribute("y2") ?? "0") - parseFloat(edge.getAttribute("y1") ?? "0");
      const len = Math.sqrt(dx * dx + dy * dy);
      gsap.set(edge, { strokeDasharray: len, strokeDashoffset: len });
    });

    gsap.set([nodes, labels], { opacity: 0, scale: 0, transformOrigin: "center center" });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: svg.closest("section") ?? svg,
        start: "top 75%",
        once: true,
      },
    });

    // Edges draw in staggered
    tl.to(
      edges,
      {
        strokeDashoffset: 0,
        duration: 1.4,
        stagger: 0.15,
        ease: "power2.inOut",
      },
      0,
    );

    // Nodes bloom
    tl.to(
      nodes,
      {
        opacity: 1,
        scale: 1,
        duration: 0.6,
        stagger: 0.12,
        ease: "back.out(1.8)",
      },
      0.4,
    );

    // Labels fade
    tl.to(
      labels,
      {
        opacity: 1,
        duration: 0.5,
        stagger: 0.1,
        ease: "power2.out",
      },
      0.9,
    );

    // ── Idle float — each node drifts on its own phase ──
    nodes.forEach((node, i) => {
      const phase = i * (Math.PI / 2.2);
      gsap.to(node, {
        y: `+=${3.5 + i * 0.6}`,
        x: `+=${1.5 - i * 0.4}`,
        duration: 4.2 + i * 0.7,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: phase * 0.4,
      });
    });

    // ── Pulse rings on nodes — scale and fade out ──
    svg.querySelectorAll<SVGCircleElement>(".const-pulse").forEach((ring, i) => {
      gsap.fromTo(
        ring,
        { scale: 1, opacity: 0.5, transformOrigin: "center center" },
        {
          scale: 2.8,
          opacity: 0,
          duration: 2.8,
          ease: "power1.out",
          repeat: -1,
          delay: i * 0.9,
        },
      );
    });
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Edges */}
      {EDGES.map(([a, b], i) => {
        const pa = NODE_POSITIONS[a];
        const pb = NODE_POSITIONS[b];
        return (
          <line
            key={i}
            className="const-edge"
            x1={pa.cx}
            y1={pa.cy}
            x2={pb.cx}
            y2={pb.cy}
            stroke="currentColor"
            strokeOpacity={0.06}
            strokeWidth={0.25}
          />
        );
      })}

      {/* Nodes */}
      {ZONE_ORDER.map((id) => {
        const zone = ZONES[id];
        const pos = NODE_POSITIONS[id];
        return (
          <g key={id} className="const-node" transform={`translate(${pos.cx},${pos.cy})`}>
            {/* Pulse ring */}
            <circle
              className="const-pulse"
              r={1.6}
              fill="none"
              stroke={zone.color}
              strokeWidth={0.3}
              opacity={0}
            />
            {/* Core dot */}
            <circle r={1.2} fill={zone.color} opacity={0.55} />
            {/* Inner highlight */}
            <circle r={0.45} fill="white" opacity={0.35} />
          </g>
        );
      })}

      {/* Labels */}
      {ZONE_ORDER.map((id) => {
        const zone = ZONES[id];
        const pos = NODE_POSITIONS[id];
        const below = pos.cy < 35; // label above or below node
        return (
          <text
            key={id}
            className="const-label"
            x={pos.cx}
            y={below ? pos.cy + 4.5 : pos.cy - 3.2}
            textAnchor="middle"
            fontSize={2.2}
            letterSpacing={0.6}
            fill={zone.color}
            opacity={0}
            style={{ fontFamily: "var(--font-geist-sans)", textTransform: "uppercase" }}
          >
            {zone.label}
          </text>
        );
      })}
    </svg>
  );
}
