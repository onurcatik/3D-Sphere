# CHATGPT V3 Change Log

## Revizyon V3-F0 — FAZ 0 / Çalışma ortamı ve gerçek proje incelemesi

- Orijinal `3D_Premium_Website_FAZ13.zip` değiştirilmeden çalışma ağacına açıldı.
- Kaynak/config/GLB SHA-256 bütünlük kaydı oluşturuldu.
- Desktop ve mobile GLB ikili yapısı doğrudan incelendi; düğüm, mesh, üçgen, materyal, attribute ve animasyon envanteri çıkarıldı.
- Mevcut sahne veri akışı ve bağımsız zaman kaynakları belgelendi.
- Arşiv görsel baseline'ı incelendi; yeni görsel çekim olarak sunulmadı.
- `tools/validate_faz13.py`, TypeScript/TSX sözdizimi kontrolü ve runtime JS sözdizimi kontrolü geçti.
- Proje bağımlılık kurulumu npm registry DNS erişimi (`EAI_AGAIN`) nedeniyle tamamlanamadı. Bu nedenle gerçek proje typecheck/lint/build ve yeni tarayıcı çekimi FAZ 0'da **ENGELLİ** olarak kaydedildi.
- Uygulama kaynak kodu, GLB ve kullanıcıya görünen tasarım değiştirilmedi.

## Revizyon V3-F1 — FAZ 1 / 11 saniyelik sahne ve tek zaman sözleşmesi

- 11.00 saniyelik ana sinematik süre ve kritik olay zamanları tek sabit sözleşmede toplandı: `0.00 / 1.54 / 3.08 / 5.50 / 6.93 / 7.92 / 10.34 / 11.00` saniye.
- Eski segment ease yaklaşımı yerine kritik düğümleri koruyan `monotone-cubic-hermite` scroll→scene mapping kuruldu; bölüm sınırlarındaki sıfıra zorlanan hız kaldırıldı.
- `lib/sceneTimeline.ts` ve `SceneTimelineDriver` ile kamera, look/ışık ve particle-energy durumu tek `SceneSample` üzerinden örneklenir hale getirildi.
- Ana `Orb_Main_Cinematic` GLB seek'i ortak scene sample progress'ine bağlandı.
- Kamera keyframe'leri `lib/cameraTimeline.ts` içinde tek kaynağa alındı; eski `lib/runtime/cameraRig.js` uyumluluk adaptörüne dönüştürüldü.
- `CameraRig`, `SceneLighting`, `CinematicAtmosphere`, `CinematicPostFX`, `ParticleEnergyField`, `VolumetricLightShaft` ve `TempleEnvironment` doğrudan ayrı progress/look örneklemesi yerine shared scene sample tüketir hale getirildi.
- 10.001 scroll örneğinde monotonluk, tüm kritik zaman sınırları ve bölüm sınırlarında C1 hız sürekliliği doğrulandı.
- Kamera örneklemesi, FAZ 1 öncesi runtime algoritmasıyla 1.001 örnekte `maxAbsoluteDifference = 0` sonucu verdi.
- Desktop ve mobile GLB dosyalarının SHA-256 özetleri değişmedi.
- FAZ 2 kapsamındaki bağımsız `elapsedTime` saatleri, ters `smoothstep` ifadeleri ve finalden geriye seek sertleştirmesi bu fazda bilinçli olarak değiştirilmedi.
- npm registry erişim engeli devam ettiği için tam proje typecheck/lint/build ve yeni tarayıcı çekimi **ENGELLİ** olarak kalmıştır.

## CHATGPT V3 — FAZ 2

