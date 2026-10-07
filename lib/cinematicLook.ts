export type CinematicLook = {
  exposure: number;
  bloomGain: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  vignetteDarkness: number;
  vignetteOffset: number;
  focalLength: number;
  bokehScale: number;
  fogDensity: number;
  fogBlueMix: number;
  ambientIntensity: number;
  topLightIntensity: number;
  goldRimIntensity: number;
  blueFillIntensity: number;
  beamOpacity: number;
  dustOpacity: number;
};

type LookKeyframe = CinematicLook & { progress: number; id: string };

export const CINEMATIC_LOOK_KEYFRAMES: readonly LookKeyframe[] = [
  { id: "hero", progress: 0.00, exposure: 0.86, bloomGain: 1.00, bloomThreshold: 0.28, bloomSmoothing: 0.68, vignetteDarkness: 0.82, vignetteOffset: 0.15, focalLength: 0.018, bokehScale: 1.10, fogDensity: 0.030, fogBlueMix: 0.08, ambientIntensity: 0.095, topLightIntensity: 46, goldRimIntensity: 20, blueFillIntensity: 15, beamOpacity: 0.34, dustOpacity: 0.17 },
  { id: "wake", progress: 0.14, exposure: 0.91, bloomGain: 1.05, bloomThreshold: 0.26, bloomSmoothing: 0.70, vignetteDarkness: 0.79, vignetteOffset: 0.16, focalLength: 0.019, bokehScale: 1.25, fogDensity: 0.028, fogBlueMix: 0.11, ambientIntensity: 0.100, topLightIntensity: 49, goldRimIntensity: 21, blueFillIntensity: 17, beamOpacity: 0.40, dustOpacity: 0.18 },
  { id: "unlock", progress: 0.28, exposure: 0.96, bloomGain: 1.12, bloomThreshold: 0.24, bloomSmoothing: 0.73, vignetteDarkness: 0.74, vignetteOffset: 0.17, focalLength: 0.021, bokehScale: 1.55, fogDensity: 0.025, fogBlueMix: 0.16, ambientIntensity: 0.105, topLightIntensity: 52, goldRimIntensity: 23, blueFillIntensity: 20, beamOpacity: 0.48, dustOpacity: 0.20 },
  { id: "fragment", progress: 0.42, exposure: 1.02, bloomGain: 1.24, bloomThreshold: 0.21, bloomSmoothing: 0.77, vignetteDarkness: 0.69, vignetteOffset: 0.18, focalLength: 0.024, bokehScale: 2.05, fogDensity: 0.021, fogBlueMix: 0.24, ambientIntensity: 0.110, topLightIntensity: 56, goldRimIntensity: 24, blueFillIntensity: 25, beamOpacity: 0.58, dustOpacity: 0.23 },
  { id: "core_approach", progress: 0.55, exposure: 1.12, bloomGain: 1.42, bloomThreshold: 0.18, bloomSmoothing: 0.82, vignetteDarkness: 0.63, vignetteOffset: 0.20, focalLength: 0.028, bokehScale: 2.90, fogDensity: 0.016, fogBlueMix: 0.36, ambientIntensity: 0.120, topLightIntensity: 60, goldRimIntensity: 25, blueFillIntensity: 31, beamOpacity: 0.72, dustOpacity: 0.26 },
  { id: "core_cross", progress: 0.63, exposure: 1.18, bloomGain: 1.55, bloomThreshold: 0.16, bloomSmoothing: 0.86, vignetteDarkness: 0.59, vignetteOffset: 0.21, focalLength: 0.030, bokehScale: 3.45, fogDensity: 0.014, fogBlueMix: 0.45, ambientIntensity: 0.125, topLightIntensity: 64, goldRimIntensity: 27, blueFillIntensity: 35, beamOpacity: 0.84, dustOpacity: 0.29 },
  { id: "turn", progress: 0.72, exposure: 1.08, bloomGain: 1.34, bloomThreshold: 0.19, bloomSmoothing: 0.80, vignetteDarkness: 0.66, vignetteOffset: 0.19, focalLength: 0.025, bokehScale: 2.35, fogDensity: 0.020, fogBlueMix: 0.29, ambientIntensity: 0.110, topLightIntensity: 57, goldRimIntensity: 26, blueFillIntensity: 27, beamOpacity: 0.63, dustOpacity: 0.25 },
  { id: "reassembly", progress: 0.84, exposure: 0.99, bloomGain: 1.22, bloomThreshold: 0.22, bloomSmoothing: 0.75, vignetteDarkness: 0.72, vignetteOffset: 0.18, focalLength: 0.022, bokehScale: 1.75, fogDensity: 0.024, fogBlueMix: 0.20, ambientIntensity: 0.104, topLightIntensity: 53, goldRimIntensity: 24, blueFillIntensity: 22, beamOpacity: 0.51, dustOpacity: 0.22 },
  { id: "lock", progress: 0.94, exposure: 0.92, bloomGain: 1.14, bloomThreshold: 0.25, bloomSmoothing: 0.71, vignetteDarkness: 0.78, vignetteOffset: 0.16, focalLength: 0.020, bokehScale: 1.35, fogDensity: 0.028, fogBlueMix: 0.13, ambientIntensity: 0.098, topLightIntensity: 49, goldRimIntensity: 22, blueFillIntensity: 18, beamOpacity: 0.42, dustOpacity: 0.19 },
  { id: "final", progress: 1.00, exposure: 0.97, bloomGain: 1.28, bloomThreshold: 0.22, bloomSmoothing: 0.76, vignetteDarkness: 0.75, vignetteOffset: 0.17, focalLength: 0.020, bokehScale: 1.45, fogDensity: 0.026, fogBlueMix: 0.18, ambientIntensity: 0.102, topLightIntensity: 54, goldRimIntensity: 25, blueFillIntensity: 21, beamOpacity: 0.54, dustOpacity: 0.21 }
] as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function findLookSegment(progress: number) {
  const p = clamp01(progress);
  for (let i = 0; i < CINEMATIC_LOOK_KEYFRAMES.length - 1; i += 1) {
    const a = CINEMATIC_LOOK_KEYFRAMES[i];
    const b = CINEMATIC_LOOK_KEYFRAMES[i + 1];
    if (p >= a.progress && p <= b.progress) return { a, b, p };
  }
  return {
    a: CINEMATIC_LOOK_KEYFRAMES[CINEMATIC_LOOK_KEYFRAMES.length - 2],
    b: CINEMATIC_LOOK_KEYFRAMES[CINEMATIC_LOOK_KEYFRAMES.length - 1],
    p
  };
}

