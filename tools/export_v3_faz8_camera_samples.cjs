const path = require('node:path');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, 'qa/faz-8/runtime/cameraTimeline.js');
const { sampleCameraTimeline, applyCameraProfile, CAMERA_KEYFRAMES } = require(runtime);

const profiles = {
  desktop: {
    aspect: 1440 / 900,
    profile: { cameraCompositionScale: 1, cameraTargetYOffset: 0, cameraDistanceScale: 1, cameraOrbitScale: 1, cameraFovOffset: 0, inputMode: 'mouse' }
  },
  tabletPortrait: {
    aspect: 768 / 1024,
    profile: { cameraCompositionScale: 0.24, cameraTargetYOffset: -0.14, cameraDistanceScale: 1.24, cameraOrbitScale: 0.82, cameraFovOffset: 4.5, inputMode: 'touch' }
  },
  mobilePortrait: {
    aspect: 390 / 844,
    profile: { cameraCompositionScale: 0.04, cameraTargetYOffset: -0.78, cameraDistanceScale: 1.52, cameraOrbitScale: 0.50, cameraFovOffset: 10, inputMode: 'touch' }
  },
  mobileLandscape: {
    aspect: 844 / 390,
    profile: { cameraCompositionScale: 0.28, cameraTargetYOffset: -0.22, cameraDistanceScale: 1.16, cameraOrbitScale: 0.76, cameraFovOffset: 3.5, inputMode: 'touch' }
  },
  lowPowerPortrait: {
    aspect: 360 / 800,
    profile: { cameraCompositionScale: 0.05, cameraTargetYOffset: -0.80, cameraDistanceScale: 1.54, cameraOrbitScale: 0.48, cameraFovOffset: 10, inputMode: 'touch' }
  }
};

function vectorDiff(a, b) {
  return a.map((value, index) => value - b[index]);
}
function vectorScale(a, scalar) {
  return a.map((value) => value * scalar);
}
function vectorNorm(a) {
  return Math.hypot(...a);
}

const continuity = [];
const h = 1e-7;
for (const keyframe of CAMERA_KEYFRAMES.slice(1, -1)) {
  const p = keyframe.progress;
  const left = sampleCameraTimeline(p - h);
  const center = sampleCameraTimeline(p);
  const right = sampleCameraTimeline(p + h);
  const leftPos = vectorScale(vectorDiff(center.position, left.position), 1 / h);
  const rightPos = vectorScale(vectorDiff(right.position, center.position), 1 / h);
  const leftTarget = vectorScale(vectorDiff(center.target, left.target), 1 / h);
  const rightTarget = vectorScale(vectorDiff(right.target, center.target), 1 / h);
  continuity.push({
    id: keyframe.id,
    time: keyframe.time,
    positionVelocityJump: vectorNorm(vectorDiff(rightPos, leftPos)),
    targetVelocityJump: vectorNorm(vectorDiff(rightTarget, leftTarget)),
    fovVelocityJump: Math.abs(((right.fov - center.fov) / h) - ((center.fov - left.fov) / h)),
    rollVelocityJump: Math.abs(((right.roll - center.roll) / h) - ((center.roll - left.roll) / h))
  });
}

const samples = {};
for (const [name, entry] of Object.entries(profiles)) {
  const list = [];
  for (let frame = 0; frame <= 660; frame += 1) {
    const time = frame / 60;
    const base = sampleCameraTimeline(time / 11);
    const camera = applyCameraProfile(base, entry.profile);
    list.push({ time, ...camera });
  }
  const critical = CAMERA_KEYFRAMES.map((keyframe) => ({
    id: keyframe.id,
    time: keyframe.time,
    ...applyCameraProfile(sampleCameraTimeline(keyframe.progress), entry.profile)
  }));
  samples[name] = { aspect: entry.aspect, samples: list, critical };
}

process.stdout.write(JSON.stringify({ keyframes: CAMERA_KEYFRAMES, continuity, profiles: samples }));
