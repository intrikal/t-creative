/**
 * ScrollCamera — Scroll-driven camera controller for the StudioPortal.
 *
 * Phases (tied to parent section's scrollYProgress via Zustand):
 *   0-30%   Approach: Camera starts outside, dollies in through doorway
 *   30-50%  Survey: Camera settles at center, zone lights fade up sequentially
 *   50-62%  Focus: Lash zone
 *   62-75%  Focus: Jewelry zone
 *   75-87%  Focus: Crochet/3D zone
 *   87-100% Focus: Consulting zone
 *
 * Camera paths use bezier-like arcs (not linear lerps) for cinematic feel.
 *
 * Client Component — runs inside R3F Canvas via useFrame.
 */
"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES, HERO_CAMERA, CENTER_CAMERA } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";

/** Camera waypoints for scroll-driven tour */
const WAYPOINTS = {
  // Outside the room, looking in
  approach: {
    position: new THREE.Vector3(0, 3.5, 14),
    lookAt: new THREE.Vector3(0, 1, -4),
  },
  // Just inside the doorway
  threshold: {
    position: new THREE.Vector3(0, 2.8, 6),
    lookAt: new THREE.Vector3(0, 1, -5),
  },
  // Center of room, surveying
  center: {
    position: new THREE.Vector3(...CENTER_CAMERA.position),
    lookAt: new THREE.Vector3(...CENTER_CAMERA.lookAt),
  },
  // Zone-specific positions
  lash: {
    position: new THREE.Vector3(...ZONES.lash.cameraPosition),
    lookAt: new THREE.Vector3(...ZONES.lash.cameraLookAt),
  },
  jewelry: {
    position: new THREE.Vector3(...ZONES.jewelry.cameraPosition),
    lookAt: new THREE.Vector3(...ZONES.jewelry.cameraLookAt),
  },
  crochet: {
    position: new THREE.Vector3(...ZONES.crochet.cameraPosition),
    lookAt: new THREE.Vector3(...ZONES.crochet.cameraLookAt),
  },
  consulting: {
    position: new THREE.Vector3(...ZONES.consulting.cameraPosition),
    lookAt: new THREE.Vector3(...ZONES.consulting.cameraLookAt),
  },
};

interface ScrollCameraProps {
  scrollProgress: number;
}

export function ScrollCamera({ scrollProgress }: ScrollCameraProps) {
  const { camera, pointer } = useThree();
  const currentPos = useRef(new THREE.Vector3(...WAYPOINTS.approach.position.toArray()));
  const currentLookAt = useRef(new THREE.Vector3(...WAYPOINTS.approach.lookAt.toArray()));
  const targetPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const { mode } = useStudioStore();

  useFrame(() => {
    // If the user has entered interactive studio mode, don't override
    if (mode !== "landing") return;

    const p = scrollProgress;

    // Determine target based on scroll position
    if (p < 0.3) {
      // Approach phase: dolly from outside to threshold
      const t = p / 0.3;
      const eased = easeInOutCubic(t);
      targetPos.current.lerpVectors(
        WAYPOINTS.approach.position,
        WAYPOINTS.threshold.position,
        eased,
      );
      targetLookAt.current.lerpVectors(
        WAYPOINTS.approach.lookAt,
        WAYPOINTS.threshold.lookAt,
        eased,
      );
    } else if (p < 0.5) {
      // Survey phase: threshold to center
      const t = (p - 0.3) / 0.2;
      const eased = easeInOutCubic(t);
      targetPos.current.lerpVectors(WAYPOINTS.threshold.position, WAYPOINTS.center.position, eased);
      targetLookAt.current.lerpVectors(WAYPOINTS.threshold.lookAt, WAYPOINTS.center.lookAt, eased);
    } else if (p < 0.625) {
      // Lash zone
      const t = (p - 0.5) / 0.125;
      const eased = easeInOutCubic(t);
      targetPos.current.lerpVectors(WAYPOINTS.center.position, WAYPOINTS.lash.position, eased);
      targetLookAt.current.lerpVectors(WAYPOINTS.center.lookAt, WAYPOINTS.lash.lookAt, eased);
    } else if (p < 0.75) {
      // Jewelry zone
      const t = (p - 0.625) / 0.125;
      const eased = easeInOutCubic(t);
      targetPos.current.lerpVectors(WAYPOINTS.lash.position, WAYPOINTS.jewelry.position, eased);
      targetLookAt.current.lerpVectors(WAYPOINTS.lash.lookAt, WAYPOINTS.jewelry.lookAt, eased);
    } else if (p < 0.875) {
      // Crochet zone
      const t = (p - 0.75) / 0.125;
      const eased = easeInOutCubic(t);
      targetPos.current.lerpVectors(WAYPOINTS.jewelry.position, WAYPOINTS.crochet.position, eased);
      targetLookAt.current.lerpVectors(WAYPOINTS.jewelry.lookAt, WAYPOINTS.crochet.lookAt, eased);
    } else {
      // Consulting zone
      const t = (p - 0.875) / 0.125;
      const eased = easeInOutCubic(Math.min(t, 1));
      targetPos.current.lerpVectors(
        WAYPOINTS.crochet.position,
        WAYPOINTS.consulting.position,
        eased,
      );
      targetLookAt.current.lerpVectors(
        WAYPOINTS.crochet.lookAt,
        WAYPOINTS.consulting.lookAt,
        eased,
      );
    }

    // Smooth follow with slight delay
    currentPos.current.lerp(targetPos.current, 0.08);
    currentLookAt.current.lerp(targetLookAt.current, 0.08);

    // Subtle mouse parallax
    const px = pointer.x * 0.1;
    const py = pointer.y * 0.05;

    camera.position.set(currentPos.current.x + px, currentPos.current.y + py, currentPos.current.z);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
