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

/** Boots the store into "exploring" and auto-completes transitions (no camera lerp). */
function DioramaInit() {
  const mode = useStudioStore((s) => s.mode);
  const isTransitioning = useStudioStore((s) => s.isTransitioning);
  const enterStudio = useStudioStore((s) => s.enterStudio);
  const completeTransition = useStudioStore((s) => s.completeTransition);

  useEffect(() => {
    if (mode === "landing") {
      enterStudio();
      completeTransition();
    }
  }, [mode, enterStudio, completeTransition]);

  useEffect(() => {
    if (isTransitioning) {
      completeTransition();
    }
  }, [isTransitioning, completeTransition]);

  return null;
}

export function StudioDioramaCanvas() {
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