export function sampleCinematicLook(progress: number): CinematicLook {
  const { a, b, p } = findLookSegment(progress);
  const span = Math.max(1e-8, b.progress - a.progress);
  const t = smooth((p - a.progress) / span);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    exposure: lerp(a.exposure, b.exposure),
    bloomGain: lerp(a.bloomGain, b.bloomGain),
    bloomThreshold: lerp(a.bloomThreshold, b.bloomThreshold),
    bloomSmoothing: lerp(a.bloomSmoothing, b.bloomSmoothing),
    vignetteDarkness: lerp(a.vignetteDarkness, b.vignetteDarkness),
    vignetteOffset: lerp(a.vignetteOffset, b.vignetteOffset),
    focalLength: lerp(a.focalLength, b.focalLength),
    bokehScale: lerp(a.bokehScale, b.bokehScale),
    fogDensity: lerp(a.fogDensity, b.fogDensity),
    fogBlueMix: lerp(a.fogBlueMix, b.fogBlueMix),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity),
    topLightIntensity: lerp(a.topLightIntensity, b.topLightIntensity),
    goldRimIntensity: lerp(a.goldRimIntensity, b.goldRimIntensity),
    blueFillIntensity: lerp(a.blueFillIntensity, b.blueFillIntensity),
    beamOpacity: lerp(a.beamOpacity, b.beamOpacity),
    dustOpacity: lerp(a.dustOpacity, b.dustOpacity)
  };
}
