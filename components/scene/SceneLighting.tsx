"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import type { RuntimeStateRef } from "@/lib/types";

export function SceneLighting({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.SpotLight>(null);
  const warmRim = useRef<THREE.SpotLight>(null);
  const coolFill = useRef<THREE.PointLight>(null);
  const coreKey = useRef<THREE.PointLight>(null);
  const keyTarget = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.set(0, 0.2, 0);
    return object;
  }, []);
  const rimTarget = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.set(0, 0.05, 0);
    return object;
  }, []);

  useFrame(() => {
    const sample = runtimeStateRef.current.sceneSample;
    if (!sample) return;
    const look = sample.look;
    const lighting = sample.lighting;
    const energy = Math.min(1.5, Math.max(0, sample.camera.energy));

    if (ambient.current) ambient.current.intensity = look.ambientIntensity * 0.42 * lighting.ambientGain;
    if (hemisphere.current) hemisphere.current.intensity = 0.17 * lighting.ambientGain;
    if (key.current) key.current.intensity = look.topLightIntensity * 0.72 * lighting.keyGain;
    if (warmRim.current) warmRim.current.intensity = look.goldRimIntensity * 0.86 * lighting.rimGain;
    if (coolFill.current) coolFill.current.intensity = look.blueFillIntensity * 0.50 * lighting.fillGain;
    if (coreKey.current) {
      coreKey.current.intensity = (1.9 + energy * 3.0) * sample.coreEnergy.lightGain * lighting.coreGain;
    }
  });

  return (
    <>
      <primitive object={keyTarget} />
      <primitive object={rimTarget} />
      <ambientLight ref={ambient} intensity={0.04} color="#74869a" />
      <hemisphereLight ref={hemisphere} args={["#8ab8d6", "#080a0d", 0.16]} />
      <spotLight
        ref={key}
        target={keyTarget}
        position={[4.8, 8.4, 5.6]}
        angle={0.42}
        penumbra={0.88}
        intensity={35}
        distance={30}
        color="#dcecff"
        castShadow={profile.shadows === "high"}
        shadow-mapSize-width={profile.shadowMapSize}
        shadow-mapSize-height={profile.shadowMapSize}
        shadow-bias={-0.00022}
        shadow-normalBias={0.035}
      />
      <spotLight
        ref={warmRim}
        target={rimTarget}
        position={[-5.6, 3.8, -3.6]}
        angle={0.58}
        penumbra={0.90}
        intensity={18}
        distance={18}
        color="#d9a46d"
      />
      <pointLight ref={coolFill} position={[5.0, 1.6, 3.4]} intensity={9} distance={15} decay={2} color="#5b9fe8" />
      <pointLight ref={coreKey} position={[0, 0.1, 0.75]} intensity={4} distance={6.4} decay={2} color="#a9dcff" />
    </>
  );
}
