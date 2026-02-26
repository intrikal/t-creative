/**
 * ScrollQuietRoom — R3F Canvas wrapper for scroll-driven 3D studio.
 *
 * Like QuietRoom but accepts scrollProgress prop and uses ScrollStudioScene
 * instead of the interactive StudioScene.
 *
 * Client Component — hosts the Three.js WebGL renderer.
 */
"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import { ScrollStudioScene } from "./ScrollStudioScene";

interface ScrollQuietRoomProps {
  scrollProgress: number;
}

export function ScrollQuietRoom({ scrollProgress }: ScrollQuietRoomProps) {
  return (
    <CanvasErrorBoundary>
      <Canvas
        camera={{
          fov: 50,
          near: 0.1,
          far: 100,
          position: [0, 3.5, 14],
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        style={{ background: "#FAF6F1" }}
      >
        <Suspense fallback={null}>
          <ScrollStudioScene scrollProgress={scrollProgress} />
        </Suspense>
      </Canvas>
    </CanvasErrorBoundary>
  );
}
