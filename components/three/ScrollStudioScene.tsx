/**
 * ScrollStudioScene — Scroll-driven 3D studio scene for the StudioPortal.
 *
 * Unlike the interactive StudioScene (click-to-explore), this version is
 * driven entirely by scroll position. Zone lights fade up sequentially
 * as the camera approaches each area.
 *
 * Client Component — runs inside R3F Canvas.
 */
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "@/lib/zones";
import { ScrollCamera } from "./ScrollCamera";
import { ServiceZone } from "./ServiceZone";
import { StudioRoom } from "./StudioRoom";

interface ScrollStudioSceneProps {
  scrollProgress: number;
}

export function ScrollStudioScene({ scrollProgress }: ScrollStudioSceneProps) {
  const fogRef = useRef<THREE.Fog>(null);

  // Animated fog — clears as you enter, tightens when focused on a zone
  useFrame(() => {
    if (!fogRef.current) return;
    const inZone = scrollProgress > 0.5;
    const targetNear = inZone ? 2 : scrollProgress < 0.3 ? 8 : 4;
    const targetFar = inZone ? 18 : scrollProgress < 0.3 ? 20 : 30;
    fogRef.current.near = THREE.MathUtils.lerp(fogRef.current.near, targetNear, 0.03);
    fogRef.current.far = THREE.MathUtils.lerp(fogRef.current.far, targetFar, 0.03);
  });

  return (
    <>
      <ScrollCamera scrollProgress={scrollProgress} />
      <ScrollLighting scrollProgress={scrollProgress} />
      <StudioRoom />

      {/* Service zones */}
      {Object.values(ZONES).map((zone) => (
        <ServiceZone key={zone.id} zone={zone} />
      ))}

      <fog ref={fogRef} attach="fog" args={["#FAF6F1", 8, 20]} />
    </>
  );
}

/**
 * ScrollLighting — Sequential zone light reveal driven by scroll progress.
 *
 * Phase 1 (approach): Only ambient + key light
 * Phase 2 (survey, 30-50%): Zone spotlights fade up sequentially
 * Phase 3 (focused): Active zone gets brighter spot
 */
function ScrollLighting({ scrollProgress }: { scrollProgress: number }) {
  const lashLightRef = useRef<THREE.PointLight>(null);
  const jewelryLightRef = useRef<THREE.PointLight>(null);
  const crochetLightRef = useRef<THREE.PointLight>(null);
  const consultingLightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const p = scrollProgress;

    // Sequential light reveal during survey phase (30-50%)
    const lashIntensity =
      p < 0.32 ? 0 : p < 0.38 ? (p - 0.32) / 0.06 : p > 0.5 && p < 0.625 ? 1.2 : 0.7;
    const jewelryIntensity =
      p < 0.36 ? 0 : p < 0.42 ? (p - 0.36) / 0.06 : p > 0.625 && p < 0.75 ? 1.2 : 0.7;
    const crochetIntensity =
      p < 0.4 ? 0 : p < 0.46 ? (p - 0.4) / 0.06 : p > 0.75 && p < 0.875 ? 1.2 : 0.7;
    const consultingIntensity = p < 0.44 ? 0 : p < 0.5 ? (p - 0.44) / 0.06 : p > 0.875 ? 1.2 : 0.7;

    if (lashLightRef.current) {
      lashLightRef.current.intensity = THREE.MathUtils.lerp(
        lashLightRef.current.intensity,
        lashIntensity,
        0.06,
      );
    }
    if (jewelryLightRef.current) {
      jewelryLightRef.current.intensity = THREE.MathUtils.lerp(
        jewelryLightRef.current.intensity,
        jewelryIntensity,
        0.06,
      );
    }
    if (crochetLightRef.current) {
      crochetLightRef.current.intensity = THREE.MathUtils.lerp(
        crochetLightRef.current.intensity,
        crochetIntensity,
        0.06,
      );
    }
    if (consultingLightRef.current) {
      consultingLightRef.current.intensity = THREE.MathUtils.lerp(
        consultingLightRef.current.intensity,
        consultingIntensity,
        0.06,
      );
    }
  });

  return (
    <>
      {/* Ambient base — warm undertone */}
      <ambientLight color="#F5E6D3" intensity={0.35} />

      {/* Key light — main overhead */}
      <directionalLight color="#FFF5EB" intensity={0.7} position={[0, 6, 3]} />

      {/* Fill light */}
      <directionalLight color="#F5F0E8" intensity={0.2} position={[-4, 3, 2]} />

      {/* Back wall wash */}
      <pointLight color="#5B8A8A" intensity={0.2} distance={10} position={[0, 3.5, -9]} />

      {/* Zone spotlights — fade up sequentially */}
      <pointLight
        ref={lashLightRef}
        color="#F5E6D3"
        intensity={0}
        distance={6}
        position={[ZONES.lash.pedestalPosition[0], 3.2, ZONES.lash.pedestalPosition[2]]}
      />
      <pointLight
        ref={jewelryLightRef}
        color="#F5E6D3"
        intensity={0}
        distance={6}
        position={[ZONES.jewelry.pedestalPosition[0], 3.2, ZONES.jewelry.pedestalPosition[2]]}
      />
      <pointLight
        ref={crochetLightRef}
        color="#F5E6D3"
        intensity={0}
        distance={6}
        position={[ZONES.crochet.pedestalPosition[0], 3.2, ZONES.crochet.pedestalPosition[2]]}
      />
      <pointLight
        ref={consultingLightRef}
        color="#F5E6D3"
        intensity={0}
        distance={6}
        position={[ZONES.consulting.pedestalPosition[0], 3.2, ZONES.consulting.pedestalPosition[2]]}
      />

      {/* Center warm pool */}
      <pointLight color="#F5E6D3" intensity={0.3} distance={10} position={[0, 4, -2]} />
    </>
  );
}
