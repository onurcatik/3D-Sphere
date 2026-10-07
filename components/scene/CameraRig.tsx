"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { PerspectiveCamera } from "three";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import type { RuntimeStateRef } from "@/lib/types";

export function CameraRig({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const { camera, pointer } = useThree();
  const basePosition = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const focusTarget = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const localUp = useMemo(() => new THREE.Vector3(), []);
  const worldUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    const sample = runtimeStateRef.current.sceneSample;
    if (!sample || !("isPerspectiveCamera" in camera)) return;

    const perspective = camera as PerspectiveCamera;
    const cameraSample = sample.camera;
    basePosition.set(...cameraSample.position);
    position.copy(basePosition);
    target.set(...cameraSample.target);

    if (profile.inputMode === "mouse" && profile.pointerParallax > 0) {
      forward.copy(target).sub(position).normalize();
      right.crossVectors(forward, worldUp).normalize();
      localUp.crossVectors(right, forward).normalize();
      const parallaxGain = cameraSample.parallaxGain;
      const parallaxPosition = 0.045 * profile.pointerParallax * parallaxGain;
      const parallaxTarget = 0.018 * profile.pointerParallax * parallaxGain;
      position
        .addScaledVector(right, pointer.x * parallaxPosition)
        .addScaledVector(localUp, pointer.y * parallaxPosition * 0.72);
      target
        .addScaledVector(right, pointer.x * parallaxTarget)
        .addScaledVector(localUp, pointer.y * parallaxTarget * 0.55);
    }

    focusTarget.set(...cameraSample.focusTarget);
    perspective.up.set(0, 1, 0);
    perspective.position.copy(position);
    perspective.fov = cameraSample.fov;
    perspective.near = 0.10;
    perspective.far = 60;
    perspective.updateProjectionMatrix();
    perspective.lookAt(target);
    perspective.rotateZ(THREE.MathUtils.degToRad(cameraSample.roll));

    runtimeStateRef.current.focusDistance = perspective.position.distanceTo(focusTarget);
    runtimeStateRef.current.cameraLabel = `${cameraSample.label} / ${profile.tier}`;
  }, -20);

  return null;
}
