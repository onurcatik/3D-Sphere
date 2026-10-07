import * as THREE from 'three';
import { CAMERA_KEYFRAMES, sampleCameraTimeline } from '../cameraTimeline';

export { CAMERA_KEYFRAMES };

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const degToRad = (value) => value * Math.PI / 180;
const vec = (value) => new THREE.Vector3(value[0], value[1], value[2]);

/**
 * Compatibility adapter for older tooling. The active React camera path consumes
 * the shared SceneSample directly; camera keyframes now live only in cameraTimeline.ts.
 */
export function createCinematicCameraRig(camera, options = {}) {
  const pointer = new THREE.Vector2(0, 0);
  const state = {
    progress: 0,
    enabled: true,
    pointerEnabled: options.pointerEnabled !== false,
    last: null
  };
  const tempMatrix = new THREE.Matrix4();
  const tempQuat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const localUp = new THREE.Vector3();
  const parallaxPos = options.parallaxPosition ?? 0.045;
  const parallaxTarget = options.parallaxTarget ?? 0.018;

  function setPointer(x, y) {
    pointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  }

  function sample(progress) {
    const value = sampleCameraTimeline(progress);
    return {
      ...value,
      position: vec(value.position),
      target: vec(value.target)
    };
  }

  function apply(progress = state.progress) {
    state.progress = clamp01(progress);
    if (!state.enabled) return state.last;
    const sampled = sample(state.progress);
    const position = sampled.position.clone();
    const target = sampled.target.clone();
    forward.copy(target).sub(position).normalize();
    right.crossVectors(forward, up).normalize();
    localUp.crossVectors(right, forward).normalize();
    if (state.pointerEnabled) {
      const gain = Number.isFinite(sampled.parallaxGain) ? sampled.parallaxGain : 1;
      position
        .addScaledVector(right, pointer.x * parallaxPos * gain)
        .addScaledVector(localUp, pointer.y * parallaxPos * gain * 0.72);
      target
        .addScaledVector(right, pointer.x * parallaxTarget * gain)
        .addScaledVector(localUp, pointer.y * parallaxTarget * gain * 0.55);
    }
    camera.position.copy(position);
    camera.fov = sampled.fov;
    camera.near = 0.10;
    camera.far = 60;
    camera.updateProjectionMatrix();
    tempMatrix.lookAt(camera.position, target, camera.up);
    tempQuat.setFromRotationMatrix(tempMatrix);
    camera.quaternion.copy(tempQuat);
    camera.rotateZ(degToRad(sampled.roll));
    const focusTarget = sampled.focusTarget ? vec(sampled.focusTarget) : target;
    const focusDistance = camera.position.distanceTo(focusTarget);
    state.last = { ...sampled, position, target, focusDistance };
    return state.last;
  }

  function setProgress(value) {
    state.progress = clamp01(value);
    return apply(state.progress);
  }
  function getProgress() { return state.progress; }
  function setEnabled(value) { state.enabled = Boolean(value); }
  function dispose() { /* no persistent listeners */ }

  return { state, sample, apply, setProgress, getProgress, setPointer, setEnabled, dispose };
}

export function buildCameraPathDebug() {
  const points = CAMERA_KEYFRAMES.map((keyframe) => vec(keyframe.position));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.35);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160));
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: 0.45 })
  );
  line.name = 'FAZ8_CameraPath_Debug';
  const group = new THREE.Group();
  group.name = 'FAZ8_CameraDebug';
  group.add(line);
  const markerGeo = new THREE.SphereGeometry(0.06, 12, 8);
  CAMERA_KEYFRAMES.forEach((keyframe, index) => {
    const marker = new THREE.Mesh(
      markerGeo,
      new THREE.MeshBasicMaterial({ color: index === 0 || index === CAMERA_KEYFRAMES.length - 1 ? 0xffce83 : 0xa8dcff })
    );
    marker.position.copy(vec(keyframe.position));
    marker.name = `CameraKey_${index + 1}_${keyframe.id}`;
    group.add(marker);
  });
  return group;
}
