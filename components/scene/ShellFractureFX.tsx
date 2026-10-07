"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import { getParticleBudget } from "@/lib/particleBudget";
import type { RuntimeStateRef } from "@/lib/types";

const VERTEX = /* glsl */ `
  uniform float uSceneTime;
  uniform float uDebrisGain;
  attribute vec3 aDirection;
  attribute float aSeed;
  attribute float aSize;
  varying float vAlpha;

  float ease(float x) {
    x = clamp(x, 0.0, 1.0);
    return x * x * (3.0 - 2.0 * x);
  }

  void main() {
    float launch = 3.10 + aSeed * 0.58;
    float raw = clamp((uSceneTime - launch) / 1.72, 0.0, 1.0);
    float p = ease(raw);
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 tangent = cross(up, aDirection);
    float tangentLength = length(tangent);
    tangent = tangentLength > 0.0001 ? tangent / tangentLength : vec3(1.0, 0.0, 0.0);

    float radius = 1.90 + aSeed * 0.22 + p * (0.34 + 0.64 * aSeed);
    float arc = sin(raw * 3.14159265);
    vec3 position = aDirection * radius + tangent * arc * (0.08 + 0.18 * aSeed);
    position.y += arc * (aSeed - 0.5) * 0.24;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.2 + 3.6 * aSize) * (110.0 / max(0.35, -mv.z));

    float born = step(launch, uSceneTime);
    float life = 1.0 - smoothstep(5.32, 6.72, uSceneTime);
    vAlpha = born * life * uDebrisGain * (0.30 + 0.70 * sin(raw * 3.14159265));
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float alpha = (1.0 - smoothstep(0.08, 0.5, d)) * vAlpha;
    vec3 color = mix(vec3(0.18, 0.54, 1.0), vec3(0.82, 0.96, 1.0), 1.0 - smoothstep(0.0, 0.42, d));
    gl_FragColor = vec4(color, alpha);
  }
`;

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ShellFractureFX({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const shockRef = useRef<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>(null);
  const debrisCount = getParticleBudget(profile).debris;

  const { geometry, material } = useMemo(() => {
    const random = seededRandom(0x5f3759df);
    const directions = new Float32Array(debrisCount * 3);
    const seeds = new Float32Array(debrisCount);
    const sizes = new Float32Array(debrisCount);

    for (let i = 0; i < debrisCount; i += 1) {
      const y = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const radial = Math.sqrt(Math.max(0, 1 - y * y));
      directions[i * 3] = Math.cos(angle) * radial;
      directions[i * 3 + 1] = y;
      directions[i * 3 + 2] = Math.sin(angle) * radial;
      seeds[i] = random();
      sizes[i] = 0.35 + random() * 0.65;
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(new Float32Array(debrisCount * 3), 3));
    buffer.setAttribute("aDirection", new THREE.BufferAttribute(directions, 3));
    buffer.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    buffer.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const shader = new THREE.ShaderMaterial({
      uniforms: {
        uSceneTime: { value: 0 },
        uDebrisGain: { value: 0 }
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    return { geometry: buffer, material: shader };
  }, [debrisCount]);

  const shockGeometry = useMemo(() => new THREE.TorusGeometry(2.02, 0.018, 8, profile.profile === "mobile" ? 64 : 112), [profile.profile]);
  const shockMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#74c8ff"),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }),
    [profile.profile]
  );

  useFrame(() => {
    const sample = runtimeStateRef.current.sceneSample;
    if (!sample) return;
    material.uniforms.uSceneTime.value = sample.sceneTime;
    material.uniforms.uDebrisGain.value = sample.breakup.debrisGain * sample.postFx.debrisGain;

    const shock = shockRef.current;
    if (shock) {
      const wave = sample.breakup.shockwave;
      shock.visible = wave > 0.002;
      shock.scale.setScalar(1 + wave * 0.72);
      shock.material.opacity = wave * sample.postFx.additiveGain * (profile.profile === "mobile" ? 0.20 : 0.30);
      shock.rotation.y = sample.sceneTime * 0.08;
    }
  });

  useEffect(() => {
    geometry.computeBoundingSphere();
    if (geometry.boundingSphere) geometry.boundingSphere.radius = 4.8;
    return () => {
      geometry.dispose();
      material.dispose();
      shockGeometry.dispose();
      shockMaterial.dispose();
    };
  }, [geometry, material, shockGeometry, shockMaterial]);

  return (
    <group name="FAZ5_ShellFractureFX">
      <points geometry={geometry} material={material} frustumCulled />
      <mesh ref={shockRef} geometry={shockGeometry} material={shockMaterial} rotation={[Math.PI / 2, 0, 0]} visible={false} />
    </group>
  );
}
