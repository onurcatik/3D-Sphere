export type CoreEnergyState = {
  reveal: number;
  innerGain: number;
  vortexGain: number;
  membraneGain: number;
  haloGain: number;
  connectionGain: number;
  beamGain: number;
  particleGain: number;
  lightGain: number;
  whiteHot: number;
};

type CoreEnergyKeyframe = CoreEnergyState & {
  id: string;
  time: number;
};

export const CORE_ENERGY_KEYFRAMES: readonly CoreEnergyKeyframe[] = [
  { id: "dormant",      time: 0.00,  reveal: 0.10, innerGain: 0.18, vortexGain: 0.12, membraneGain: 0.08, haloGain: 0.06, connectionGain: 0.00, beamGain: 0.10, particleGain: 0.56, lightGain: 0.32, whiteHot: 0.08 },
  { id: "awakening",    time: 1.54,  reveal: 0.20, innerGain: 0.30, vortexGain: 0.24, membraneGain: 0.18, haloGain: 0.12, connectionGain: 0.00, beamGain: 0.20, particleGain: 0.70, lightGain: 0.46, whiteHot: 0.12 },
  { id: "unlock",       time: 3.08,  reveal: 0.42, innerGain: 0.52, vortexGain: 0.48, membraneGain: 0.38, haloGain: 0.28, connectionGain: 0.10, beamGain: 0.34, particleGain: 0.84, lightGain: 0.64, whiteHot: 0.20 },
  { id: "fragment",     time: 4.20,  reveal: 0.76, innerGain: 0.80, vortexGain: 0.78, membraneGain: 0.70, haloGain: 0.62, connectionGain: 0.68, beamGain: 0.52, particleGain: 0.96, lightGain: 0.84, whiteHot: 0.34 },
  { id: "core_reveal",  time: 5.50,  reveal: 1.00, innerGain: 1.00, vortexGain: 0.98, membraneGain: 0.92, haloGain: 0.84, connectionGain: 1.00, beamGain: 0.72, particleGain: 1.00, lightGain: 1.00, whiteHot: 0.48 },
  { id: "core_hold",    time: 6.93,  reveal: 1.00, innerGain: 0.96, vortexGain: 1.00, membraneGain: 0.96, haloGain: 0.88, connectionGain: 0.86, beamGain: 0.74, particleGain: 0.96, lightGain: 0.96, whiteHot: 0.44 },
  { id: "recall",       time: 7.92,  reveal: 0.72, innerGain: 0.74, vortexGain: 0.76, membraneGain: 0.68, haloGain: 0.56, connectionGain: 0.46, beamGain: 0.50, particleGain: 0.82, lightGain: 0.74, whiteHot: 0.30 },
  { id: "sealing",      time: 10.34, reveal: 0.24, innerGain: 0.34, vortexGain: 0.28, membraneGain: 0.20, haloGain: 0.16, connectionGain: 0.02, beamGain: 0.22, particleGain: 0.62, lightGain: 0.46, whiteHot: 0.14 },
  { id: "final_pulse",  time: 11.00, reveal: 0.30, innerGain: 0.40, vortexGain: 0.34, membraneGain: 0.24, haloGain: 0.20, connectionGain: 0.00, beamGain: 0.26, particleGain: 0.66, lightGain: 0.50, whiteHot: 0.16 }
] as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smoother = (value: number) => {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

function findSegment(sceneTime: number) {
  const time = Number.isFinite(sceneTime) ? Math.max(0, sceneTime) : 0;
  for (let index = 0; index < CORE_ENERGY_KEYFRAMES.length - 1; index += 1) {
    const a = CORE_ENERGY_KEYFRAMES[index];
    const b = CORE_ENERGY_KEYFRAMES[index + 1];
    if (time >= a.time && time <= b.time) return { a, b, time };
  }
  const last = CORE_ENERGY_KEYFRAMES.length - 1;
  if (time < CORE_ENERGY_KEYFRAMES[0].time) {
    return { a: CORE_ENERGY_KEYFRAMES[0], b: CORE_ENERGY_KEYFRAMES[1], time: CORE_ENERGY_KEYFRAMES[0].time };
  }
  return { a: CORE_ENERGY_KEYFRAMES[last - 1], b: CORE_ENERGY_KEYFRAMES[last], time: CORE_ENERGY_KEYFRAMES[last].time };
}

export function sampleCoreEnergy(sceneTime: number): CoreEnergyState {
  const { a, b, time } = findSegment(sceneTime);
  const span = Math.max(1e-8, b.time - a.time);
  const t = smoother((time - a.time) / span);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    reveal: lerp(a.reveal, b.reveal),
    innerGain: lerp(a.innerGain, b.innerGain),
    vortexGain: lerp(a.vortexGain, b.vortexGain),
    membraneGain: lerp(a.membraneGain, b.membraneGain),
    haloGain: lerp(a.haloGain, b.haloGain),
    connectionGain: lerp(a.connectionGain, b.connectionGain),
    beamGain: lerp(a.beamGain, b.beamGain),
    particleGain: lerp(a.particleGain, b.particleGain),
    lightGain: lerp(a.lightGain, b.lightGain),
    whiteHot: lerp(a.whiteHot, b.whiteHot)
  };
}
