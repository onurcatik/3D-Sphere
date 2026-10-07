"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useProgress } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import type { RuntimeStateRef } from "@/lib/types";
import { applyPremiumOrbMaterials } from "@/lib/orbMaterialSystem";
import { getParticleBudget } from "@/lib/particleBudget";
import { createCoreEnergyRuntime } from "@/lib/runtime/coreEnergyRuntime.js";
import { createReassemblyRuntime } from "@/lib/runtime/reassemblyRuntime.js";
import { configureSeekableAction, seekAnimationAction } from "@/lib/runtime/seekAnimationAction.js";

type CoreRuntime = ReturnType<typeof createCoreEnergyRuntime>;
type ReassemblyRuntime = ReturnType<typeof createReassemblyRuntime>;

export function OrbModel({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const gltf = useGLTF(profile.url);
  const stage = useThree((state) => state.scene);
  const objectBundle = useMemo(() => {
    const instance = gltf.scene.clone(true);
    instance.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      // V3 FAZ 3 assets embed normals. Keep this guarded fallback for a damaged or
      // legacy asset so custom energy shaders never receive a missing normal attribute.
      if (!node.geometry.getAttribute("normal")) node.geometry.computeVertexNormals();
    });
    const materialAudit = applyPremiumOrbMaterials(instance, profile);
    return { object: instance, baseMaterials: materialAudit.created, materialAudit };
  }, [gltf.scene, profile]);
  const object = objectBundle.object;
  const particleBudget = useMemo(() => getParticleBudget(profile), [profile.tier]);
  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const clipRef = useRef<THREE.AnimationClip | null>(null);
  const coreRuntimeRef = useRef<CoreRuntime | null>(null);
  const reassemblyRuntimeRef = useRef<ReassemblyRuntime | null>(null);

  useEffect(() => {
    object.name = "FAZ13_ORB_INSTANCE";
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.frustumCulled = true;
      node.castShadow = profile.shadows === "high";
      node.receiveShadow = profile.shadows === "high";
    });

    const clip = gltf.animations.find((item) => item.name === "Orb_Main_Cinematic");
    if (!clip) {
      throw new Error("Orb_Main_Cinematic animation clip was not found in the selected GLB.");
    }
    clipRef.current = clip;
    const action = mixer.clipAction(clip, object);
    configureSeekableAction(action, THREE.LoopOnce);
    actionRef.current = action;

    const runtime = createCoreEnergyRuntime(object, stage, {
      particleCount: particleBudget.core,
      crystalTransmission: profile.profile === "mobile" ? 0.58 : 0.72,
      energy: 1,
      profile: profile.profile,
      arcCount: profile.profile === "mobile" ? 3 : 5
    });
    coreRuntimeRef.current = runtime;

    const reassemblyRuntime = createReassemblyRuntime(object, stage, { profile: profile.profile });
    reassemblyRuntimeRef.current = reassemblyRuntime;

    return () => {
      action.stop();
      coreRuntimeRef.current?.dispose();
      reassemblyRuntimeRef.current?.dispose();
      mixer.uncacheRoot(object);
      coreRuntimeRef.current = null;
      reassemblyRuntimeRef.current = null;
      actionRef.current = null;
      clipRef.current = null;
    };
  }, [gltf.animations, mixer, object, particleBudget.core, profile.profile, profile.shadows, stage]);

  useEffect(() => () => {
    objectBundle.baseMaterials.forEach((material) => material.dispose());
  }, [objectBundle]);

  useFrame(() => {
    const action = actionRef.current;
    const clip = clipRef.current;
    if (action && clip) {
      const sample = runtimeStateRef.current.sceneSample;
      const progress = sample?.cinematicProgress ?? runtimeStateRef.current.cinematicProgress;
      const time = THREE.MathUtils.clamp(progress, 0, 1) * clip.duration;
      seekAnimationAction(mixer, action, time, clip.duration);
    }

    const sample = runtimeStateRef.current.sceneSample;
    if (sample) {
      objectBundle.baseMaterials.forEach((material) => {
        if (material.userData.premiumRole !== "shell-inner") return;
        const physical = material as THREE.MeshPhysicalMaterial;
        const seamGlow = Math.max(sample.breakup.seamGlow, sample.reassembly.seamGlow);
        physical.emissiveIntensity = 0.12 + seamGlow * (profile.profile === "mobile" ? 0.62 : 0.92);
      });
    }

    const reassemblyRuntime = reassemblyRuntimeRef.current;
    if (reassemblyRuntime && sample) {
      reassemblyRuntime.update(sample.sceneTime, sample.reassembly, sample.postFx.additiveGain);
    }

    const runtime = coreRuntimeRef.current;
    if (runtime) {
      const particleEnergy = sample?.particle;
      runtime.setEnergy(sample?.camera.energy ?? runtimeStateRef.current.energy);
      runtime.setSpeed(particleEnergy?.flowSpeed ?? 0.42);
      runtime.setLightningGain((particleEnergy?.lightningGain ?? runtimeStateRef.current.lightningGain) * (sample?.postFx.additiveGain ?? 1));
      runtime.setVisualBudget(sample?.postFx.additiveGain ?? 1, sample?.postFx.particleGain ?? 1, sample?.postFx.shaftGain ?? 1);
      runtime.setCoreState(sample?.coreEnergy);
      runtime.update(sample?.flowTime ?? 0, sample?.sceneTime ?? 0);
    }
  });

  return <primitive object={object} dispose={null} />;
}

export function OrbLoadingFallback() {
  const { active } = useProgress();
  if (!active) return null;
  return (
      <div className="canvas-loader" role="status" aria-live="polite">
        <span className="canvas-loader__ring" />
        <small>3D CORE YÜKLENİYOR</small>
      </div>
  );
}
