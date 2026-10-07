import choreography from "@/spec/v3/orb_reassembly_choreography.json";

export type ReassemblyWave = "W1" | "W2" | "W3" | "W4" | "W5";

export type OrbReassemblyState = {
  active: number;
  alignment: number;
  progress: number;
  closedness: number;
  guideGain: number;
  seamGlow: number;
  seatPulse: number;
  sealPulse: number;
  completed: number;
  waveProgress: Record<ReassemblyWave, number>;
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

function waveProgress(sceneTime: number, wave: ReassemblyWave) {
  const cfg = choreography.waves[wave];
  return smootherstep(cfg.start, cfg.seatEnd, sceneTime);
}

function pulse(center: number, attack: number, decay: number, sceneTime: number) {
  const up = smoothstep(center - attack, center, sceneTime);
  const down = 1 - smoothstep(center, center + decay, sceneTime);
  return clamp01(up * down);
}

export function sampleOrbReassembly(sceneTime: number): OrbReassemblyState {
  const time = Number.isFinite(sceneTime) ? sceneTime : 0;
  const alignment = smootherstep(choreography.openHoldEnd, choreography.alignEnd, time);
  const waves: Record<ReassemblyWave, number> = {
    W1: waveProgress(time, "W1"),
    W2: waveProgress(time, "W2"),
    W3: waveProgress(time, "W3"),
    W4: waveProgress(time, "W4"),
    W5: waveProgress(time, "W5")
  };
  const progress = clamp01(
    (waves.W1 * 4 + waves.W2 * 4 + waves.W3 * 2 + waves.W4 * 2 + waves.W5 * 2) / 14
  );
  const active = smoothstep(choreography.openHoldEnd, choreography.alignEnd, time)
    * (1 - smoothstep(choreography.sealStart, choreography.sealEnd, time));
  const guideRise = smoothstep(choreography.openHoldEnd + 0.08, choreography.alignEnd, time);
  const guideFall = 1 - smoothstep(choreography.sealStart - 0.32, choreography.sealStart, time);
  const guideGain = clamp01(guideRise * guideFall * (0.56 + 0.44 * (1 - progress)));
  const seamRise = smoothstep(choreography.alignEnd - 0.14, choreography.waves.W1.start + 0.28, time);
  const seamFall = 1 - smoothstep(choreography.sealStart, choreography.sealEnd, time);
  const seamGlow = clamp01(seamRise * seamFall * (0.52 + 0.48 * progress));
  const seatPulse = clamp01(Math.max(
    pulse(choreography.waves.W1.seatEnd, 0.07, 0.16, time),
    pulse(choreography.waves.W2.seatEnd, 0.07, 0.16, time),
    pulse(choreography.waves.W3.seatEnd, 0.07, 0.16, time),
    pulse(choreography.waves.W4.seatEnd, 0.07, 0.16, time),
    pulse(choreography.waves.W5.seatEnd, 0.07, 0.18, time)
  ));
  const sealAttack = smoothstep(choreography.sealStart, choreography.sealStart + 0.10, time);
  const sealDecay = 1 - smoothstep(choreography.sealStart + 0.14, choreography.sealEnd - 0.06, time);
  const sealPulse = clamp01(sealAttack * sealDecay);
  const completed = smootherstep(choreography.waves.W5.seatEnd, choreography.sealEnd, time);

  return {
    active,
    alignment,
    progress,
    closedness: progress,
    guideGain,
    seamGlow,
    seatPulse,
    sealPulse,
    completed,
    waveProgress: waves
  };
}

export const ORB_REASSEMBLY_CHOREOGRAPHY = choreography;
