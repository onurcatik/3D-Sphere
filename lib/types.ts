import type { MutableRefObject } from "react";
import type { DeviceTier, InputMode } from "./assetProfile";
import type { SceneSample } from "./sceneTimeline";

export type ScrollDirection = -1 | 0 | 1;

export type CinematicRuntimeState = {
  energy: number;
  bloom: number;
  focusDistance: number;
  cameraLabel: string;
  rawScrollProgress: number;
  cinematicProgress: number;
  sceneTime: number;
  sceneSample: SceneSample | null;
  scrollDirection: ScrollDirection;
  scrollVelocity: number;
  activeChapter: string;
  chapterProgress: number;
  exposure: number;
  bloomIntensity: number;
  bloomThreshold: number;
  vignetteDarkness: number;
  dofBokehScale: number;
  fogDensity: number;
  beamOpacity: number;
  particleIntensity: number;
  particleExpansion: number;
  magneticPull: number;
  sparkBurst: number;
  lightningGain: number;
  particleBudgetTotal: number;
  particleBudgetCap: number;
  postFxSaturationRisk: number;
  postFxAdditiveGain: number;
  composerMultisampling: number;
  adaptiveDpr: number;
  averageFps: number;
  qualityTier: DeviceTier;
  viewportClass: string;
  inputMode: InputMode;
};

export type RuntimeStateRef = MutableRefObject<CinematicRuntimeState>;
