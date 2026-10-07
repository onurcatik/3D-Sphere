"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import { getParticleBudget } from "@/lib/particleBudget";
import type { RuntimeStateRef } from "@/lib/types";

const VERTEX_SHADER = /* glsl */ `
uniform float uFlowTime;
uniform float uDensity;
uniform float uOpacity;
uniform float uExpansion;
uniform float uSpiral;
uniform float uTurbulence;
uniform float uMagneticPull;
uniform float uBurst;
uniform float uCoreBias;
uniform float uPointScale;
attribute float aRadius;
attribute float aAngle;
attribute float aHeight;
attribute float aSpeed;
attribute float aPhase;
attribute float aSize;
attribute float aScatter;
attribute float aGate;
attribute float aKind;
varying float vAlpha;
varying float vHeat;
varying float vKind;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  float particleActive = 1.0 - smoothstep(uDensity, min(1.0, uDensity + 0.14), aGate);
  float kindEnergy = mix(0.56, 1.0, aKind);
  float time = uFlowTime;
  float orbit = aAngle + time * aSpeed * (0.22 + uSpiral * 0.56);
  float wobble = sin(time * (0.42 + aSpeed) + aPhase) * (0.05 + uTurbulence * 0.16);
  float coreCurl = sin(orbit * 2.0 + aPhase + time * 0.7) * (0.05 + uSpiral * 0.18);
  float radialExpansion = uExpansion * (0.48 + aScatter * 1.95);
  float burstKick = uBurst * aScatter * (0.20 + 0.58 * aKind);
  float magneticTighten = uMagneticPull * (0.08 + 0.20 * aKind);
  float radius = aRadius + radialExpansion + burstKick;
  radius *= 1.0 - magneticTighten;
  radius += wobble * (0.65 + aScatter);

  float y = aHeight;
  y += coreCurl * (0.62 + aScatter);
  y += sin(orbit * 1.5 + aPhase) * uTurbulence * 0.18;
  y *= 1.0 + uExpansion * 0.14;

  vec3 p = vec3(cos(orbit) * radius, y, sin(orbit) * radius);
  float inward = uCoreBias * aKind * 0.12;
  p *= 1.0 - inward;

  float jitter = (hash11(aPhase * 31.7 + floor(time * 4.0)) - 0.5) * uBurst * aKind;
  vec3 jitterAxis = vec3(cos(aPhase * 1.7), sin(aPhase * 2.3), sin(aPhase * 1.1));
  float jitterAxisLengthSq = max(dot(jitterAxis, jitterAxis), 1e-8);
  p += jitterAxis * inversesqrt(jitterAxisLengthSq) * jitter * 0.10;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float perspective = clamp(145.0 / max(1.0, -mv.z), 0.35, 4.0);
  gl_PointSize = (1.6 + aSize * 4.7 * uPointScale * kindEnergy) * perspective;

  float radialFade = 1.0 - smoothstep(1.1, 4.9, radius);
  float pulse = 0.66 + 0.34 * sin(aPhase + time * (1.0 + aSpeed));
  vAlpha = particleActive * uOpacity * radialFade * pulse * (0.52 + 0.48 * kindEnergy);
  vHeat = clamp(uBurst * 0.50 + uCoreBias * 0.38 + aScatter * 0.22, 0.0, 1.0);
  vKind = aKind;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform float uGoldMix;
varying float vAlpha;
varying float vHeat;
varying float vKind;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  float disc = 1.0 - smoothstep(0.06, 0.50, d);
  float core = 1.0 - smoothstep(0.0, 0.24, d);
  vec3 deepBlue = vec3(0.06, 0.30, 1.00);
  vec3 iceBlue = vec3(0.36, 0.82, 1.00);
  vec3 white = vec3(0.94, 0.99, 1.00);
  vec3 gold = vec3(1.00, 0.72, 0.31);
  vec3 color = mix(deepBlue, iceBlue, vHeat);
  color = mix(color, white, core * (0.58 + 0.42 * vKind));
  color = mix(color, gold, uGoldMix * (0.35 + 0.65 * vKind));
  float alpha = disc * vAlpha;
  if (alpha < 0.008) discard;
  gl_FragColor = vec4(color * (1.0 + core * 1.65), alpha);
}
`;

type ParticleAttributes = {
  positions: Float32Array;
  radius: Float32Array;
  angle: Float32Array;
  height: Float32Array;
  speed: Float32Array;
  phase: Float32Array;
  size: Float32Array;
  scatter: Float32Array;
  gate: Float32Array;
  kind: Float32Array;
};

