/**
 * QuietRoom — R3F Canvas wrapper for the 3D studio experience.
 *
 * Dynamically imported with ssr: false from StudioSection.
 * Client Component — hosts the Three.js WebGL renderer.
 */
"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import { StudioScene } from "./StudioScene";

export function QuietRoom() {
  return (
    <CanvasErrorBoundary>
      <Canvas
        camera={{
          fov: 50,
          near: 0.1,
          far: 100,
          position: [0, 2.8, 9],
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        style={{ background: "#FAF6F1" }}
      >
        <Suspense fallback={null}>
          <StudioScene />
        </Suspense>
      </Canvas>
    </CanvasErrorBoundary>
  );
}