- Cinematic runtime'daki bağımsız `state.clock.elapsedTime` kullanımları kaldırıldı.
- Particle/core hareketi için smootherstep hız eğrisinin analitik integraliyle deterministik `flowTime` eklendi.
- Core ribbon/ring `rotation +=` hareketleri başlangıç pozu + mutlak flow-time formülüne geçirildi.
- Ters sayısal `smoothstep` ifadeleri ve near-zero normalize riskleri düzeltildi.
- Ortak `configureSeekableAction` / `seekAnimationAction` üretim yordamı eklendi ve asset testine bağlandı.
- Runtime material restoration/disposal ve orb base-material cleanup güçlendirildi.
- V3 FAZ 2 doğrulayıcısı PASS; desktop/mobile GLB hash'leri değişmedi.
- Gerçek Three.js+GLB test, full typecheck/lint/build ve browser testi proje bağımlılıkları eksik olduğu için ENGELLİ.


## Revizyon V3-F3 — FAZ 3 / Gerçek GLB geliştirme ve üretim hattı

- Orijinal `orb_faz8_web_desktop.glb` ve `orb_faz8_web_mobile.glb` dosyaları değiştirilmeden korundu; SHA-256 kayıtları alındı.
- Dış bağımlılık gerektirmeyen `tools/glb_v3_pipeline.py` üretim hattı eklendi.
- Aktif sürümlü modeller `orb_v3_faz3_desktop.glb` ve `orb_v3_faz3_mobile.glb` olarak üretildi ve `assetProfile.ts` bunlara geçirildi.
- Tüm triangle primitive'lere float32 gömülü vertex `NORMAL` accessor'ları eklendi; runtime `computeVertexNormals()` yalnız legacy/bozuk asset fallback'i olarak bırakıldı.
- 14 ana kabuk parçasının kapalı manifold ve pozitif hacimli olduğu üretim sırasında doğrulandı.
- Her kabuğa `MAT_Shell_Inner` kullanan, 0.016 sahne birimi içe offset edilmiş, ters winding/ters normal iç yüzey geometrisi eklendi.
- `Shell_01`–`Shell_14` için kararlı `shell-01`–`shell-14` kimlikleri ve pivot-koruma metadata'sı eklendi.
- Kaynak BIN prefix'i, orijinal transformlar ve bütün animasyon sampler/channel payload'ları byte/semantik düzeyde değişmeden korundu.
- Desktop aktif model 2,085,464 bayt; mobile aktif model 1,513,500 bayt olarak 4 MiB / 2 MiB proje bütçelerinin içinde kaldı.
- Pipeline aynı girdide ikinci kez çalıştırıldı; çıktı hash'leri birebir aynı kalarak deterministik üretim doğrulandı.
- Yeni GLB'ler bağımsız `trimesh` okuyucusunda başarıyla açıldı ve finite bounds doğrulandı.
- Mevcut GLB'lerde texture/normal-map bulunmadığı için keyfi UV/tangent üretilmedi; bu karar FAZ 3 asset sözleşmesine kaydedildi.
- Blender/DCC bulunmadığından yıkıcı geometrik bevel uygulanmadı. Animasyon topolojisini riske atan yaklaşık bevel yerine bu adım FAZ 4'te non-destructive edge response veya DCC erişimi olduğunda gerçek bevel için açık bırakıldı.
- FAZ 1 ve FAZ 2 regresyon doğrulamaları geçti. Gerçek Three.js GLTFLoader/AnimationMixer testi `three` paketi bulunmadığı için ENGELLİ durumunda kaldı.

## Revizyon V3-F4 — FAZ 4 / Malzeme, yüzey ve premium görsel kimlik

