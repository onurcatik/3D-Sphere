import choreography from "@/spec/v3/orb_breakup_choreography.json";

export type OrbBreakupState = {
  progress: number;
  openness: number;
  tension: number;
  seamGlow: number;
  shockwave: number;
  debrisGain: number;
  groupProgress: Record<"A" | "B" | "C", number>;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

const smootherstep = (edge0: number, edge1: number, value: number) => {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function groupProgress(sceneTime: number, group: "A" | "B" | "C") {
  const start = choreography.groups[group].start;
  return smootherstep(start, choreography.openPoseTime, sceneTime);
}

export function sampleOrbBreakup(sceneTime: number): OrbBreakupState {
  const time = Number.isFinite(sceneTime) ? sceneTime : 0;
  const groupA = groupProgress(time, "A");
  const groupB = groupProgress(time, "B");
  const groupC = groupProgress(time, "C");
  const progress = clamp01((groupA * 5 + groupB * 5 + groupC * 4) / 14);
  const tension = smoothstep(choreography.awakeningStart, choreography.breakupStart, time);

  // The fracture seam peaks as the locks release, remains visible while the shell
  // opens, and relaxes during the core reveal. This is deterministic in scene time.
  const seamRise = smoothstep(choreography.awakeningStart, choreography.breakupStart + 0.28, time);
  const seamFall = 1 - smoothstep(choreography.openPoseTime + 0.20, choreography.openHoldEnd, time);
  const seamGlow = clamp01(seamRise * seamFall);

  // One broad release wave: fast attack, slower falloff.
  const shockAttack = smoothstep(choreography.breakupStart, choreography.breakupStart + 0.14, time);
  const shockDecay = 1 - smoothstep(choreography.breakupStart + 0.18, choreography.breakupStart + 0.82, time);
  const shockwave = clamp01(shockAttack * shockDecay);

  const debrisAttack = smoothstep(choreography.breakupStart + 0.04, choreography.breakupStart + 0.48, time);
  const debrisDecay = 1 - smoothstep(choreography.openPoseTime - 0.05, choreography.openHoldEnd - 0.16, time);
  const debrisGain = clamp01(debrisAttack * debrisDecay * (0.35 + 0.65 * progress));

  return {
    progress,
    openness: progress,
    tension,
    seamGlow,
    shockwave,
    debrisGain,
    groupProgress: { A: groupA, B: groupB, C: groupC }
  };
}

export const ORB_BREAKUP_CHOREOGRAPHY = choreography;
