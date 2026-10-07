"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import type { RuntimeStateRef } from "@/lib/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function AdaptiveQualityController({
  profile,
  runtimeStateRef
}: {
  profile: OrbQualityProfile;
  runtimeStateRef: RuntimeStateRef;
}) {
  const setDpr = useThree((state) => state.setDpr);
  const windowRef = useRef({ elapsed: 0, frames: 0, lowWindows: 0, highWindows: 0 });
  const currentDpr = useRef(profile.maxDpr);

  useEffect(() => {
    currentDpr.current = profile.maxDpr;
    setDpr(profile.maxDpr);
    runtimeStateRef.current.adaptiveDpr = profile.maxDpr;
    runtimeStateRef.current.qualityTier = profile.tier;
    runtimeStateRef.current.viewportClass = `${profile.orientation}-${profile.profile}`;
    runtimeStateRef.current.inputMode = profile.inputMode;
    windowRef.current = { elapsed: 0, frames: 0, lowWindows: 0, highWindows: 0 };
  }, [profile, runtimeStateRef, setDpr]);

  useFrame((_, delta) => {
    const sample = windowRef.current;
    sample.elapsed += Math.min(0.1, delta);
    sample.frames += 1;
    if (sample.elapsed < 1.15) return;

    const fps = sample.frames / sample.elapsed;
    runtimeStateRef.current.averageFps = fps;
    sample.elapsed = 0;
    sample.frames = 0;

    if (fps < 46) {
      sample.lowWindows += 1;
      sample.highWindows = 0;
    } else if (fps > 56.5) {
      sample.highWindows += 1;
      sample.lowWindows = 0;
    } else {
      sample.lowWindows = 0;
      sample.highWindows = 0;
    }

    let next = currentDpr.current;
    if (sample.lowWindows >= 2) {
      next = clamp(next - 0.1, profile.minDpr, profile.maxDpr);
      sample.lowWindows = 0;
    } else if (sample.highWindows >= 3) {
      next = clamp(next + 0.05, profile.minDpr, profile.maxDpr);
      sample.highWindows = 0;
    }

    if (Math.abs(next - currentDpr.current) >= 0.025) {
      currentDpr.current = next;
      setDpr(next);
      runtimeStateRef.current.adaptiveDpr = next;
    }
  });

  return null;
}
