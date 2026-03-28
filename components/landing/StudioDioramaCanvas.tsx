"use client";

/**
 * StudioDioramaCanvas — R3F Canvas with animated camera rig.
 *
 * CameraRig reads targetZone / mode from Zustand and lerps the camera
 * to the matching preset position each frame. When it arrives within
 * ARRIVAL_THRESHOLD it calls completeTransition() to advance the state machine.
 *
 * No OrbitControls — the mouse parallax (CameraParallax) adds subtle life
 * on top of the rig position without fighting it.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { ServiceZone } from "@/components/three/ServiceZone";
import { StudioLighting } from "@/components/three/StudioLighting";
import { StudioRoom } from "@/components/three/StudioRoom";
import { ZONES, HERO_CAMERA, CENTER_CAMERA, type ZoneId } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";

const ARRIVAL_THRESHOLD = 0.08;
const LERP_SPEED = 0.055; // lower = smoother, higher = snappier

/** Resolves the camera target for the current store state. */
function getCameraTarget(
  mode: string,
  targetZone: ZoneId | null,
  activeZone: ZoneId | null,
): { position: [number, number, number]; lookAt: [number, number, number] } {
  if (targetZone) {
    const z = ZONES[targetZone];
    return { position: z.cameraPosition, lookAt: z.cameraLookAt };
  }
  if (activeZone && mode === "focused") {
    const z = ZONES[activeZone];
    return { position: z.cameraPosition, lookAt: z.cameraLookAt };
  }
  if (mode === "exploring" || mode === "entering") return CENTER_CAMERA;
  return HERO_CAMERA;
}

/** Normalised mouse position [-1, 1] on the window. */
function useMouseNorm() {
  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return mouse;
}

/**
 * CameraRig — lerps camera toward the target preset every frame.
 * Also adds a small mouse parallax offset on top (±0.8 units) so the
 * scene feels alive without competing with the zone transitions.
 */
function CameraRig() {
  const { camera } = useThree();
  const mouse = useMouseNorm();
  const parallax = useRef({ x: 0, y: 0 });

  const mode = useStudioStore((s) => s.mode);
  const targetZone = useStudioStore((s) => s.targetZone);
  const activeZone = useStudioStore((s) => s.activeZone);
  const isTransitioning = useStudioStore((s) => s.isTransitioning);
  const completeTransition = useStudioStore((s) => s.completeTransition);
  const enterStudio = useStudioStore((s) => s.enterStudio);

  // Boot into exploring on mount
  useEffect(() => {
    if (mode === "landing") enterStudio();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lookAtTarget = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3(...HERO_CAMERA.position));

  useFrame(() => {
    const { position: tp, lookAt: tl } = getCameraTarget(mode, targetZone, activeZone);

    // Parallax only in exploring mode — dampen to near-zero when focused
    const pStrength = mode === "focused" ? 0.15 : 0.8;
    parallax.current.x += (mouse.current.x * pStrength - parallax.current.x) * 0.04;
    parallax.current.y += (-mouse.current.y * pStrength * 0.5 - parallax.current.y) * 0.04;

    const destX = tp[0] + parallax.current.x;
    const destY = tp[1] + parallax.current.y;
    const destZ = tp[2];

    camTarget.current.set(destX, destY, destZ);
    camera.position.lerp(camTarget.current, LERP_SPEED);

    lookAtTarget.current.lerp(new THREE.Vector3(...tl), LERP_SPEED);
    camera.lookAt(lookAtTarget.current);

    // Detect arrival and complete transition
    if (isTransitioning) {
      const dist = camera.position.distanceTo(camTarget.current);
      if (dist < ARRIVAL_THRESHOLD) completeTransition();
    }
  });

  return null;
}

export function StudioDioramaCanvas() {
  const unfocusZone = useStudioStore((s) => s.unfocusZone);
  const activeZone = useStudioStore((s) => s.activeZone);

  return (
    <Canvas
      camera={{ position: HERO_CAMERA.position, fov: 50, near: 0.1, far: 100 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
      onPointerMissed={() => {
        if (activeZone) unfocusZone();
      }}
    >
      <color attach="background" args={["#FAF6F1"]} />

      <CameraRig />
      <StudioLighting />
      <StudioRoom />

      {Object.values(ZONES).map((zone) => (
        <ServiceZone key={zone.id} zone={zone} />
      ))}

      <fog attach="fog" args={["#FAF6F1", 18, 50]} />
    </Canvas>
  );
}
