"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import { getParticleBudget } from "@/lib/particleBudget";
import type { RuntimeStateRef } from "@/lib/types";

function Pillar({
  x,
  z,
  height,
  scale = 1,
  radialSegments = 10,
  layer = "mid"
}: {
  x: number;
  z: number;
  height: number;
  scale?: number;
  radialSegments?: number;
  layer?: "near" | "mid" | "far";
}) {
  const color = layer === "far" ? "#04070b" : layer === "near" ? "#0a0d12" : "#070a0f";
  const roughness = layer === "far" ? 0.94 : layer === "near" ? 0.74 : 0.84;
  const metalness = layer === "near" ? 0.10 : 0.05;
  return (
    <group position={[x, -2.15, z]} scale={scale}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.52, height, radialSegments]} />
        <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
      </mesh>
      <mesh position={[0, height + 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.22, 0.92]} />
        <meshStandardMaterial color={color} roughness={Math.min(1, roughness + 0.02)} metalness={metalness} />
      </mesh>
    </group>
  );
}

export function TempleEnvironment({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const dustMaterial = useRef<THREE.PointsMaterial>(null);
  const dustGroup = useRef<THREE.Points>(null);
  const floorMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const ringMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const backdropMaterial = useRef<THREE.MeshBasicMaterial>(null);

  const dustBudget = getParticleBudget(profile).dust;

  const dust = useMemo(() => {
    const count = dustBudget;
    const data = new Float32Array(count * 3);
    let seed = 8391;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i += 1) {
      data[i * 3] = (rand() - 0.5) * 18;
      data[i * 3 + 1] = rand() * 8 - 2.2;
      data[i * 3 + 2] = (rand() - 0.5) * 16 - 2;
    }
    return data;
  }, [dustBudget]);

  const contactShadow = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: { uOpacity: { value: 0.28 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      void main() {
        float d = length((vUv - 0.5) * 2.0);
        float core = 1.0 - smoothstep(0.06, 0.96, d);
        float falloff = pow(core, 1.75);
        gl_FragColor = vec4(0.0, 0.0, 0.0, falloff * uOpacity);
      }
    `
  }), []);


  useEffect(() => () => {
    contactShadow.dispose();
  }, [contactShadow]);

  useFrame(() => {
    const sample = runtimeStateRef.current.sceneSample;
    if (!sample) return;
    const look = sample.look;
    const lighting = sample.lighting;
    if (dustMaterial.current) {
      dustMaterial.current.opacity = look.dustOpacity * lighting.dustGain * (profile.environmentDetail === "minimal" ? 0.58 : 0.88);
    }
    if (dustGroup.current) {
      dustGroup.current.rotation.y = sample.sceneTime * 0.004;
      dustGroup.current.position.y = Math.sin(sample.sceneTime * 0.16) * 0.035;
    }
    if (floorMaterial.current) {
      floorMaterial.current.roughness = lighting.floorRoughness;
      floorMaterial.current.metalness = lighting.floorMetalness;
      floorMaterial.current.envMapIntensity = 0.38 + lighting.environmentGain * 0.20;
    }
    if (ringMaterial.current) {
      ringMaterial.current.emissiveIntensity = 0.025 + sample.coreEnergy.reveal * 0.055;
      ringMaterial.current.envMapIntensity = 0.42 + lighting.environmentGain * 0.22;
    }
    contactShadow.uniforms.uOpacity.value = lighting.contactShadowOpacity;
    if (backdropMaterial.current) {
      backdropMaterial.current.opacity = 0.90 - lighting.backgroundBlueMix * 0.12;
    }
  });

  const full = profile.environmentDetail === "full";
  const reduced = profile.environmentDetail === "reduced";
  const radialSegments = full ? 10 : reduced ? 8 : 6;
  const floorSegments = full ? 64 : reduced ? 48 : 32;

  return (
    <group>
      <Pillar x={-5.6} z={-2.6} height={7.2} radialSegments={radialSegments} layer="mid" />
      <Pillar x={5.6} z={-2.6} height={7.2} radialSegments={radialSegments} layer="mid" />
      {profile.environmentDetail !== "minimal" && (
        <>
          <Pillar x={-7.4} z={-6.5} height={8.7} scale={1.18} radialSegments={radialSegments} layer="far" />
          <Pillar x={7.4} z={-6.5} height={8.7} scale={1.18} radialSegments={radialSegments} layer="far" />
        </>
      )}
      {full && (
        <>
          <Pillar x={-8.9} z={-10.2} height={10.2} scale={1.30} radialSegments={radialSegments} layer="far" />
          <Pillar x={8.9} z={-10.2} height={10.2} scale={1.30} radialSegments={radialSegments} layer="far" />
        </>
      )}

      <mesh position={[0, -2.28, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[11, floorSegments]} />
        <meshStandardMaterial ref={floorMaterial} color="#05080c" roughness={0.38} metalness={0.26} />
      </mesh>
      <mesh position={[0, -2.268, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.3, 3.8, floorSegments]} />
        <meshStandardMaterial
          ref={ringMaterial}
          color="#0a1017"
          emissive="#15324a"
          emissiveIntensity={0.04}
          roughness={0.34}
          metalness={0.48}
        />
      </mesh>
      <mesh position={[0, -2.258, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[8.8, 8.8]} />
        <primitive object={contactShadow} attach="material" />
      </mesh>

      <mesh position={[0, 1.6, -9.8]}>
        <planeGeometry args={[24, 12]} />
        <meshBasicMaterial ref={backdropMaterial} color="#02050a" transparent opacity={0.90} side={THREE.DoubleSide} />
      </mesh>
      <points ref={dustGroup}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dust, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={dustMaterial} color="#86afd0" size={0.022} transparent opacity={0.16} depthWrite={false} />
      </points>
    </group>
  );
}
