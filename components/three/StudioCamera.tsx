/**
 * StudioCamera — Lerp-driven camera controller for studio navigation.
 *
 * Smoothly interpolates camera position/lookAt toward the active zone target.
 * Includes subtle mouse parallax and reduced-motion support.
 * Client Component — runs inside R3F Canvas via useFrame.
 */
"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES, HERO_CAMERA, CENTER_CAMERA } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";

const LERP_RATE = 0.025;
const ARRIVAL_THRESHOLD = 0.08;

export function StudioCamera() {
  const { camera, pointer } = useThree();
  const { mode, activeZone, targetZone, isTransitioning, completeTransition } = useStudioStore();

  const basePosition = useRef(new THREE.Vector3(...HERO_CAMERA.position));
  const baseLookAt = useRef(new THREE.Vector3(...HERO_CAMERA.lookAt));
  const targetPos = useRef(new THREE.Vector3(...HERO_CAMERA.position));
  const targetLook = useRef(new THREE.Vector3(...HERO_CAMERA.lookAt));
  const lookAtPoint = useRef(new THREE.Vector3(...HERO_CAMERA.lookAt));

  const reducedMotion = useRef(false);
  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useFrame(() => {
    // Determine camera target based on current state
    if (mode === "landing" || mode === "exiting") {
      targetPos.current.set(...HERO_CAMERA.position);
      targetLook.current.set(...HERO_CAMERA.lookAt);
    } else if (mode === "focused" && activeZone) {
      const zone = ZONES[activeZone];
      targetPos.current.set(...zone.cameraPosition);
      targetLook.current.set(...zone.cameraLookAt);
    } else if (targetZone) {
      const zone = ZONES[targetZone];
      targetPos.current.set(...zone.cameraPosition);
      targetLook.current.set(...zone.cameraLookAt);
    } else {
      // exploring — center of room
      targetPos.current.set(...CENTER_CAMERA.position);
      targetLook.current.set(...CENTER_CAMERA.lookAt);
    }

    // Lerp toward target (or snap for reduced motion)
    const rate = reducedMotion.current ? 1 : LERP_RATE;
    basePosition.current.lerp(targetPos.current, rate);
    baseLookAt.current.lerp(targetLook.current, rate);

    // Mouse parallax — subtle, only when idle
    const parallaxFactor = isTransitioning ? 0 : 0.8;
    const px = pointer.x * 0.15 * parallaxFactor;
    const py = pointer.y * 0.08 * parallaxFactor;

    camera.position.set(
      basePosition.current.x + px,
      basePosition.current.y + py,
      basePosition.current.z,
    );

    lookAtPoint.current.copy(baseLookAt.current);
    camera.lookAt(lookAtPoint.current);

    // Arrival detection
    if (isTransitioning && basePosition.current.distanceTo(targetPos.current) < ARRIVAL_THRESHOLD) {
      basePosition.current.copy(targetPos.current);
      baseLookAt.current.copy(targetLook.current);
      completeTransition();
    }
  });

  return null;
}
