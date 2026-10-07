import type { OrbQualityProfile } from "./assetProfile";
import { applyCameraProfile, sampleCameraTimeline, type CameraTimelineSample } from "./cameraTimeline";
import { sampleCinematicLook, type CinematicLook } from "./cinematicLook";
import { integrateParticleFlowProgress, sampleParticleEnergy, type ParticleEnergyState } from "./particleEnergy";
import { sampleOrbBreakup, type OrbBreakupState } from "./orbBreakupTimeline";
import { sampleCoreEnergy, type CoreEnergyState } from "./coreEnergyTimeline";
import { sampleOrbReassembly, type OrbReassemblyState } from "./orbReassemblyTimeline";
import { CINEMATIC_DURATION_SECONDS, SCROLL_TIMELINE } from "./scrollTimeline";
import { sampleLighting, type LightingState } from "./lightingTimeline";
import { samplePostProcessingBudget, type PostProcessingBudget } from "./postProcessingBudget";

export type SceneSample = {
  sceneTime: number;
  cinematicProgress: number;
  flowTime: number;
  chapterId: string;
  chapterIndex: number;
  chapterProgress: number;
  camera: CameraTimelineSample;
  look: CinematicLook;
  particle: ParticleEnergyState;
  breakup: OrbBreakupState;
  coreEnergy: CoreEnergyState;
  reassembly: OrbReassemblyState;
  lighting: LightingState;
  postFx: PostProcessingBudget;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function clampSceneTime(sceneTime: number) {
  if (!Number.isFinite(sceneTime)) return 0;
  return Math.max(0, Math.min(CINEMATIC_DURATION_SECONDS, sceneTime));
}

function findSceneSegment(cinematicProgress: number) {
  const progress = clamp01(cinematicProgress);
  for (let index = 0; index < SCROLL_TIMELINE.length; index += 1) {
    const segment = SCROLL_TIMELINE[index];
    const isLast = index === SCROLL_TIMELINE.length - 1;
    if (progress >= segment.sceneStart && (progress < segment.sceneEnd || isLast)) {
      return { segment, index };
    }
  }
  return { segment: SCROLL_TIMELINE[SCROLL_TIMELINE.length - 1], index: SCROLL_TIMELINE.length - 1 };
}

export function sampleScene(sceneTime: number, profile: OrbQualityProfile): SceneSample {
  const clampedTime = clampSceneTime(sceneTime);
  const cinematicProgress = clamp01(clampedTime / CINEMATIC_DURATION_SECONDS);
  const { segment, index } = findSceneSegment(cinematicProgress);
  const chapterSpan = Math.max(1e-9, segment.sceneEnd - segment.sceneStart);
  const chapterProgress = clamp01((cinematicProgress - segment.sceneStart) / chapterSpan);
  const camera = applyCameraProfile(sampleCameraTimeline(cinematicProgress), profile);
  const look = sampleCinematicLook(cinematicProgress);
  const particle = sampleParticleEnergy(cinematicProgress);
  const breakup = sampleOrbBreakup(clampedTime);
  const coreEnergy = sampleCoreEnergy(clampedTime);
  const reassembly = sampleOrbReassembly(clampedTime);
  const lighting = sampleLighting(clampedTime);
  const postFx = samplePostProcessingBudget({
    look,
    coreEnergy,
    lighting,
    breakup,
    particle,
    cameraBloom: camera.bloom,
    profile
  });

  return {
    sceneTime: clampedTime,
    cinematicProgress,
    flowTime: CINEMATIC_DURATION_SECONDS * integrateParticleFlowProgress(cinematicProgress),
    chapterId: segment.id,
    chapterIndex: index,
    chapterProgress,
    camera,
    look,
    particle,
    breakup,
    coreEnergy,
    reassembly,
    lighting,
    postFx
  };
}
