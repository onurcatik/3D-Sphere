import type { OrbQualityProfile } from "./assetProfile";
import { CINEMATIC_DURATION_SECONDS } from "./scrollTimeline";

export type Vector3Tuple = readonly [number, number, number];

export type CameraTimelineKeyframe = {
  id: string;
  progress: number;
  time: number;
  position: Vector3Tuple;
  target: Vector3Tuple;
  focusTarget: Vector3Tuple;
  fov: number;
  roll: number;
  energy: number;
  bloom: number;
  parallaxGain: number;
  label: string;
};

export type CameraTimelineSample = {
  progress: number;
  time: number;
  position: [number, number, number];
  target: [number, number, number];
  focusTarget: [number, number, number];
  fov: number;
  roll: number;
  energy: number;
  bloom: number;
  parallaxGain: number;
  label: string;
};

const at = (seconds: number) => seconds / CINEMATIC_DURATION_SECONDS;

/**
 * CHATGPT V3 FAZ 8 cinematic composition.
 *
 * The open orb reaches an approximately 4-unit conservative radius between
 * 5.50-6.93 s. Camera distance is therefore intentionally increased during
 * core exposure instead of driving through the shell. Target X is an optical
 * composition bias: negative target values place the subject on screen-right,
 * positive values place it on screen-left, keeping alternating narrative copy
 * readable on desktop. Mobile profiles attenuate this bias and keep the orb
 * near center/top because narrative copy occupies the lower viewport.
 */
export const CAMERA_KEYFRAMES: readonly CameraTimelineKeyframe[] = [
  {
    id: "hero_start",
    progress: at(0.00),
    time: 0.00,
    position: [7.70, 2.70, 9.40],
    target: [-3.20, -0.12, 0.00],
    focusTarget: [0.00, 0.10, 0.00],
    fov: 45.0,
    roll: 0.00,
    energy: 0.92,
    bloom: 1.02,
    parallaxGain: 0.90,
    label: "Hero / right-biased establishing"
  },
  {
    id: "unlock",
    progress: at(1.54),
    time: 1.54,
    position: [7.10, 2.30, 9.10],
    target: [3.00, -0.08, 0.00],
    focusTarget: [0.00, 0.11, 0.00],
    fov: 44.5,
    roll: 0.18,
    energy: 1.02,
    bloom: 1.08,
    parallaxGain: 0.82,
    label: "Unlock / left-biased reveal"
  },
  {
    id: "fragment_start",
    progress: at(3.08),
    time: 3.08,
    position: [6.50, 1.90, 9.90],
    target: [-3.20, 0.00, 0.00],
    focusTarget: [0.01, 0.12, 0.00],
    fov: 44.0,
    roll: 0.28,
    energy: 1.16,
    bloom: 1.14,
    parallaxGain: 0.68,
    label: "Fragment / right-biased release"
  },
  {
    id: "fragment_peak",
    progress: at(4.30),
    time: 4.30,
    position: [5.80, 1.55, 11.10],
    target: [-3.50, 0.10, 0.00],
    focusTarget: [0.03, 0.17, -0.03],
    fov: 43.5,
    roll: 0.18,
    energy: 1.36,
    bloom: 1.22,
    parallaxGain: 0.52,
    label: "Fragment / expanded silhouette"
  },
  {
    id: "core_reveal",
    progress: at(5.50),
    time: 5.50,
    position: [4.90, 1.35, 12.80],
    target: [3.50, 0.18, 0.00],
    focusTarget: [0.04, 0.25, -0.05],
    fov: 44.0,
    roll: -0.12,
    energy: 1.58,
    bloom: 1.30,
    parallaxGain: 0.34,
    label: "Core / full open silhouette"
  },
  {
    id: "core_hold",
    progress: at(6.20),
    time: 6.20,
    position: [0.80, 1.15, 13.40],
    target: [3.20, 0.20, 0.00],
    focusTarget: [0.04, 0.25, -0.05],
    fov: 43.5,
    roll: -0.22,
    energy: 1.68,
    bloom: 1.32,
    parallaxGain: 0.28,
    label: "Core / controlled orbital hold"
  },
  {
    id: "recall",
    progress: at(6.93),
    time: 6.93,
    position: [-3.80, 1.40, 12.60],
    target: [-3.30, 0.18, 0.00],
    focusTarget: [0.04, 0.24, -0.05],
    fov: 44.0,
    roll: -0.32,
    energy: 1.60,
    bloom: 1.28,
    parallaxGain: 0.30,
    label: "Recall / right-biased magnetic turn"
  },
  {
    id: "reassembly_start",
    progress: at(7.92),
    time: 7.92,
    position: [-6.00, 1.60, 11.70],
    target: [3.20, 0.12, 0.00],
    focusTarget: [0.02, 0.19, -0.02],
    fov: 44.5,
    roll: -0.20,
    energy: 1.48,
    bloom: 1.24,
    parallaxGain: 0.40,
    label: "Reassembly / left-biased precision return"
  },
  {
    id: "reassembly_mid",
    progress: at(9.20),
    time: 9.20,
    position: [-6.90, 1.90, 10.00],
    target: [3.00, 0.00, 0.00],
    focusTarget: [0.00, 0.13, 0.00],
    fov: 44.0,
    roll: 0.00,
    energy: 1.30,
    bloom: 1.18,
    parallaxGain: 0.52,
    label: "Reassembly / controlled pull-back"
  },
  {
    id: "seal",
    progress: at(10.34),
    time: 10.34,
    position: [-7.50, 2.50, 10.00],
    target: [0.00, -0.55, 0.00],
    focusTarget: [0.00, 0.10, 0.00],
    fov: 44.5,
    roll: 0.16,
    energy: 1.15,
    bloom: 1.12,
    parallaxGain: 0.68,
    label: "Seal / centered stabilization"
  },
  {
    id: "final_hero",
    progress: at(11.00),
    time: 11.00,
    position: [-7.80, 3.10, 11.20],
    target: [0.00, -1.20, 0.00],
    focusTarget: [0.00, 0.10, 0.00],
    fov: 45.0,
    roll: 0.10,
    energy: 1.20,
    bloom: 1.14,
    parallaxGain: 0.80,
    label: "Final hero / centered controlled pulse"
  }
] as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function findSegment(progress: number) {
  const p = clamp01(progress);
  for (let index = 0; index < CAMERA_KEYFRAMES.length - 1; index += 1) {
    const a = CAMERA_KEYFRAMES[index];
    const b = CAMERA_KEYFRAMES[index + 1];
    if (p >= a.progress && p <= b.progress) {
      return {
        index,
        local: (p - a.progress) / Math.max(1e-9, b.progress - a.progress),
        a,
        b
      };
    }
  }
  const index = CAMERA_KEYFRAMES.length - 2;
  return { index, local: 1, a: CAMERA_KEYFRAMES[index], b: CAMERA_KEYFRAMES[index + 1] };
}

