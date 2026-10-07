# FAZ 0 — Mevcut Veri Akışı

1. `app/page.tsx` doğrudan `CinematicExperience` bileşenini açar.
2. `CinematicExperience.tsx`, `chooseOrbProfile()` ile cihaz/kalite profilini seçer; `sceneProgressRef` ve `runtimeStateRef` tek üst seviye durum taşıyıcılarıdır.
3. `useCinematicScroll.ts`, ScrollTrigger ilerlemesini `getScrollTimelineSample()` üzerinden ham kaydırma -> sinematik ilerleme -> sahne saniyesine dönüştürür. Lenis yalnız mouse/uygun profilde devrededir.
4. `lib/scrollTimeline.ts` 700dvh akışını 7 bölüme böler ve ana klibin 11 saniyesine map eder.
5. `CinematicCanvas.tsx` tek React Three Fiber Canvas içinde ortam, kalite denetleyicisi, ışık, partikül alanı, GLB küre, kamera ve postprocessing bileşenlerini birlikte mount eder.
6. `OrbModel.tsx`, profilin desktop/mobile GLB dosyasını yükler, sahneyi klonlar, eksik normal verisini runtime'da `computeVertexNormals()` ile üretir ve `Orb_Main_Cinematic` klibini `mixer.setTime(progress * clip.duration)` ile seek eder.
7. `OrbModel.tsx` içindeki `createCoreEnergyRuntime()` ana klipten bağımsız olarak `state.clock.elapsedTime` ile güncellenir. Bu, deterministik ileri/geri seek için FAZ 2 riski olarak kaydedildi.
8. `CameraRig.tsx`, `progressRef` üzerinden kamera pozunu örnekler ve aynı frame içinde `runtimeStateRef` üzerindeki `energy`, `bloom`, `focusDistance` değerlerini yazar.
9. `ParticleEnergyField.tsx`, `VolumetricLightShaft.tsx` ve bazı çevresel hareketler `state.clock.elapsedTime` kullanır. Ana 11 saniyelik sahne zamanı ile tam senkron değillerdir.
10. `CinematicPostFX.tsx`, bloom/DoF/vignette/ACES zincirini uygular; renderer tarafında tone mapping kapalıdır ve final ACES geçişine bırakılmıştır.
11. `AdaptiveQualityController.tsx`, DPR ve kalite durumunu runtime kare hızına göre değiştirir; ayrı bir ikinci kalite yöneticisi tespit edilmedi.
12. DOM anlatı katmanı (`ScrollNarrative`, `ChapterRail`, `SceneHUD`) Canvas dışında kalır; 3D sahne persistent olarak tek Canvas'ta tutulur.
