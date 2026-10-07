# 3D Premium Website — FAZ 13

FAZ 13, FAZ 12 premium UI katmanını bozmadan responsive/mobile production davranışını tamamlar.

## Yeni katmanlar
- 5 kademeli cihaz / kalite profili
- Desktop vs mobile GLB otomatik seçimi
- Runtime Adaptive DPR / FPS governor
- Portrait mobile kamera re-composition
- Native touch scroll, desktop Lenis ayrımı
- Touch cihazlarda pointer parallax kapatma
- Environment LOD / dust azaltma
- Volumetric beam segment LOD
- Profile bağlı shadow map bütçesi
- Dynamic viewport (`dvh`/`svh`)
- iOS safe-area desteği
- Mobile portrait / compact / landscape CSS
- Orientation ve resize profile refresh
- ChapterRail + SceneHUD gerçek mount düzeltmesi

## Çalıştırma
```bash
npm install
npm run dev
```

## Doğrulama
```bash
npm run validate
```

Ana 3D varlıklar `public/models/` altında FAZ 8 optimize desktop/mobile GLB olarak korunmuştur. FAZ 13 model geometrisini veya ana 11 saniyelik animation clip'i değiştirmez.

## CHATGPT V3 GLB production pipeline

FAZ 3 keeps the original FAZ13 GLBs immutable and builds versioned active assets:

```bash
npm run models:v3
npm run validate:v3:faz3
```

Active files:

- `public/models/orb_v3_faz3_desktop.glb`
- `public/models/orb_v3_faz3_mobile.glb`

The pipeline embeds vertex normals and generates one reversed-winding inner surface for each of the 14 animated shell pieces. See `spec/v3/FAZ3_GLB_ASSET_CONTRACT.md` for the guarantees and current UV/tangent/bevel policy.

## CHATGPT V3 FAZ 4 — premium material surface system

FAZ 4 builds material-authored versions of the FAZ 3 geometry without changing its binary geometry/animation payload:

```bash
npm run models:v3
npm run validate:v3:faz4
```

Active files:

- `public/models/orb_v3_faz4_desktop.glb`
- `public/models/orb_v3_faz4_mobile.glb`

The GLBs embed `KHR_materials_clearcoat`, `KHR_materials_transmission`, `KHR_materials_volume`, `KHR_materials_ior`, and `KHR_materials_emissive_strength` where appropriate. Runtime equivalents live in `lib/orbMaterialSystem.ts`. UVs/textures are intentionally not fabricated in this phase; see `spec/v3/FAZ4_MATERIAL_SURFACE_CONTRACT.md`.

## CHATGPT V3 FAZ 5 — deterministic shell breakup choreography

FAZ 5, premium FAZ 4 modellerinin yalnız `Shell_01..Shell_14` translation/rotation kanallarını yeniden author eder ve üç kademeli parçalanmayı doğrudan GLB içine bake eder:

```bash
npm run models:v3:faz5
npm run validate:v3:faz5
```

Active files:

- `public/models/orb_v3_faz5_desktop.glb`
- `public/models/orb_v3_faz5_mobile.glb`

Koreografi `spec/v3/orb_breakup_choreography.json` ile tanımlanır. 14 parça 3.08 saniyeye kadar neredeyse kapalı kalır, A/B/C grupları gecikmeli ayrılır ve 5.50 saniyede kararlı açık poza ulaşır. Web runtime'daki `ShellFractureFX` yalnız deterministik `sceneTime` ile çalışan tek şok halkası, mikro kırıntılar ve fracture-seam enerji katmanını sağlar. Ayrıntılı sözleşme: `spec/v3/FAZ5_BREAKUP_CHOREOGRAPHY_CONTRACT.md`.

## CHATGPT V3 FAZ 6 — deterministic three-layer core energy

FAZ 6, FAZ 5 GLB'lerini değiştirmeden çekirdeği üç ana görsel katmana ayırır: `Runtime_InnerCore`, `Core_Vortex_GEO` ve `Core_EnergyShell_GEO`. `Core_Halo_GEO` ayrı optik çevre katmanıdır. Bütün katmanlar `lib/coreEnergyTimeline.ts` üzerinden 11 saniyelik `SceneSample` zamanına bağlanır.

Desktop'ta en fazla 5, mobile'da en fazla 3 dinamik enerji bağı çekirdekten seçilmiş hareketli `Shell_XX` düğümlerine world-space olarak bağlanır. Bağlantılar rastgele değildir ve finalde tamamen kapanır.

```bash
npm run validate:v3:faz6
```

Ayrıntılı sözleşme: `spec/v3/FAZ6_CORE_ENERGY_CONTRACT.md`.