- Aktif desktop/mobile modeller `orb_v3_faz4_*` sürümüne geçirildi; FAZ 3 geometri ve animasyon BIN payload'ı birebir korundu.
- GLB materyallerine uygun yerlerde `KHR_materials_clearcoat`, `KHR_materials_transmission`, `KHR_materials_volume`, `KHR_materials_ior` ve `KHR_materials_emissive_strength` tanımları eklendi.
- `lib/orbMaterialSystem.ts` ile dış grafit kabuk, antik altın, iç kırık yüzey, kristal, obsidyen platform, rune ve enerji aileleri için ayrı premium PBR roller oluşturuldu.
- Kristal runtime'ı bağımsız yeni kristal materyali kurmak yerine premium kristal materyalini klonlayıp yalnız dinamik transmission değerini günceller hale getirildi.
- Cihaz profiline bağlı PMREM environment intensity eklendi; mobil/düşük güçte transmission, clearcoat ve çevre yansıması kontrollü azaltıldı.
- Renk yönetimi politikası korundu: renderer sRGB + NoToneMapping, postprocessing zincirinde tek ACES Filmic pass.
- UV, tangent, texture veya normal map uydurulmadı; mevcut textureless asset yapısı bilinçli olarak korundu.
- FAZ 4 material pipeline aynı girdiyle tekrar üretildiğinde hash'ler birebir eşleşti.
- `trimesh` bağımsız GLB yüklemesi geçti; Khronos glTF Validator CLI bu ortamda kurulu değil.
- FAZ 1 ve FAZ 2 regresyon doğrulayıcıları geçti. Tam typecheck/lint/build ve canlı Three.js/browser render, eksik `node_modules` nedeniyle ENGELLİ kalmıştır.

## Revizyon V3-F5 — FAZ 5 / Mucizevi parçalanma koreografisi

- `Shell_01`–`Shell_14` parçalanması üç kademeli A/B/C koreografisine dönüştürüldü; başlangıçlar 3,08 / 3,26 / 3,44 sn ve parça bazlı sabit gecikmelerle tanımlandı.
- 3,08 sn'de kabuk yaklaşık 0,026 birim gerilim açıklığında tutuldu; eski animasyondaki erken 0,6–0,8 birim ayrışma kaldırıldı.
- Heavy orta-kuşak parçaları daha kısa/yavaş yörünge, üst/alt parçalar daha çevik ve daha açısal hareket kullanır hale getirildi.
- Bütün parçalar aynı yönlü tangential spiral akışla ayrılır; hareket boyunca yeni muhafazakâr AABB overlap çifti oluşmadığı 60 Hz örnekleme ile doğrulandı.
- 5,50 sn açık poz displacement aralığı 1,186–1,495 birim; minimum açık-poz bounding-sphere clearance 0,529 birim olarak ölçüldü.
- `Orb_Main_Cinematic` içindeki yalnız 28 shell transform kanalı yeniden author edildi; kalan 139 kanalın animation accessor payload'ı birebir korundu.
- Shell transformları 60 Hz sabit örnekleme ile GLB'ye bake edildi; desktop/mobile açık pozları birebir eşitlendi.
- `lib/orbBreakupTimeline.ts` eklendi; seam glow, şok halkası ve mikro-kırıntı gain değerleri tek `sceneTime` sözleşmesinden üretilir hale getirildi.
- `ShellFractureFX.tsx` ile tek genişleyen şok halkası ve sabit seed'li GPU mikro kırıntı sistemi eklendi; bağımsız saat/autoplay kullanılmadı.
- FAZ 3 inner-shell materyalinin emissive yoğunluğu parçalanma seam enerjisine bağlandı.
- Aktif modeller `orb_v3_faz5_desktop.glb` (2.359.076 B) ve `orb_v3_faz5_mobile.glb` (1.787.108 B) olarak güncellendi; 4 MiB / 2 MiB bütçeleri korundu.
- GLB koreografi pipeline ikinci kez çalıştırıldığında SHA-256 değerleri birebir aynı kaldı.
- FAZ 1 ve FAZ 2 regresyon doğrulayıcıları, V3 FAZ 5 validator, TS/TSX syntax ve bağımsız trimesh load kontrolleri geçti.
- FAZ 5 yalnız parçalanmayı nihai hale getirir; 6,93–7,92 sn geçişi FAZ 7 manyetik birleşme uygulanana kadar kaynak animasyona güvenli fallback'tir.
- Tam typecheck/lint/build ve canlı Three.js/browser doğrulaması `node_modules` bulunmadığı için ENGELLİ kalmıştır.
- FAZ 5 animation sampler bufferView kayıtlarından gereksiz `ARRAY_BUFFER` target işaretleri kaldırıldı; animation verisi targetsız bufferView olarak yeniden üretildi ve deterministik hash kontrolü tekrar geçti.

