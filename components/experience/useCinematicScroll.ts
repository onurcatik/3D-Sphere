"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";
import type { RefObject } from "react";
import type { OrbQualityProfile } from "@/lib/assetProfile";
import { getScrollProgressForChapter, getScrollTimelineSample, SCROLL_TIMELINE } from "@/lib/scrollTimeline";
import type { RuntimeStateRef, ScrollDirection } from "@/lib/types";

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function useCinematicScroll({
  rootRef,
  runtimeStateRef,
  profile
}: {
  rootRef: RefObject<HTMLElement | null>;
  runtimeStateRef: RuntimeStateRef;
  profile: OrbQualityProfile | null;
}) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !profile) return;

    gsap.registerPlugin(ScrollTrigger);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nativeTouch = profile.nativeTouchScroll || profile.inputMode === "touch";
    const debugUi = new URLSearchParams(window.location.search).get("debug") === "1";
    root.dataset.scrollEngine = nativeTouch ? "native-touch" : reducedMotion ? "native-reduced" : "lenis";
    root.dataset.debugUi = debugUi ? "true" : "false";

    const lenis = reducedMotion || nativeTouch
      ? null
      : new Lenis({
          duration: 1.02,
          smoothWheel: true,
          wheelMultiplier: 0.86,
          touchMultiplier: 1
        });

    const scenePercent = root.querySelector<HTMLElement>("[data-scene-percent]");
    const sceneTime = root.querySelector<HTMLElement>("[data-scene-time]");
    const sceneChapter = root.querySelector<HTMLElement>("[data-scene-chapter]");
    const sceneDebugChapter = root.querySelector<HTMLElement>("[data-scene-debug-chapter]");
    const sceneIndex = root.querySelector<HTMLElement>("[data-scene-index]");
    const scrollRange = root.querySelector<HTMLElement>("[data-scroll-range]");
    const navLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-nav-chapter]"));
    const railLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-rail-chapter]"));

    const updateReadout = (chapterId: string, chapterIndex: number, cinematicProgress: number, seconds: number) => {
      if (scenePercent) scenePercent.textContent = `${Math.round(cinematicProgress * 100)}%`;
      if (sceneTime) sceneTime.textContent = `${seconds.toFixed(2)}s`;
      if (sceneChapter) sceneChapter.textContent = chapterId.toUpperCase();
      if (sceneDebugChapter) sceneDebugChapter.textContent = chapterId;
      if (sceneIndex) sceneIndex.textContent = `${String(chapterIndex + 1).padStart(2, "0")} / ${String(SCROLL_TIMELINE.length).padStart(2, "0")}`;

      navLinks.forEach((link) => {
        const active = link.dataset.navChapter === chapterId;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
      });
      railLinks.forEach((link) => {
        const active = link.dataset.railChapter === chapterId;
        if (active) link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
      });
    };

    const tick = (time: number) => lenis?.raf(time * 1000);
    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    const main = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onUpdate(self) {
        const sample = getScrollTimelineSample(self.progress);
        const direction: ScrollDirection = Math.abs(self.getVelocity()) < 0.1 ? 0 : (self.direction as -1 | 1);

        runtimeStateRef.current.rawScrollProgress = sample.rawScrollProgress;
        runtimeStateRef.current.cinematicProgress = sample.cinematicProgress;
        runtimeStateRef.current.sceneTime = sample.sceneTime;
        runtimeStateRef.current.scrollDirection = direction;
        runtimeStateRef.current.scrollVelocity = self.getVelocity();
        runtimeStateRef.current.activeChapter = sample.chapterId;
        runtimeStateRef.current.chapterProgress = sample.chapterProgress;

        root.dataset.activeChapter = sample.chapterId;
        root.dataset.scrollDirection = direction > 0 ? "forward" : direction < 0 ? "backward" : "still";
        root.style.setProperty("--scroll-progress", sample.rawScrollProgress.toFixed(6));
        root.style.setProperty("--scene-progress", sample.cinematicProgress.toFixed(6));
        root.style.setProperty("--scene-percent", `${(sample.cinematicProgress * 100).toFixed(2)}%`);
        root.style.setProperty("--chapter-progress", sample.chapterProgress.toFixed(6));
        updateReadout(sample.chapterId, sample.chapterIndex, sample.cinematicProgress, sample.sceneTime);
      }
    });

    const syncScrollGeometry = () => {
      const start = Number(main.start) || 0;
      const end = Number(main.end) || start;
      const usable = Math.max(0, end - start);
      root.style.setProperty("--usable-scroll-range", `${usable.toFixed(2)}px`);
      root.dataset.scrollRangePx = usable.toFixed(2);
      if (scrollRange) scrollRange.textContent = `${Math.round(usable)}px`;
    };

    const scrollToProgress = (progress: number, immediate = false) => {
      const start = Number(main.start) || 0;
      const end = Number(main.end) || start;
      const target = start + (end - start) * clamp01(progress);
      if (lenis) {
        lenis.scrollTo(target, {
          duration: immediate || reducedMotion ? 0 : 0.92,
          immediate: immediate || reducedMotion,
          force: true
        });
      } else {
        window.scrollTo({
          top: target,
          behavior: immediate || reducedMotion ? "auto" : "smooth"
        });
      }
    };

    const scrollToChapter = (chapterId: string, immediate = false) => {
      scrollToProgress(getScrollProgressForChapter(chapterId), immediate);
    };

    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-chapter]", root).forEach((section) => {
        const copy = section.querySelector<HTMLElement>(".narrative-copy");
        if (!copy) return;
        gsap.fromTo(
          copy,
          { autoAlpha: nativeTouch ? 0.46 : 0.20, y: nativeTouch ? 24 : 42 },
          {
            autoAlpha: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: nativeTouch ? "top 90%" : "top 82%",
              end: nativeTouch ? "center 60%" : "center 52%",
              scrub: true
            }
          }
        );
      });
    }, root);

    const clickCleanups = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[data-cinematic-link]")).map((link) => {
      const handler = (event: MouseEvent) => {
        const href = link.getAttribute("href");
        if (!href?.startsWith("#")) return;
        const chapterId = href.slice(1);
        if (!SCROLL_TIMELINE.some((segment) => segment.id === chapterId)) return;
        event.preventDefault();
        scrollToChapter(chapterId);
        window.history.replaceState(null, "", href);
      };
      link.addEventListener("click", handler);
      return () => link.removeEventListener("click", handler);
    });

    const onRefresh = () => syncScrollGeometry();
    ScrollTrigger.addEventListener("refresh", onRefresh);
    ScrollTrigger.refresh();
    syncScrollGeometry();

    const initial = getScrollTimelineSample(main.progress);
    runtimeStateRef.current.rawScrollProgress = initial.rawScrollProgress;
    runtimeStateRef.current.cinematicProgress = initial.cinematicProgress;
    runtimeStateRef.current.sceneTime = initial.sceneTime;
    runtimeStateRef.current.activeChapter = initial.chapterId;
    runtimeStateRef.current.chapterProgress = initial.chapterProgress;
    updateReadout(initial.chapterId, initial.chapterIndex, initial.cinematicProgress, initial.sceneTime);

    const initialHash = window.location.hash.slice(1);
    if (initialHash && SCROLL_TIMELINE.some((segment) => segment.id === initialHash)) {
      requestAnimationFrame(() => scrollToChapter(initialHash, true));
    }

    return () => {
      main.kill();
      context.revert();
      clickCleanups.forEach((cleanup) => cleanup());
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      if (lenis) {
        gsap.ticker.remove(tick);
        lenis.destroy();
      }
    };
  }, [profile, rootRef, runtimeStateRef]);
}