function createParticleAttributes(count: number): ParticleAttributes {
  const positions = new Float32Array(count * 3);
  const radius = new Float32Array(count);
  const angle = new Float32Array(count);
  const height = new Float32Array(count);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  const size = new Float32Array(count);
  const scatter = new Float32Array(count);
  const gate = new Float32Array(count);
  const kind = new Float32Array(count);
  let seed = 0x4f524256;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i += 1) {
    const energyKind = rand() > 0.42 ? 1 : 0;
    kind[i] = energyKind;
    radius[i] = energyKind ? 0.82 + Math.pow(rand(), 1.55) * 1.85 : 1.55 + rand() * 2.10;
    angle[i] = rand() * Math.PI * 2;
    height[i] = (rand() * 2 - 1) * (energyKind ? 1.48 : 2.15);
    speed[i] = 0.30 + rand() * (energyKind ? 0.95 : 0.48);
    phase[i] = rand() * Math.PI * 2;
    size[i] = 0.45 + Math.pow(rand(), 1.8) * (energyKind ? 1.75 : 1.10);
    scatter[i] = Math.pow(rand(), 0.72);
    gate[i] = rand();
  }

  return { positions, radius, angle, height, speed, phase, size, scatter, gate, kind };
}

export function ParticleEnergyField({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const budget = getParticleBudget(profile);
  const count = budget.field;
  const attributes = useMemo(() => createParticleAttributes(count), [count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uFlowTime: { value: 0 },
          uDensity: { value: 0.34 },
          uOpacity: { value: 0.34 },
          uExpansion: { value: 0.05 },
          uSpiral: { value: 0.20 },
          uTurbulence: { value: 0.14 },
          uMagneticPull: { value: 0.0 },
          uBurst: { value: 0.0 },
          uCoreBias: { value: 0.54 },
          uGoldMix: { value: 0.08 },
          uPointScale: { value: 0.72 * profile.particleScale },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER
      }),
    [profile.particleScale]
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const geometry = pointsRef.current?.geometry;
    if (!geometry) return;
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 7.2);
  }, [count]);

  useFrame(() => {
    const sceneSample = runtimeStateRef.current.sceneSample;
    if (!sceneSample) return;
    const sample = sceneSample.particle;
    material.uniforms.uFlowTime.value = sceneSample.flowTime;
    material.uniforms.uDensity.value = sample.density;
    material.uniforms.uOpacity.value = sample.opacity * sceneSample.coreEnergy.particleGain * sceneSample.postFx.particleGain;
    material.uniforms.uExpansion.value = sample.expansion;
    material.uniforms.uSpiral.value = sample.spiral;
    material.uniforms.uTurbulence.value = sample.turbulence;
    material.uniforms.uMagneticPull.value = sample.magneticPull;
    material.uniforms.uBurst.value = sample.burst;
    material.uniforms.uCoreBias.value = sample.coreBias;
    material.uniforms.uGoldMix.value = sample.goldMix;
    material.uniforms.uPointScale.value = sample.pointScale * profile.particleScale * sceneSample.postFx.pointScaleGain;

    if (pointsRef.current) {
      pointsRef.current.rotation.y = Math.sin(sceneSample.flowTime * 0.07) * 0.035;
      pointsRef.current.rotation.z = Math.cos(sceneSample.flowTime * 0.05) * 0.018;
    }

    runtimeStateRef.current.particleIntensity = sample.opacity * sceneSample.coreEnergy.particleGain * sceneSample.postFx.particleGain;
    runtimeStateRef.current.particleExpansion = sample.expansion;
    runtimeStateRef.current.magneticPull = sample.magneticPull;
    runtimeStateRef.current.sparkBurst = sample.burst;
    runtimeStateRef.current.lightningGain = sample.lightningGain;
  });

  return (
    <points ref={pointsRef} material={material} frustumCulled renderOrder={5}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.positions, 3]} />
        <bufferAttribute attach="attributes-aRadius" args={[attributes.radius, 1]} />
        <bufferAttribute attach="attributes-aAngle" args={[attributes.angle, 1]} />
        <bufferAttribute attach="attributes-aHeight" args={[attributes.height, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[attributes.speed, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[attributes.phase, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[attributes.size, 1]} />
        <bufferAttribute attach="attributes-aScatter" args={[attributes.scatter, 1]} />
        <bufferAttribute attach="attributes-aGate" args={[attributes.gate, 1]} />
        <bufferAttribute attach="attributes-aKind" args={[attributes.kind, 1]} />
      </bufferGeometry>
    </points>
  );
}