function vecSub(a: Vector3Tuple, b: Vector3Tuple): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecScale(a: Vector3Tuple, scalar: number): [number, number, number] {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
}

function buildMonotoneComponentSlopes(field: "target" | "focusTarget", component: 0 | 1 | 2) {
  const count = CAMERA_KEYFRAMES.length;
  const delta = new Array<number>(count - 1);
  const slopes = new Array<number>(count);
  for (let index = 0; index < count - 1; index += 1) {
    const width = Math.max(1e-9, CAMERA_KEYFRAMES[index + 1].progress - CAMERA_KEYFRAMES[index].progress);
    delta[index] = (CAMERA_KEYFRAMES[index + 1][field][component] - CAMERA_KEYFRAMES[index][field][component]) / width;
  }
  slopes[0] = delta[0];
  slopes[count - 1] = delta[count - 2];
  for (let index = 1; index < count - 1; index += 1) {
    const before = delta[index - 1];
    const after = delta[index];
    slopes[index] = before * after <= 0 ? 0 : (before + after) * 0.5;
  }
  for (let index = 0; index < count - 1; index += 1) {
    const d = delta[index];
    if (Math.abs(d) < 1e-12) {
      slopes[index] = 0;
      slopes[index + 1] = 0;
      continue;
    }
    const alpha = slopes[index] / d;
    const beta = slopes[index + 1] / d;
    if (alpha < 0 || beta < 0) {
      if (alpha < 0) slopes[index] = 0;
      if (beta < 0) slopes[index + 1] = 0;
      continue;
    }
    const magnitude = alpha * alpha + beta * beta;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      slopes[index] = scale * alpha * d;
      slopes[index + 1] = scale * beta * d;
    }
  }
  return slopes as readonly number[];
}

const TARGET_SLOPES = [0, 1, 2].map((component) => buildMonotoneComponentSlopes("target", component as 0 | 1 | 2));
const FOCUS_TARGET_SLOPES = [0, 1, 2].map((component) => buildMonotoneComponentSlopes("focusTarget", component as 0 | 1 | 2));

function vectorDerivative(field: "position" | "target" | "focusTarget", index: number): [number, number, number] {
  if (field === "target") return [TARGET_SLOPES[0][index], TARGET_SLOPES[1][index], TARGET_SLOPES[2][index]];
  if (field === "focusTarget") return [FOCUS_TARGET_SLOPES[0][index], FOCUS_TARGET_SLOPES[1][index], FOCUS_TARGET_SLOPES[2][index]];
  const current = CAMERA_KEYFRAMES[index];
  if (index === 0) {
    const next = CAMERA_KEYFRAMES[1];
    return vecScale(vecSub(next[field], current[field]), 1 / Math.max(1e-9, next.progress - current.progress));
  }
  if (index === CAMERA_KEYFRAMES.length - 1) {
    const previous = CAMERA_KEYFRAMES[index - 1];
    return vecScale(vecSub(current[field], previous[field]), 1 / Math.max(1e-9, current.progress - previous.progress));
  }
  const previous = CAMERA_KEYFRAMES[index - 1];
  const next = CAMERA_KEYFRAMES[index + 1];
  return vecScale(vecSub(next[field], previous[field]), 0.72 / Math.max(1e-9, next.progress - previous.progress));
}

