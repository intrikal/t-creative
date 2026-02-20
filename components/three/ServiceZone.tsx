"use client";

/**
 * ServiceZone — A single interactive zone in the studio.
 *
 * WHAT CHANGED FROM PREVIOUS VERSION:
 * ─────────────────────────────────────
 * BEFORE: Flat circle pedestal + floating torus (donut) = gimmicky
 * AFTER:  Zone-specific display furniture (table, pedestal, shelf, desk)
 *         sitting on a raised platform with subtle lighting, warm
 *         materials, and a hover glow that feels like gallery spotlighting.
 *
 * THREE.JS CONCEPTS USED:
 * ─────────────────────────
 * • useFrame — runs every animation frame (~60fps). We use it to smoothly
 *   animate emissive glow and opacity. NEVER set React state inside useFrame.
 *
 * • emissive + emissiveIntensity — makes a material glow without needing
 *   a light. We lerp (smoothly interpolate) the intensity from 0 to 0.2
 *   on hover to create a warm spotlight effect.
 *
 * • THREE.MathUtils.lerp(current, target, rate) — moves "current" toward
 *   "target" by "rate" percent each frame. Rate 0.06 = smooth, cinematic.
 *
 * • onPointerOver / onPointerOut — R3F automatically raycasts (projects a
 *   ray from mouse into 3D space) and fires these when the ray hits a mesh.
 */

import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ZoneId, ZoneDefinition } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";
import { LashDisplay, JewelryDisplay, CrochetDisplay, ConsultingDisplay } from "./ZoneDisplays";

interface ServiceZoneProps {
  zone: ZoneDefinition;
}

/** Maps zone ID to its display component */
const DISPLAY_MAP: Record<ZoneId, React.ComponentType> = {
  lash: LashDisplay,
  jewelry: JewelryDisplay,
  crochet: CrochetDisplay,
  consulting: ConsultingDisplay,
};

export function ServiceZone({ zone }: ServiceZoneProps) {
  const platformRef = useRef<THREE.Mesh>(null);
  const hitboxRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { mode, activeZone, focusZone, setHoveredZone } = useStudioStore();
  const { camera } = useThree();

  const isActive = activeZone === zone.id;
  const isFaded = activeZone !== null && !isActive;
  const isInteractive = mode === "exploring" || mode === "focused";

  const DisplayComponent = DISPLAY_MAP[zone.id];

  useFrame(() => {
    // ── Platform glow ──
    if (platformRef.current) {
      const mat = platformRef.current.material as THREE.MeshStandardMaterial;

      // Emissive: brighter on hover, subtle on active, minimal at rest
      const targetEmissive = hovered && !isFaded ? 0.2 : isActive ? 0.1 : 0.02;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetEmissive, 0.06);

      // Opacity: fade non-active zones when one is focused
      const targetOpacity = isFaded ? 0.35 : 1;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.04);
    }
  });

  return (
    <group position={zone.pedestalPosition}>
      {/* ── Raised platform (clickable) ──
          A low box that the display furniture sits on.
          Size varies per zone (lash is largest). */}
      <mesh ref={platformRef} position={[0, 0.03, 0]}>
        <boxGeometry args={[zone.platformSize[0], 0.06, zone.platformSize[1]]} />
        <meshStandardMaterial
          color="#E8DFD0"
          emissive={zone.color}
          emissiveIntensity={0.02}
          roughness={0.7}
          transparent
          opacity={1}
        />
      </mesh>

      {/* ── Invisible hitbox ──
          A taller invisible box covering the display area so users can
          click anywhere on the furniture, not just the platform. */}
      <mesh
        ref={hitboxRef}
        position={[0, 1.0, 0]}
        onClick={() => {
          if (isInteractive && !isFaded) focusZone(zone.id);
        }}
        onPointerOver={() => {
          if (isInteractive && !isFaded) {
            setHovered(true);
            setHoveredZone(zone.id);
            document.body.style.cursor = "pointer";
          }
        }}
        onPointerOut={() => {
          setHovered(false);
          setHoveredZone(null);
          document.body.style.cursor = "default";
        }}
        visible={false}
      >
        <boxGeometry args={[zone.platformSize[0], 2.2, zone.platformSize[1]]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* ── Display furniture ──
          Zone-specific 3D objects (table, pedestal, shelf, desk).
          Positioned on top of the platform. */}
      <group
        position={[0, 0.06, 0]}
        // Scale down slightly when faded to create depth hierarchy
      >
        <DisplayComponent />
      </group>

      {/* ── Zone label ──
          Real HTML rendered in 3D space via drei's <Html>.
          Only visible when the studio is in exploring/focused mode. */}
      {isInteractive && (
        <Html
          center
          distanceFactor={10}
          position={[0, zone.labelHeight, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div
            className={`text-center transition-opacity duration-300 ${
              isFaded ? "opacity-15" : "opacity-100"
            }`}
          >
            <p
              className={`text-[10px] tracking-[0.2em] uppercase whitespace-nowrap px-3 py-1.5 transition-all duration-200 ${
                hovered && !isFaded
                  ? "text-foreground bg-background/90 backdrop-blur-sm"
                  : "text-muted/50"
              }`}
            >
              {zone.label}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}