## Revizyon V3-F6 — FAZ 6 / Çekirdek, enerji alanı ve doğaüstü görünüm

- `lib/coreEnergyTimeline.ts` eklendi; inner core, vortex, membrane, halo, shell connection, beam, particle, core light ve white-hot kazançları tek 11 saniyelik `sceneTime` sözleşmesine bağlandı.
- Çekirdek üç ana katmana ayrıldı: `Runtime_InnerCore`, `Core_Vortex_GEO` ve `Core_EnergyShell_GEO`; `Core_Halo_GEO` ayrı optik çevre katmanı olarak tutuldu.
- Mevcut core shader beyaz doygunluğu azaltacak biçimde yeniden dengelendi; vortex akışı `flowTime`, düşük frekans pulse davranışı `sceneTime` ile deterministik çalışır.
- Desktop için en fazla 5, mobile için en fazla 3 world-space enerji bağı çekirdekten seçilmiş hareketli `Shell_XX` düğümlerine bağlandı. Uç noktalar her karede gerçek world transformlardan alınır.
- Bağlantı hatlarında `Math.random`, `Date.now`, `elapsedTime` veya geçmiş kareye bağlı fizik kullanılmaz; dalga şekli sahne zamanından analitik olarak üretilir.
- 5,50 sn'de connection gain 1,00 ile zirve yapar; 11,00 sn finalinde 0,00 olur ve açık enerji bağı bırakılmaz.
- `ParticleEnergyField`, `VolumetricLightShaft` ve `SceneLighting` ortak `coreEnergy` kazançlarını tüketir hale getirildi.
- `CinematicPostFX` çekirdek maksimum görünürlüğünde ayrıntı kaybını azaltmak için sınırlı bloom detail-guard kullanır.
- FAZ 5 desktop/mobile GLB dosyalarının SHA-256 değerleri değişmedi.
- 10.001 örnekli core-energy timeline testi sonlu/bounded geçti; maksimum ardışık örnek farkı yaklaşık 0,001068 olarak ölçüldü.
- V3 FAZ 1, FAZ 2 ve FAZ 5 regresyon doğrulamaları yeniden geçti. Canlı Three.js/WebGL/browser doğrulaması `node_modules` bulunmadığı için ENGELLİ kalmıştır.

## Revizyon V3-F7 — FAZ 7 / Manyetik geri çağırma ve kusursuz birleşme

- FAZ 5'in 0–6,93 sn parçalanma hareketi birebir korunarak 6,93–11,00 sn aralığı tamamen yeniden author edildi.
- 6,93–7,92 sn arasında kabuklar açık konumda kalırken hedef yuva dönüşlerine %86 oranında hizalanır; maksimum kalan açısal hata yaklaşık 7,28°'dir.
- 7,92–10,34 sn arasında 14 kabuk beş karşılıklı dalga halinde kapanır: W1 `[1,3,11,13]`, W2 `[2,4,12,14]`, W3 `[5,8]`, W4 `[6,9]`, W5 `[7,10]`.
- Her kabuk 0,11 birim ön-yuva mesafesine yaklaşır ve son 0,22 sn içinde hedefi aşmadan pozitif-only manyetik seat hareketiyle oturur.
- İlk yol taramasında görülen `Shell_03–Shell_08` muhafazakâr AABB yakınlaşması Shell 08 yolu aşağı yönlü revize edilerek giderildi; 6,93–10,34 sn boyunca final pozda zaten mevcut temaslar dışında yeni AABB overlap çifti 0'dır.
- 10,34 sn'de maksimum konum hatası yaklaşık `3,83e-05`, rotasyon hatası 0°; 11,00 sn'de bütün parçalar exact hedef pozu korur.
- `lib/orbReassemblyTimeline.ts` eklendi; alignment, progress, guideGain, seamGlow, seatPulse ve sealPulse tek `sceneTime` üzerinden üretilir.
- `lib/runtime/reassemblyRuntime.js` ile hareketli kabuklardan kendi hedef yuvalarına deterministik enerji kılavuzları ve final dar mühür halkası eklendi.
- Inner-shell emissive davranışı parçalanma ve yeniden birleşme seam enerjisinin maksimumunu kullanır hale getirildi.
- Aktif GLB'ler `orb_v3_faz7_desktop.glb` ve `orb_v3_faz7_mobile.glb` olarak güncellendi; desktop yaklaşık 2,36 MB, mobile yaklaşık 1,79 MB ile bütçe içinde kaldı.
- FAZ 7 GLB pipeline aynı girdilerle ikinci kez çalıştırıldığında SHA-256 değerleri birebir aynı kaldı.
- FAZ 7 validator, TS/TSX syntax, runtime JS syntax, bağımsız `trimesh` yükleme ve FAZ 1/2/5/6 regresyon kontrolleri geçti.
- Tam project typecheck/lint/build ve canlı Three.js/WebGL görünüm doğrulaması `node_modules` bulunmadığı için ENGELLİ kalmıştır.

