"use client";

import { configureRenderer } from "@/lib/renderPolicy";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import type { RuntimeStateRef } from "@/lib/types";
import { AdaptiveQualityController } from "./AdaptiveQualityController";
import { MaterialEnvironment } from "./MaterialEnvironment";
import { CameraRig } from "./CameraRig";
import { CinematicAtmosphere } from "./CinematicAtmosphere";
import { CinematicPostFX } from "./CinematicPostFX";
import { OrbLoadingFallback, OrbModel } from "./OrbModel";
import { ParticleEnergyField } from "./ParticleEnergyField";
import { SceneLighting } from "./SceneLighting";
import { ShellFractureFX } from "./ShellFractureFX";
import { SceneTimelineDriver } from "./SceneTimelineDriver";
import { TempleEnvironment } from "./TempleEnvironment";
import { VolumetricLightShaft } from "./VolumetricLightShaft";

export function CinematicCanvas({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  return (
    <>
    <OrbLoadingFallback />
    <Canvas
      onCreated={({ gl }) => configureRenderer(gl, profile)}
      dpr={[profile.minDpr, profile.maxDpr]}
      shadows={profile.shadows === "high"}
      camera={{ position: [7.7, 2.7, 9.4], fov: 45, near: 0.10, far: 60 }}
      gl={{ antialias: profile.antialias, alpha: false, powerPreference: "high-performance" }}
      performance={{ min: 0.55, max: 1, debounce: 260 }}
    >
      <MaterialEnvironment profile={profile} runtimeStateRef={runtimeStateRef} />
      <SceneTimelineDriver profile={profile} runtimeStateRef={runtimeStateRef} />
      <AdaptiveQualityController profile={profile} runtimeStateRef={runtimeStateRef} />
      <CinematicAtmosphere runtimeStateRef={runtimeStateRef} />
      <SceneLighting profile={profile} runtimeStateRef={runtimeStateRef} />
      <TempleEnvironment profile={profile} runtimeStateRef={runtimeStateRef} />
      <VolumetricLightShaft profile={profile} runtimeStateRef={runtimeStateRef} />
      <ParticleEnergyField profile={profile} runtimeStateRef={runtimeStateRef} />
      <ShellFractureFX profile={profile} runtimeStateRef={runtimeStateRef} />
      <Suspense fallback={null}>
        <OrbModel profile={profile} runtimeStateRef={runtimeStateRef} />
      </Suspense>
      <CameraRig profile={profile} runtimeStateRef={runtimeStateRef} />
      <CinematicPostFX profile={profile} runtimeStateRef={runtimeStateRef} />
    </Canvas>
    </>
  );
}