## CHATGPT V3 FAZ 7 — magnetic recall and exact reassembly

FAZ 7 replaces the temporary post-6.93 fallback with a fully authored deterministic return sequence. The shell first aligns to its target orientation, then closes in five opposite-pair waves and reaches the exact closed pose by 10.34 s.

```bash
npm run models:v3:faz7
npm run validate:v3:faz7
```

Active files:

- `public/models/orb_v3_faz7_desktop.glb`
- `public/models/orb_v3_faz7_mobile.glb`

`lib/orbReassemblyTimeline.ts` drives magnetic guide/seam/seal gains from `sceneTime`; `lib/runtime/reassemblyRuntime.js` draws deterministic slot guides and the final sealing ring. Detailed contract: `spec/v3/FAZ7_REASSEMBLY_CONTRACT.md`.

## CHATGPT V3 FAZ 8 — cinematic camera composition

FAZ 8 replaces the inherited close-up camera path with an authored 11-second composition system. The open orb is fully framed during 5.50–6.93 s, desktop composition alternates away from narrative copy, and tablet/mobile profiles attenuate horizontal bias while increasing distance/FOV for safe framing.

```bash
npm run validate:v3:faz8
```

Key files:

- `lib/cameraTimeline.ts`
- `components/scene/CameraRig.tsx`
- `spec/v3/FAZ8_CAMERA_COMPOSITION_CONTRACT.md`

The validator projects conservative FAZ 7 shell bounds across 661 frames for desktop, tablet portrait, mobile portrait/landscape and low-power portrait. FAZ 8 does not modify the active FAZ 7 GLBs.

## CHATGPT V3 FAZ 9 — lighting, environment and spatial depth

FAZ 9 keeps the active FAZ 7 GLBs unchanged and rebuilds the scene-lighting hierarchy around one shadow-casting key, a warm rear rim, a low cool fill, short-range core light, timeline-driven PMREM reflections, layered temple depth, analytic contact shadow and restrained volumetric shaft.

```bash
python3 tools/validate_v3_faz9.py
```

Key files:

- `lib/lightingTimeline.ts`
- `components/scene/SceneLighting.tsx`
- `components/scene/MaterialEnvironment.tsx`
- `components/scene/TempleEnvironment.tsx`
- `components/scene/CinematicAtmosphere.tsx`
- `components/scene/VolumetricLightShaft.tsx`
- `spec/v3/FAZ9_LIGHTING_ENVIRONMENT_CONTRACT.md`

At the 5.50 s core reveal, fog density is intentionally reduced and exposure trimmed while PMREM response is slightly increased, preserving metal/crystal detail instead of solving the image with additional bloom. Live Three.js/browser inspection remains blocked in the current workspace because project dependencies are not installed.

## CHATGPT V3 FAZ 10 — particle budget and restrained post-processing

FAZ 10 puts all particle-like systems under one tier budget and introduces a shared highlight-pressure/post-processing budget. Bloom, DOF, core additive layers, main energy particles, fracture debris, environment dust, reassembly guides and the volumetric shaft are no longer allowed to peak independently.

```bash
npm run validate:v3:faz10
npm run qa:saturation
```

Key files:

- `lib/particleBudget.ts`
- `lib/postProcessingBudget.ts`
- `components/scene/CinematicPostFX.tsx`
- `components/scene/ParticleEnergyField.tsx`
- `components/scene/ShellFractureFX.tsx`
- `lib/runtime/coreEnergyRuntime.js`
- `tools/analyze_frame_saturation.py`
- `spec/v3/FAZ10_PARTICLE_POSTFX_CONTRACT.md`

Particle caps include the primary energy field, core GPU particles, fracture debris and environment dust together. Desktop/tablet tiers stay below 3,000 particles and mobile/low-power stay below 1,000. The saturation analyzer is a QA warning metric only; it does not replace visual review. The archival FAZ13 baseline has one severe warning frame at progress 0.63, where near-white pixels exceed 21% of the image. A current rendered before/after saturation comparison remains blocked until the project dependencies can be installed and the updated browser render can run.

## CHATGPT V3 — FAZ 11

FAZ 11 arayüz ve scroll deneyimini 11 saniyelik deterministik sahne sözleşmesine bağlar. Bölüm linkleri fiziksel DOM section tepesine değil gerçek ScrollTrigger aralığındaki chapter başlangıcına gider. Normal header bölüm adı + chapter indeksi gösterir; raw yüzde/saniye bilgisi yalnız `?debug=1` ile açılır.

Doğrulama:

```bash
npm run validate:v3:faz11
```

Tam `typecheck`, `lint`, `build` ve canlı browser doğrulaması için proje bağımlılıklarının (`node_modules`) kurulmuş olması gerekir.
