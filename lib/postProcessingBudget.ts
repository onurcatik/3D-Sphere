export type PostProcessingBudget = {
  highlightPressure: number;
  saturationRisk: number;
  bloomIntensity: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  additiveGain: number;
  particleGain: number;
  pointScaleGain: number;
  debrisGain: number;
  dustGain: number;
  shaftGain: number;
  dofGain: number;
  bokehScale: number;
  vignetteDarkness: number;
};

type PostProcessingBudgetInput = {
  look: { bloomGain: number; bloomThreshold: number; bloomSmoothing: number; bokehScale: number; vignetteDarkness: number };
  coreEnergy: { reveal: number; whiteHot: number; innerGain: number; haloGain: number; particleGain: number };
  lighting: { coreGain: number; environmentGain: number };
  breakup: { shockwave: number };
  particle: { opacity: number; burst: number };
  cameraBloom: number;
  profile: { tier: string; dof: boolean; antialias?: boolean };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const clamp01 = (value: number) => clamp(value, 0, 1);

export function getComposerMultisampling(profile: { tier: string; antialias: boolean }): number {
  if (!profile.antialias) return 0;
  if (profile.tier === "desktop-high") return 4;
  if (profile.tier === "desktop-balanced" || profile.tier === "tablet") return 2;
  return 0;
}

export function samplePostProcessingBudget(input: PostProcessingBudgetInput): PostProcessingBudget {
  const { look, coreEnergy, lighting, breakup, particle, cameraBloom, profile } = input;
  const particlePressure = clamp01(particle.opacity * coreEnergy.particleGain);
  const highlightPressure = clamp01(
    coreEnergy.reveal * 0.24
      + coreEnergy.whiteHot * 0.22
      + coreEnergy.innerGain * 0.13
      + coreEnergy.haloGain * 0.09
      + particlePressure * 0.13
      + breakup.shockwave * 0.08
      + clamp01(lighting.coreGain) * 0.06
      + clamp01((look.bloomGain - 1) / 0.65) * 0.05
  );

  const saturationRisk = clamp01(
    highlightPressure * 0.72
      + breakup.shockwave * 0.10
      + particle.burst * 0.08
      + clamp01((lighting.environmentGain - 0.8) / 0.35) * 0.10
  );

  const additiveGain = clamp(1 - saturationRisk * 0.34, 0.66, 1);
  const particleGain = clamp(1 - saturationRisk * 0.42, 0.56, 1);
  const pointScaleGain = clamp(1 - saturationRisk * 0.18, 0.80, 1);
  const debrisGain = clamp(1 - saturationRisk * 0.24, 0.74, 1);
  const dustGain = clamp(1 - highlightPressure * 0.28, 0.70, 1);
  const shaftGain = clamp(1 - saturationRisk * 0.26, 0.74, 1);

  const bloomBase = look.bloomGain * Math.max(0.85, cameraBloom || 1) * 0.34;
  const bloomIntensity = clamp(bloomBase * (1 - saturationRisk * 0.38), 0.18, 0.68);
  const bloomThreshold = clamp(0.94 + look.bloomThreshold + saturationRisk * 0.14, 1.06, 1.30);
  const bloomSmoothing = clamp(look.bloomSmoothing * 0.88, 0.58, 0.78);

  const dofGain = profile.dof ? clamp(0.84 - coreEnergy.reveal * 0.50 - saturationRisk * 0.16, 0.28, 0.84) : 0;
  const bokehScale = profile.dof ? clamp(look.bokehScale * 0.42 * dofGain, 0.28, 1.18) : 0;
  const vignetteDarkness = clamp(look.vignetteDarkness * 0.70, 0.40, 0.58);

  return {
    highlightPressure,
    saturationRisk,
    bloomIntensity,
    bloomThreshold,
    bloomSmoothing,
    additiveGain,
    particleGain,
    pointScaleGain,
    debrisGain,
    dustGain,
    shaftGain,
    dofGain,
    bokehScale,
    vignetteDarkness
  };
}