## Revizyon V3-F8 — FAZ 8 / Kamera yönetimi ve sinematik kadraj

- Kamera yolu 11 keyframe'li yeni sinematik kompozisyonla yeniden author edildi; 5,50–6,93 sn açık küre aşamasındaki eski aşırı yakınlaşma kaldırıldı.
- FAZ 7 kabuk sınırları ölçüldü: kapalı düzen yaklaşık 2,15, açık düzen yaklaşık 3,99 sahne birimi muhafazakâr yarıçapa ulaşıyor; core kamera mesafesi buna göre yaklaşık 13+ birim aralığına çıkarıldı.
- Desktop'ta anlatı metninin tersine optical target X bias uygulanır hale getirildi: sol metinde küre ekran-sağ, sağ metinde ekran-sol kompoze ediliyor.
- Optical composition target ile gerçek `focusTarget` ayrıldı; DOF focus distance artık konu merkezine göre hesaplanıyor.
- Target interpolation monotone cubic Hermite'e geçirildi; target overshoot nedeniyle oluşan ara-kare screen-edge taşmaları kaldırıldı.
- Position/target/FOV/roll kamera eğrilerinde C1 süreklilik sonlu fark testiyle doğrulandı.
- Tablet portrait profilinde distance/composition/FOV; mobile portrait profilinde distance/composition/FOV; low-power portrait profilinde ek güvenlik marjı yeniden ayarlandı.
- Mouse parallax taban genlikleri 0,045/0,018 seviyesine düşürüldü ve keyframe `parallaxGain` ile core zirvesinde daha da azaltıldı; touch profillerinde parallax sıfırdır.
- Perspective clipping aralığı `near=0.10`, `far=60` olarak sıkılaştırıldı.
- Final hero kadrajı X ekseninde merkezlenip Y ekseninde üst bölgeye taşındı; merkez anlatı metniyle doğrudan çakışma azaltıldı.
- FAZ 7 shell geometry muhafazakâr AABB köşeleri gerçek 60 Hz animasyonla 661 karede projekte edildi. Desktop, tablet portrait, mobile portrait, mobile landscape ve low-power portrait profillerinin tamamında safe-frame taşması 0 olarak doğrulandı.
- FAZ 1/2/5/6/7 regresyon doğrulayıcıları ve TS/TSX/runtime JS syntax kontrolleri geçti.
- Aktif desktop/mobile FAZ 7 GLB SHA-256 değerleri değişmedi.
- Tam project typecheck/lint/build ve canlı Three.js/WebGL görsel onayı `node_modules` bulunmadığı için ENGELLİ kalmıştır.

## Revizyon V3-F9 — FAZ 9 / Işık, ortam ve mekânsal derinlik

