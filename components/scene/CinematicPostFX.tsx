"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, DepthOfField, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BloomEffect, DepthOfFieldEffect, VignetteEffect, ToneMappingMode } from "postprocessing";
import { useRef } from "react";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import { getComposerMultisampling } from "@/lib/postProcessingBudget";
import type { RuntimeStateRef } from "@/lib/types";

export function CinematicPostFX({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const bloomRef = useRef<BloomEffect>(null);
  const dofRef = useRef<DepthOfFieldEffect>(null);
  const vignetteRef = useRef<VignetteEffect>(null);
  const camera = useThree((state) => state.camera);
  const multisampling = getComposerMultisampling(profile);

  useFrame(() => {
    const sample = runtimeStateRef.current.sceneSample;
    if (!sample) return;
    const postFx = sample.postFx;

    if (bloomRef.current) {
      bloomRef.current.intensity = postFx.bloomIntensity;
      const luminance = bloomRef.current.luminanceMaterial;
      if (luminance) {
        luminance.threshold = postFx.bloomThreshold;
        luminance.smoothing = postFx.bloomSmoothing;
      }
    }

    if (dofRef.current && "far" in camera) {
      const far = Math.max(1, Number(camera.far || 90));
      const normalizedFocus = Math.min(0.18, Math.max(0.008, runtimeStateRef.current.focusDistance / far));
      const dof = dofRef.current;
      if (dof.circleOfConfusionMaterial) {
        dof.circleOfConfusionMaterial.focusDistance = normalizedFocus;
        dof.circleOfConfusionMaterial.focalLength = sample.look.focalLength;
      }
      if ("focusDistance" in dof) dof.focusDistance = normalizedFocus;
      if ("focalLength" in dof) dof.focalLength = sample.look.focalLength;
      dof.bokehScale = postFx.bokehScale;
    }

    if (vignetteRef.current) {
      vignetteRef.current.darkness = postFx.vignetteDarkness;
      vignetteRef.current.offset = sample.look.vignetteOffset;
    }

    runtimeStateRef.current.bloomIntensity = postFx.bloomIntensity;
    runtimeStateRef.current.bloomThreshold = postFx.bloomThreshold;
    runtimeStateRef.current.dofBokehScale = postFx.bokehScale;
    runtimeStateRef.current.postFxSaturationRisk = postFx.saturationRisk;
    runtimeStateRef.current.postFxAdditiveGain = postFx.additiveGain;
    runtimeStateRef.current.composerMultisampling = multisampling;
  });

  return (
    <EffectComposer multisampling={multisampling}>
      <Bloom
        ref={bloomRef}
        intensity={0.42}
        luminanceThreshold={1.12}
        luminanceSmoothing={0.68}
        mipmapBlur={profile.tier !== "low-power"}
      />
      {profile.dof && (
        <DepthOfField
          ref={dofRef}
          focusDistance={0.055}
          focalLength={0.02}
          bokehScale={0.75}
        />
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette ref={vignetteRef} offset={0.16} darkness={0.52} />
    </EffectComposer>
  );
}
