"use client";

/**
 * StudioLighting — Dynamic gallery lighting with subtle animation.
 *
 * Base lighting: unchanged (ambient + two directional + back wall teal).
 * Zone spotlights: now use useRef + useFrame to pulse intensity gently,
 *   and brighten (1.4x) when the corresponding zone is active.
 *
 * Performance: all math is scalar, no allocations in useFrame.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { PointLight } from "three";
import { ZONES, type ZoneId } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";

const ZONE_IDS = Object.keys(ZONES) as ZoneId[];

/** Animated point light for a single zone. Pulses softly, brightens when active. */
function ZoneLight({ zoneId, offset }: { zoneId: ZoneId; offset: number }) {
  const lightRef = useRef<PointLight>(null);
  const zone = ZONES[zoneId];
  const activeZone = useStudioStore((s) => s.activeZone);
  const isActive = activeZone === zoneId;

  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.getElapsedTime();
    const base = isActive ? 1.2 : 0.7;
    const amplitude = isActive ? 0.15 : 0.06;
    // Phase offset so lights don't all pulse together
    lightRef.current.intensity = base + Math.sin(t * 0.9 + offset) * amplitude;
  });

  return (
    <pointLight
      ref={lightRef}
      color="#F5E6D3"
      intensity={0.7}
      distance={6}
      position={[zone.pedestalPosition[0], 3.2, zone.pedestalPosition[2]]}
    />
  );
}

export function StudioLighting() {
  return (
    <>
      {/* Ambient — warm base */}
      <ambientLight color="#F5E6D3" intensity={0.45} />

      {/* Key light */}
      <directionalLight color="#FFF5EB" intensity={0.8} position={[0, 6, 3]} />

      {/* Fill light */}
      <directionalLight color="#F5F0E8" intensity={0.25} position={[-4, 3, 2]} />

      {/* Back wall teal wash */}
      <pointLight color="#5B8A8A" intensity={0.3} distance={10} position={[0, 3.5, -9]} />

      {/* Center warm pool */}
      <pointLight color="#F5E6D3" intensity={0.3} distance={10} position={[0, 4, -2]} />

      {/* Animated zone spotlights */}
      {ZONE_IDS.map((id, i) => (
        <ZoneLight key={id} zoneId={id} offset={i * 1.3} />
      ))}
    </>
  );
}