- `lib/lightingTimeline.ts` ile 11 saniyelik sahneye bağlı 10 keyframe'li ayrı ışık/atmosfer sözleşmesi eklendi ve `SceneSample.lighting` üzerinden tek örnekleme zincirine bağlandı.
- Sahne ışıkları yeniden düzenlendi: yalnız bir shadow-casting key spot, sıcak arka rim, düşük yoğunluklu soğuk fill, düşük hemisphere/ambient ve kısa menzilli core light kullanılıyor.
- Core reveal anında beyazlama riskini azaltmak için `exposureTrim=0.94`, `fogDensityScale=0.74`, `environmentGain=1.04` ve kontrollü core-light gain kullanılıyor.
- `MaterialEnvironment` cihaz profili + lighting timeline ile dinamik `scene.environmentIntensity` kullanır hale getirildi; yerel `RoomEnvironment + PMREM` yapısı korunarak dış HDR bağımlılığı eklenmedi.
- Tapınak çevresi orta/arka/uzak katmanlara ayrıldı (`z=-2.6/-6.5/-10.2`); full-detail profilde ek uzak sütunlar eklendi.
- Zemin roughness/metalness değerleri timeline'a bağlandı, düşük maliyetli ritüel halka ve analitik radial contact-shadow shader eklendi.
- Fog rengi ile clear/background rengi ayrıldı; core reveal sırasında atmosfer açılırken arka planın tamamen maviye dönmesi engellendi.
- Volumetric shaft tek mesh olarak korunup yoğunluğu `lighting.shaftGain × coreEnergy.beamGain` ile sınırlandı; depth test açık/depth write kapalı tutuldu.
- FAZ 9 validator 10.001 lighting örneğinde finite/smooth değerler, tek shadow light, timeline-driven PMREM/fog/floor/contact-shadow ve geçerli `smoothstep` sırası kontrollerini geçti.
- FAZ 1/2/5/6/7/8 regresyon doğrulayıcıları yeniden geçti ve aktif FAZ 7 desktop/mobile GLB hash'leri değişmedi.
- Tam project typecheck/lint/build ve canlı WebGL görsel doğrulama `node_modules` bulunmadığı için ENGELLİ kalmıştır.

## Revizyon V3-F10 — FAZ 10 / Parçacık bütçesi ve görüntü sonrası efektler

- `lib/particleBudget.ts` ile ana enerji alanı, core GPU parçacıkları, fracture debris ve ortam tozu tek cihaz-tier bütçesine alındı; desktop-high toplam 2.650, desktop-balanced 2.220, tablet 1.620, mobile 870 ve low-power 540 parçacık kullanıyor.
- `lib/postProcessingBudget.ts` eklendi; bloom, core additive gain, particle opacity/size, debris, dust, shaft, DOF ve vignette aynı deterministik highlight-pressure/saturation-risk sinyalinden yönetilir hale getirildi.
- `SceneSample.postFx` tek sahne zaman sözleşmesine dahil edildi; PostFX ve parçacık tüketicilerindeki bağımsız maksimumların aynı anda tepe yapması engellendi.
- Bloom kontrolü seçici hale getirildi; 10.001 örnek × 5 profil taramasında maksimum intensity yaklaşık 0,499, minimum luminance threshold yaklaşık 1,196 olarak doğrulandı.
- Desktop DOF bokeh değeri ciddi biçimde sınırlandı; tablet/mobile/low-power profillerde DOF kapalı kalmaya devam ediyor.
- EffectComposer render target antialiasing'i açıkça tanımlandı: desktop-high 4x, desktop-balanced/tablet 2x, mobile/low-power 0x multisampling.
- Ana energy field, core particles ve fracture debris için muhafazakâr bounding sphere tanımlanıp normal frustum culling yeniden açıldı; koşulsuz çizim kaynaklı overdraw azaltıldı.
- `coreEnergyRuntime` için `setVisualBudget` eklendi; vortex/membrane/halo/inner core, runtime particles, lightning/arcs, rune emissive ve core lights ortak additive bütçeye bağlandı.
- Reassembly guide ve final seal ring, fracture shock/debris, volumetric shaft ve environment dust aynı görsel bütçe sinyallerini tüketir hale getirildi.
- CSS grain desktop/tablet/mobile için azaltıldı; low-power'da kapalı tutuldu. Ek chromatic-aberration pass eklenmedi ve ikinci CSS vignette overlay'i zayıflatıldı.
- `tools/analyze_frame_saturation.py` eklendi. Arşiv baseline'ında 0.63 progress karesinde near-white oranı %21,385 ve high-luma oranı %25,631 ölçülerek tarihsel aşırı pozlama sorunu sayısal olarak kaydedildi.
- FAZ 10 validator, TS/TSX syntax, core/reassembly runtime JS syntax ve FAZ 1/2/5/6/7/8/9 regresyon zinciri geçti; aktif FAZ 7 GLB hash'leri değişmedi.
- Önceki faz validator'larındaki kırılgan kaynak-string kontrolleri yalnız eşdeğer local-variable SceneSample assembly ve yeni ortak PostFX guard mimarisini tanıyacak şekilde genişletildi; sayısal kabul eşikleri gevşetilmedi.
- `npm run typecheck`, `npm run lint` ve `npm run build` yeniden çalıştırıldı; `node_modules`/React/Three/Next/eslint eksikliği nedeniyle ENGELLİ kaldı. Bu nedenle güncel browser render ve FAZ 10 sonrası gerçek piksel saturation karşılaştırması henüz yapılmış sayılmadı.

