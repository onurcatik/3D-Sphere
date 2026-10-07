"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { RuntimeStateRef } from "@/lib/types";

export function CinematicAtmosphere({ runtimeStateRef }: { runtimeStateRef: RuntimeStateRef }) {
  const { gl, scene } = useThree();
  const darkFog = useMemo(() => new THREE.Color("#02050a"), []);
  const blueFog = useMemo(() => new THREE.Color("#071a2d"), []);
  const clearBlue = useMemo(() => new THREE.Color("#06111e"), []);
  const fogColor = useMemo(() => new THREE.Color(), []);
  const clearColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const previousFog = scene.fog;
    const fog = new THREE.FogExp2("#02050a", 0.03);
    scene.fog = fog;
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.setClearColor("#010409", 1);

    return () => {
      scene.fog = previousFog;
    };
  }, [gl, scene]);

  useFrame(() => {
    const sample = runtimeStateRef.current.sceneSample;
    if (!sample) return;
    const look = sample.look;
    const lighting = sample.lighting;
    gl.toneMappingExposure = look.exposure * lighting.exposureTrim;

    const fogMix = Math.max(0, Math.min(1, look.fogBlueMix + lighting.fogBlueBias));
    fogColor.copy(darkFog).lerp(blueFog, fogMix);
    clearColor.copy(darkFog).lerp(clearBlue, lighting.backgroundBlueMix);
    gl.setClearColor(clearColor, 1);

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(fogColor);
      scene.fog.density = look.fogDensity * lighting.fogDensityScale;
    }
  }, -10);

  return null;
}
