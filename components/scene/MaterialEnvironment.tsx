"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import type { RuntimeStateRef } from "@/lib/types";

const BASE_INTENSITY: Record<OrbQualityProfile["tier"], number> = {
  "desktop-high": 0.94,
  "desktop-balanced": 0.88,
  tablet: 0.78,
  mobile: 0.68,
  "low-power": 0.58
};

export function MaterialEnvironment({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const { gl, scene } = useThree();
  const base = useRef(BASE_INTENSITY[profile.tier]);

  useEffect(() => {
    base.current = BASE_INTENSITY[profile.tier];
  }, [profile.tier]);

  useEffect(() => {
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = base.current;
    room.dispose();
    generator.dispose();
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      target.dispose();
    };
  }, [gl, scene]);

  useFrame(() => {
    const sample = runtimeStateRef.current.sceneSample;
    if (!sample) return;
    scene.environmentIntensity = THREEClamp(base.current * sample.lighting.environmentGain, 0.42, 1.02);
  }, -8);

  return null;
}

function THREEClamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
