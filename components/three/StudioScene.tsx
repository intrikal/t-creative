/**
 * StudioScene — Top-level 3D scene graph composing room, lighting, zones, and fog.
 *
 * Animated fog narrows when a zone is focused to create depth-of-field effect.
 * Client Component — runs inside R3F Canvas.
 */
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";
import { ServiceZone } from "./ServiceZone";
import { StudioCamera } from "./StudioCamera";
import { StudioLighting } from "./StudioLighting";
import { StudioRoom } from "./StudioRoom";

export function StudioScene() {
  const fogRef = useRef<THREE.Fog>(null);
  const { activeZone } = useStudioStore();

  // Animated fog — pulls closer when focused on a zone
  useFrame(() => {
    if (!fogRef.current) return;
    const targetNear = activeZone ? 2 : 4;
    const targetFar = activeZone ? 18 : 30;
    fogRef.current.near = THREE.MathUtils.lerp(fogRef.current.near, targetNear, 0.03);
    fogRef.current.far = THREE.MathUtils.lerp(fogRef.current.far, targetFar, 0.03);
  });

  return (
    <>
      <StudioLighting />
      <StudioCamera />
      <StudioRoom />

      {/* Service zones — one per business vertical */}
      {Object.values(ZONES).map((zone) => (
        <ServiceZone key={zone.id} zone={zone} />
      ))}

      {/* Fog — creates depth and focus effect */}
      <fog ref={fogRef} attach="fog" args={["#FAF6F1", 4, 30]} />
    </>
  );
}
