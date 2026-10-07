"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import { sampleScene } from "@/lib/sceneTimeline";
import { getParticleBudget } from "@/lib/particleBudget";
import type { RuntimeStateRef } from "@/lib/types";

export function SceneTimelineDriver({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const particleBudget = useMemo(() => getParticleBudget(profile), [profile.tier]);

  useFrame(() => {
    const runtime = runtimeStateRef.current;
    const sample = sampleScene(runtime.sceneTime, profile);
    runtime.sceneSample = sample;

    runtime.cinematicProgress = sample.cinematicProgress;
    runtime.energy = sample.camera.energy;
    runtime.bloom = sample.camera.bloom;
    runtime.exposure = sample.look.exposure;
    runtime.bloomIntensity = sample.look.bloomGain;
    runtime.bloomThreshold = sample.look.bloomThreshold;
    runtime.vignetteDarkness = sample.look.vignetteDarkness;
    runtime.dofBokehScale = profile.dof ? sample.look.bokehScale : 0;
    runtime.fogDensity = sample.look.fogDensity;
    runtime.beamOpacity = sample.look.beamOpacity;
    runtime.particleIntensity = sample.particle.opacity;
    runtime.particleExpansion = sample.particle.expansion;
    runtime.magneticPull = sample.particle.magneticPull;
    runtime.sparkBurst = sample.particle.burst;
    runtime.lightningGain = sample.particle.lightningGain * sample.postFx.additiveGain;
    runtime.particleBudgetTotal = particleBudget.total;
    runtime.particleBudgetCap = particleBudget.cap;
    runtime.postFxSaturationRisk = sample.postFx.saturationRisk;
    runtime.postFxAdditiveGain = sample.postFx.additiveGain;
  }, -100);

  return null;
}
