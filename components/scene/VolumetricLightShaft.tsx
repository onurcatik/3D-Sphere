"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import type { RuntimeStateRef } from "@/lib/types";

const sceneSampleGain = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function VolumetricLightShaft({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const sample = runtimeStateRef.current.sceneSample;
    if (!sample) return;
    const look = sample.look;
    const lighting = sample.lighting;
    if (material.current) {
      const pulse = 0.96 + Math.sin(sample.sceneTime * 1.45) * 0.04;
      const mobileGain = profile.profile === "mobile" ? 0.70 : 1;
      material.current.opacity = look.beamOpacity * sceneSampleGain(sample.coreEnergy.beamGain) * lighting.shaftGain * sample.postFx.shaftGain * 0.102 * pulse * mobileGain;
    }
    if (mesh.current) {
      const s = 1 + look.beamOpacity * sample.coreEnergy.beamGain * lighting.shaftGain * 0.018;
      mesh.current.scale.x = s;
      mesh.current.scale.z = s;
    }
  });

  return (
    <mesh ref={mesh} position={[0, 3.9, -0.85]} renderOrder={-1}>
      <cylinderGeometry args={[0.50, 2.45, 12.6, profile.beamSegments, 1, true]} />
      <meshBasicMaterial
        ref={material}
        color="#83bce8"
        transparent
        opacity={0.05}
        depthTest
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