## Revizyon V3-F11 — FAZ 11 / Premium arayüz, içerik ve kaydırma deneyimi

- Root scroll yüksekliği `SCROLL_HEIGHT_VH=700` tek kaynağına bağlandı ve CSS'e `--experience-scroll-height` olarak aktarılır hale getirildi.
- Header/CTA/chapter rail/deep-link navigasyonu DOM section tepesine değil, `ScrollTrigger.start/end` gerçek piksel aralığı ile `SCROLL_TIMELINE.scrollStart` değerinin doğrudan eşleşmesine geçirildi.
- Yedi chapter başlangıcının ilgili sceneTime değerine maksimum hata `0` ile eşlendiği ve 10.001 scroll örneğinin finite/monoton olduğu doğrulandı.
- Header üretim görünümünde raw yüzde ve saniye kaldırıldı; bölüm adı + progress line + `NN / 07` indeksi kullanılır hale getirildi.
- `% / saniye / scroll px` tanı metrikleri yalnız `?debug=1` ile açılan ayrı `.scene-debug` katmanına taşındı.
- Navigation ve chapter rail aktif öğeleri `aria-current="step"` ile işaretlenir hale getirildi; klavye kullanımı için skip link ve chapter `aria-labelledby` bağlantıları eklendi.
- Eski `FAZ 13 / RESPONSIVE + MOBILE OPTIMIZATION` final rozeti kaldırıldı; finalde kullanıcı kontrollü `BAŞA DÖN` ve `PARÇALANMAYI İZLE` aksiyonları eklendi.
- Narrative copy Türkçe karakterlerle ve V3 gerçek davranışına göre güncellendi; doğrulanmamış ürün/müşteri/ödül iddiası eklenmedi.
- Scene HUD'daki raw `GLB/R3F` ve `11.00 SEC` teknik metinler üretim diline dönüştürüldü.
- Teknik micro-copy/body tipografi okunabilirliği yükseltildi; CTA/text action hedefleri en az 48 px ve mobil safe-area desteği korunacak biçimde düzenlendi.
- Scroll-snap veya zorunlu autoplay eklenmedi; touch/reduced-motion native scroll davranışı korunuyor.
- FAZ 10 regresyon kontrolünde eksik olduğu saptanan `TempleEnvironment` dust count merkezi `getParticleBudget(profile).dust` kaynağına bağlandı; FAZ 10 tekrar GEÇTİ.
- FAZ 11 validator ile FAZ 1/2/5/6/7/8/9/10 regresyon zinciri ve TS/TSX syntax kontrolleri geçti; aktif FAZ 7 GLB hash'leri değişmedi.
- Full typecheck/lint/build ve güncel browser render `node_modules`/React/Three/Next/eslint eksikliği nedeniyle ENGELLİ kalmıştır.