function hermiteVector(field: "position" | "target" | "focusTarget", index: number, u: number): [number, number, number] {
  const a = CAMERA_KEYFRAMES[index];
  const b = CAMERA_KEYFRAMES[index + 1];
  const width = Math.max(1e-9, b.progress - a.progress);
  const m0 = vecScale(vectorDerivative(field, index), width);
  const m1 = vecScale(vectorDerivative(field, index + 1), width);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  const p0 = a[field];
  const p1 = b[field];
  return [
    p0[0] * h00 + m0[0] * h10 + p1[0] * h01 + m1[0] * h11,
    p0[1] * h00 + m0[1] * h10 + p1[1] * h01 + m1[1] * h11,
    p0[2] * h00 + m0[2] * h10 + p1[2] * h01 + m1[2] * h11
  ];
}

function scalarValue(frame: CameraTimelineKeyframe, field: "fov" | "roll" | "energy" | "bloom" | "parallaxGain") {
  return frame[field];
}

function scalarDerivative(field: "fov" | "roll" | "energy" | "bloom" | "parallaxGain", index: number) {
  const current = CAMERA_KEYFRAMES[index];
  if (index === 0) {
    const next = CAMERA_KEYFRAMES[1];
    return (scalarValue(next, field) - scalarValue(current, field)) / Math.max(1e-9, next.progress - current.progress);
  }
  if (index === CAMERA_KEYFRAMES.length - 1) {
    const previous = CAMERA_KEYFRAMES[index - 1];
    return (scalarValue(current, field) - scalarValue(previous, field)) / Math.max(1e-9, current.progress - previous.progress);
  }
  const previous = CAMERA_KEYFRAMES[index - 1];
  const next = CAMERA_KEYFRAMES[index + 1];
  return (scalarValue(next, field) - scalarValue(previous, field)) * 0.72 / Math.max(1e-9, next.progress - previous.progress);
}

function hermiteScalar(field: "fov" | "roll" | "energy" | "bloom" | "parallaxGain", index: number, u: number) {
  const a = CAMERA_KEYFRAMES[index];
  const b = CAMERA_KEYFRAMES[index + 1];
  const width = Math.max(1e-9, b.progress - a.progress);
  const m0 = scalarDerivative(field, index) * width;
  const m1 = scalarDerivative(field, index + 1) * width;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return scalarValue(a, field) * h00 + m0 * h10 + scalarValue(b, field) * h01 + m1 * h11;
}

export function sampleCameraTimeline(progress: number): CameraTimelineSample {
  const p = clamp01(progress);
  const { index, local, a, b } = findSegment(p);
  return {
    progress: p,
    time: p * CINEMATIC_DURATION_SECONDS,
    position: hermiteVector("position", index, local),
    target: hermiteVector("target", index, local),
    focusTarget: hermiteVector("focusTarget", index, local),
    fov: Math.max(40, Math.min(48, hermiteScalar("fov", index, local))),
    roll: Math.max(-0.6, Math.min(0.6, hermiteScalar("roll", index, local))),
    energy: Math.max(0.7, Math.min(1.8, hermiteScalar("energy", index, local))),
    bloom: Math.max(0.82, Math.min(1.38, hermiteScalar("bloom", index, local))),
    parallaxGain: Math.max(0, Math.min(1, hermiteScalar("parallaxGain", index, local))),
    label: local < 0.5 ? a.label : b.label
  };
}

export function applyCameraProfile(sample: CameraTimelineSample, profile: OrbQualityProfile): CameraTimelineSample {
  const target: [number, number, number] = [
    sample.target[0] * profile.cameraCompositionScale,
    sample.target[1] + profile.cameraTargetYOffset,
    sample.target[2]
  ];
  const delta: [number, number, number] = [
    sample.position[0] - sample.target[0],
    sample.position[1] - sample.target[1],
    sample.position[2] - sample.target[2]
  ];
  delta[0] *= profile.cameraDistanceScale * profile.cameraOrbitScale;
  delta[1] *= profile.cameraDistanceScale;
  delta[2] *= profile.cameraDistanceScale;
  return {
    ...sample,
    position: [target[0] + delta[0], target[1] + delta[1], target[2] + delta[2]],
    target,
    fov: sample.fov + profile.cameraFovOffset,
    parallaxGain: sample.parallaxGain * (profile.inputMode === "touch" ? 0 : 1)
  };
}
