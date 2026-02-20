"use client";

/**
 * StudioLighting — Gallery-style warm lighting.
 *
 * THREE.JS LIGHTING CONCEPTS:
 * ───────────────────────────
 * ambientLight  — even light everywhere, no direction. Low intensity base.
 * directionalLight — parallel rays from one direction (like sunlight).
 * pointLight    — a light bulb. Radiates from a point, fades with distance.
 *
 * No shadows (castShadow=false) — too expensive for this scene.
 * The ambient + point combination creates enough depth cues.
 */

import { ZONES } from "@/lib/zones";

export function StudioLighting() {
  return (
    <>
      {/* Ambient base — warm undertone for the whole room */}
      <ambientLight color="#F5E6D3" intensity={0.45} />

      {/* Key light — main overhead, warm studio lighting */}
      <directionalLight color="#FFF5EB" intensity={0.8} position={[0, 6, 3]} />

      {/* Fill light — softer, from the side */}
      <directionalLight color="#F5F0E8" intensity={0.25} position={[-4, 3, 2]} />

      {/* Back wall wash — subtle teal glow on accent wall */}
      <pointLight color="#5B8A8A" intensity={0.3} distance={10} position={[0, 3.5, -9]} />

      {/* Zone spotlights — gallery-style overhead accents per zone */}
      {Object.values(ZONES).map((zone) => (
        <pointLight
          key={zone.id}
          color="#F5E6D3"
          intensity={0.7}
          distance={6}
          position={[zone.pedestalPosition[0], 3.2, zone.pedestalPosition[2]]}
        />
      ))}

      {/* Center warm pool — subtle overhead at camera home */}
      <pointLight color="#F5E6D3" intensity={0.3} distance={10} position={[0, 4, -2]} />
    </>
  );
}
