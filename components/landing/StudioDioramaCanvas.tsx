/**
 * StudioDioramaCanvas — R3F Canvas with isometric camera and OrbitControls.
 *
 * Renders the studio scene (room + zones + lighting) in a diorama view.
 * OrbitControls lets the user drag to rotate. No auto-rotate, no zoom, no pan.
 *
 * Client Component — must be dynamically imported with ssr: false.
 */
"use client";

import { useEffect } from "react";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { ServiceZone } from "@/components/three/ServiceZone";
import { StudioLighting } from "@/components/three/StudioLighting";
import { StudioRoom } from "@/components/three/StudioRoom";
import { ZONES } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";

/**
 * DioramaInit — Invisible component that initializes the Zustand store for diorama mode.
 * Boots the store into "exploring" on mount and auto-completes any transition state.
 * This exists as a component (not a hook) because it runs inside the R3F Canvas tree
 * and needs access to the React lifecycle within that tree.
 */
function DioramaInit() {
  // Individual selectors to minimize re-renders — each reads only one store field.
  const mode = useStudioStore((s) => s.mode);
  const isTransitioning = useStudioStore((s) => s.isTransitioning);
  const enterStudio = useStudioStore((s) => s.enterStudio);
  const completeTransition = useStudioStore((s) => s.completeTransition);

  // useEffect: when the diorama mounts and the store is still in "landing" mode,
  // immediately transition to studio mode and skip the camera animation (completeTransition).
  // Cannot run during render because it mutates external store state.
  useEffect(() => {
    if (mode === "landing") {
      enterStudio();
      completeTransition();
    }
  }, [mode, enterStudio, completeTransition]);

  // useEffect: catch any transition state (e.g., from zone clicks) and auto-complete it.
  // The diorama uses OrbitControls for camera movement, not animated transitions.
  useEffect(() => {
    if (isTransitioning) {
      completeTransition();
    }
  }, [isTransitioning, completeTransition]);

  return null;
}

export function StudioDioramaCanvas() {
  // Selectors for zone focus state — activeZone determines if a zone is highlighted,
  // unfocusZone resets when user clicks empty space (onPointerMissed).
  const activeZone = useStudioStore((s) => s.activeZone);
  const unfocusZone = useStudioStore((s) => s.unfocusZone);

  return (
    <Canvas
      camera={{
        position: [10, 8, 10],
        fov: 35,
        near: 0.1,
        far: 100,
      }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
      onPointerMissed={() => {
        if (activeZone) unfocusZone();
      }}
    >
      <color attach="background" args={["#FAF6F1"]} />

      <DioramaInit />
      <StudioLighting />
      <StudioRoom />

      {/* Object.values(ZONES) converts the zone registry object into an array for .map().
          Object.values chosen over Object.entries because we only need the zone data, not the keys.
          Each zone renders as a clickable ServiceZone mesh in the 3D scene. */}
      {Object.values(ZONES).map((zone) => (
        <ServiceZone key={zone.id} zone={zone} />
      ))}

      <fog attach="fog" args={["#FAF6F1", 15, 45]} />

      <OrbitControls
        target={[0, 1, -5]}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        minAzimuthAngle={-Math.PI / 3}
        maxAzimuthAngle={Math.PI / 3}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
