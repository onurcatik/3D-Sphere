"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CinematicCanvas } from "@/components/scene/CinematicCanvas";
import { ChapterRail } from "@/components/ui/ChapterRail";
import { SceneHUD } from "@/components/ui/SceneHUD";
import { ScrollNarrative } from "@/components/ui/ScrollNarrative";
import { chooseOrbProfile, profileIdentity, type OrbQualityProfile } from "@/lib/assetProfile";
import { SCROLL_HEIGHT_VH } from "@/lib/scrollTimeline";
import type { CinematicRuntimeState } from "@/lib/types";
import { useCinematicScroll } from "./useCinematicScroll";

export function CinematicExperience() {
  const rootRef = useRef<HTMLElement>(null);
  const runtimeStateRef = useRef<CinematicRuntimeState>({
    energy: 0.92,
    bloom: 1.02,
    focusDistance: 11.8,
    cameraLabel: "Hero / establishing",
    rawScrollProgress: 0,
    cinematicProgress: 0,
    sceneTime: 0,
    sceneSample: null,
    scrollDirection: 0,
    scrollVelocity: 0,
    activeChapter: "hero",
    chapterProgress: 0,
    exposure: 0.86,
    bloomIntensity: 1.02,
    bloomThreshold: 0.28,
    vignetteDarkness: 0.82,
    dofBokehScale: 1.1,
    fogDensity: 0.03,
    beamOpacity: 0.34,
    particleIntensity: 0.34,
    particleExpansion: 0.05,
    magneticPull: 0,
    sparkBurst: 0,
    lightningGain: 0.32,
    particleBudgetTotal: 0,
    particleBudgetCap: 0,
    postFxSaturationRisk: 0,
    postFxAdditiveGain: 1,
    composerMultisampling: 0,
    adaptiveDpr: 1,
    averageFps: 60,
    qualityTier: "desktop-balanced",
    viewportClass: "landscape-desktop",
    inputMode: "mouse"
  });
  const [profile, setProfile] = useState<OrbQualityProfile | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = chooseOrbProfile();
        setProfile((previous) => previous && profileIdentity(previous) === profileIdentity(next) ? previous : next);
      });
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    const pointerMedia = window.matchMedia("(pointer: coarse)");
    pointerMedia.addEventListener?.("change", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      pointerMedia.removeEventListener?.("change", update);
    };
  }, []);

  useCinematicScroll({ rootRef, runtimeStateRef, profile });

  const rootStyle = {
    "--experience-scroll-height": `${SCROLL_HEIGHT_VH}dvh`
  } as CSSProperties;

  return (
    <main
      ref={rootRef}
      className="experience-root"
      data-active-chapter="hero"
      data-device-tier={profile?.tier ?? "boot"}
      data-input-mode={profile?.inputMode ?? "mouse"}
      data-orientation={profile?.orientation ?? "landscape"}
      data-debug-ui="false"
      style={rootStyle}
    >
      <a className="skip-link" href="#hero" data-cinematic-link>İÇERİĞE GEÇ</a>

      <header className="site-header">
        <a className="brand" href="#hero" data-cinematic-link aria-label="ORIVION ana sahne">
          <span className="brand-orbit"><i>O</i></span>
          <span className="brand-wordmark">ORIVION</span>
          <small>CINEMATIC SYSTEM</small>
        </a>
        <nav aria-label="Ana navigasyon">
          <a href="#fragment" data-cinematic-link data-nav-chapter="fragment">OBJECT</a>
          <a href="#core" data-cinematic-link data-nav-chapter="core">ENERGY</a>
          <a href="#reassembly" data-cinematic-link data-nav-chapter="reassembly">RETURN</a>
          <a href="#final" data-cinematic-link data-nav-chapter="final">FINAL</a>
        </nav>
        <div className="header-progress" aria-label="Sahne ilerlemesi">
          <span data-scene-chapter>CORE</span>
          <i aria-hidden="true"><b /></i>
          <em data-scene-index>01 / 07</em>
        </div>
      </header>

      <div className="scene-sticky" aria-label="Kaydırma kontrollü gerçek zamanlı 3D sahne">
        <img className="reference-fallback" src="/reference/orb-reference.png" alt="" aria-hidden="true" />
        <div className="temple-silhouette temple-silhouette--left" />
        <div className="temple-silhouette temple-silhouette--right" />
        <div className="light-column" />
        <div className="canvas-shell">
          {profile ? (
            <CinematicCanvas profile={profile} runtimeStateRef={runtimeStateRef} />
          ) : (
            <div className="profile-loader">SAHNE PROFİLİ HAZIRLANIYOR</div>
          )}
        </div>
        <SceneHUD />
        <div className="grain" />
        <div className="vignette" />
        <div className="scroll-hint" aria-hidden="true">
          <span>{profile?.inputMode === "touch" ? "SWIPE" : "SCROLL"}</span>
          <i />
        </div>
      </div>

      <ChapterRail />
      <ScrollNarrative />

      <div className="scene-debug" aria-hidden="true">
        <span data-scene-debug-chapter>hero</span>
        <span data-scene-percent>0%</span>
        <small data-scene-time>0.00s</small>
        <small data-scroll-range>0px</small>
      </div>
    </main>
  );
}
