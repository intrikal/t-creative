"use client";

/**
 * StudioRoom — The physical environment.
 *
 * Layout: A warm, open-plan creative studio with:
 * - Wood-toned floor (warm oak, matte)
 * - Three ivory/cream walls + one teal accent wall (back)
 * - Baseboard trim at floor-wall junction
 * - A large circular area rug in the center
 * - Subtle crown molding implied by ceiling edge lighting
 *
 * The room is 14 units wide × 10 deep × 4.5 tall.
 * Zones are arranged along the walls:
 *   Back-left: Lash    Back-right: Crochet
 *   Front-left: Consulting   Front-right: Jewelry
 */

import { MeshReflectorMaterial } from "@react-three/drei";

const W = 14; // width (X axis)
const D = 10; // depth (Z axis, room extends in -Z)
const H = 4.5; // height
const IVORY = "#F5F0E8";
const TEAL = "#5B8A8A"; // muted teal accent wall
const WOOD = "#C4A882"; // warm oak floor
const BASEBOARD = "#E8DFD0";
const RUG = "#7BA3A3"; // soft teal-sage rug

export function StudioRoom() {
  const halfW = W / 2;

  return (
    <group>
      {/* ── FLOOR ── */}
      {/* Wood floor with subtle reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -D / 2]}>
        <planeGeometry args={[W, D]} />
        <MeshReflectorMaterial
          color={WOOD}
          blur={[300, 80]}
          resolution={512}
          mixBlur={0.9}
          mixStrength={0.12}
          roughness={0.75}
          depthScale={0.2}
          mirror={0.08}
        />
      </mesh>

      {/* Center area rug — circular, soft teal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -D / 2 + 1]}>
        <circleGeometry args={[2.2, 64]} />
        <meshStandardMaterial color={RUG} roughness={0.95} metalness={0} />
      </mesh>
      {/* Rug border ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -D / 2 + 1]}>
        <ringGeometry args={[2.2, 2.35, 64]} />
        <meshStandardMaterial color="#5B8A8A" roughness={0.9} transparent opacity={0.6} />
      </mesh>

      {/* ── CEILING ── */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, -D / 2]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={IVORY} roughness={0.95} />
      </mesh>

      {/* ── WALLS ── */}

      {/* Back wall — teal accent */}
      <mesh position={[0, H / 2, -D]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={TEAL} roughness={0.85} />
      </mesh>

      {/* Left wall — ivory */}
      <mesh position={[-halfW, H / 2, -D / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color={IVORY} roughness={0.9} />
      </mesh>

      {/* Right wall — ivory */}
      <mesh position={[halfW, H / 2, -D / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color={IVORY} roughness={0.9} />
      </mesh>

      {/* ── BASEBOARDS ── */}
      {/* Thin strips at the bottom of each wall for realism */}
      <Baseboard position={[0, 0.06, -D + 0.01]} width={W} />
      <Baseboard position={[-halfW + 0.01, 0.06, -D / 2]} width={D} rotY={Math.PI / 2} />
      <Baseboard position={[halfW - 0.01, 0.06, -D / 2]} width={D} rotY={-Math.PI / 2} />

      {/* ── DECORATIVE ELEMENTS ── */}

      {/* Ceiling edge strip — warm accent line where ceiling meets back wall */}
      <mesh position={[0, H - 0.04, -D + 0.02]}>
        <boxGeometry args={[W, 0.08, 0.04]} />
        <meshStandardMaterial color={BASEBOARD} roughness={0.8} />
      </mesh>
      {/* Side ceiling strips */}
      <mesh position={[-halfW + 0.02, H - 0.04, -D / 2]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[D, 0.08, 0.04]} />
        <meshStandardMaterial color={BASEBOARD} roughness={0.8} />
      </mesh>
      <mesh position={[halfW - 0.02, H - 0.04, -D / 2]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[D, 0.08, 0.04]} />
        <meshStandardMaterial color={BASEBOARD} roughness={0.8} />
      </mesh>

      {/* Window-light panels on back wall — implied natural light */}
      <WindowPanel position={[-3, 2.8, -D + 0.02]} />
      <WindowPanel position={[3, 2.8, -D + 0.02]} />

      {/* ── WALL ART / FRAMES ── */}
      {/* Left wall — two staggered frames */}
      <ArtFrame
        position={[-halfW + 0.03, 2.2, -3.5]}
        rotY={Math.PI / 2}
        width={0.6}
        height={0.8}
        color="#C4907A"
      />
      <ArtFrame
        position={[-halfW + 0.03, 2.5, -7]}
        rotY={Math.PI / 2}
        width={0.5}
        height={0.5}
        color="#7BA3A3"
      />

      {/* Right wall — one large frame */}
      <ArtFrame
        position={[halfW - 0.03, 2.3, -5]}
        rotY={-Math.PI / 2}
        width={0.9}
        height={0.6}
        color="#D4A574"
      />

      {/* ── FLOOR PLANTS ── */}
      {/* Tall plant near front-left corner */}
      <FloorPlant position={[-6.2, 0, -0.8]} />
      {/* Medium plant near back-right corner */}
      <FloorPlant position={[6.2, 0, -8.5]} size={0.8} />

      {/* ── SMALL ACCENT RUGS under seating zones ── */}
      {/* Rug under lash zone — soft blush */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, 0.003, -7.5]}>
        <planeGeometry args={[3.2, 2.6]} />
        <meshStandardMaterial
          color="#E8D4CC"
          roughness={0.95}
          metalness={0}
          transparent
          opacity={0.4}
        />
      </mesh>
      {/* Rug under consulting zone — soft sage */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, 0.003, -2.5]}>
        <planeGeometry args={[2.4, 2.0]} />
        <meshStandardMaterial
          color="#B8C8C0"
          roughness={0.95}
          metalness={0}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}

/** Thin baseboard strip */
function Baseboard({
  position,
  width,
  rotY = 0,
}: {
  position: [number, number, number];
  width: number;
  rotY?: number;
}) {
  return (
    <mesh position={position} rotation={[0, rotY, 0]}>
      <boxGeometry args={[width, 0.12, 0.03]} />
      <meshStandardMaterial color={BASEBOARD} roughness={0.7} />
    </mesh>
  );
}

/** Implied window — a softly glowing rectangle on the back wall */
function WindowPanel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Window glass glow */}
      <mesh>
        <planeGeometry args={[1.8, 1.2]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#F5E6D3"
          emissiveIntensity={0.4}
          roughness={1}
          transparent
          opacity={0.25}
        />
      </mesh>
      {/* Window frame — thin border */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[1.9, 1.3]} />
        <meshStandardMaterial color={BASEBOARD} roughness={0.7} />
      </mesh>
      {/* Window mullion — vertical divider */}
      <mesh position={[0, 0, 0.005]}>
        <boxGeometry args={[0.03, 1.2, 0.01]} />
        <meshStandardMaterial color={BASEBOARD} roughness={0.7} />
      </mesh>
      {/* Window mullion — horizontal divider */}
      <mesh position={[0, 0, 0.005]}>
        <boxGeometry args={[1.8, 0.03, 0.01]} />
        <meshStandardMaterial color={BASEBOARD} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Framed art piece for walls — colored rectangle with thin frame */
function ArtFrame({
  position,
  rotY = 0,
  width,
  height,
  color,
}: {
  position: [number, number, number];
  rotY?: number;
  width: number;
  height: number;
  color: string;
}) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Frame border */}
      <mesh>
        <boxGeometry args={[width + 0.06, height + 0.06, 0.02]} />
        <meshStandardMaterial color="#E8DFD0" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Art canvas — color block */}
      <mesh position={[0, 0, 0.011]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

/** Potted floor plant — ceramic pot with foliage spheres */
function FloorPlant({ position, size = 1 }: { position: [number, number, number]; size?: number }) {
  return (
    <group position={position} scale={[size, size, size]}>
      {/* Pot */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.1, 0.3, 12]} />
        <meshStandardMaterial color="#D4C4A8" roughness={0.8} metalness={0} />
      </mesh>
      {/* Pot rim */}
      <mesh position={[0, 0.31, 0]}>
        <cylinderGeometry args={[0.13, 0.12, 0.02, 12]} />
        <meshStandardMaterial color="#D4C4A8" roughness={0.8} metalness={0} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.11, 12]} />
        <meshStandardMaterial color="#5A4A3A" roughness={0.95} metalness={0} />
      </mesh>
      {/* Foliage — overlapping spheres */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#5B8B5B" roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0.06, 0.65, 0.04]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color="#6B9B6B" roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[-0.05, 0.62, -0.03]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color="#4B7B4B" roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0.02, 0.72, 0.02]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#7BAB7B" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}
