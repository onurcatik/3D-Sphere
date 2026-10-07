# FAZ 0 — Sohbet çalışma ortamı ve gerçek proje incelemesi

## Sonuç

**Durum: TAMAMLANDI — ortam kaynaklı doğrulama engelleri mevcut.**

FAZ 0'da görsel veya davranışsal kaynak kodu değişikliği yapılmadı. Arşiv açıldı, gerçek kaynak yapısı ve GLB dosyaları incelendi, başlangıç bütünlük ve QA kayıtları oluşturuldu.

## Proje yapısı

- Framework: Next.js 16.4.0 (package-lock)
- React: 19.3.0
- Three.js: 0.181.2
- React Three Fiber: 9.8.1
- Drei: 10.7.9
- Postprocessing: 6.39.5 / R3F wrapper 3.1.3
- GSAP: 3.15.0
- Lenis: 1.3.26
- Ana sinematik süre: 11,00 saniye
- Ana scroll yüksekliği: 700dvh
- Persistent Canvas: mevcut
- Desktop/mobile GLB ayrımı: mevcut

## GLB başlangıç envanteri

### Desktop
- Dosya: `public/models/orb_faz8_web_desktop.glb`
- Boyut: 1.444.796 bayt
- Node: 243
- Mesh/primitive: 150 / 150
- Tahmini üçgen: 92.678
- Materyal: 14
- Texture/image: 0 / 0
- Geometri attribute: yalnız POSITION
- `Orb_Main_Cinematic`: 11,0 sn, 167 kanal
- `Ring_Idle`: 4,0 sn
- `Core_Pulse`: ~2,4 sn

### Mobile
- Dosya: `public/models/orb_faz8_web_mobile.glb`
- Boyut: 1.076.060 bayt
- Node: 222
- Mesh/primitive: 129 / 129
- Tahmini üçgen: 60.470
- Materyal: 14
- Texture/image: 0 / 0
- Geometri attribute: yalnız POSITION
- Ana üç animasyon desktop ile aynı ad/süre sözleşmesini koruyor.

## Kaynakta doğrulanan geliştirme riskleri

1. GLB'lerde NORMAL yok; `OrbModel.tsx` normal verisini runtime'da `computeVertexNormals()` ile üretiyor.
2. UV/tangent ve gömülü texture yok; FAZ 3–4'te gerçek yüzey kalitesi için varlık üretim hattı gerekecek.
3. Ana klip `mixer.setTime()` ile scroll-seek ediliyor; bu doğru temel yaklaşım.
4. Çekirdek runtime'ı `state.clock.elapsedTime` ile güncelleniyor; ana sahne zamanından bağımsız.
5. `ParticleEnergyField` ve `VolumetricLightShaft` içinde de bağımsız elapsed-time kullanımı var.
6. `ParticleEnergyField` ve `coreEnergyRuntime.js` içinde ters eşikli `smoothstep` örnekleri tespit edildi.
7. Arşiv baseline'ının 5,50 sn karesinde kamera/geometri yakınlığı ve aşırı beyaz parlama model okunabilirliğini belirgin biçimde düşürüyor.
8. Başlangıç ve final görselleri, hedeflenen “tam bütün -> parçalanma -> tam bütün” hikâyesini yeterince net vermiyor.

## Gerçek test durumu

- Kaynak bütünlüğü: **GEÇTİ** — kaynak/config/GLB dosyaları orijinal arşivle eşleşiyor.
- TS/TSX sözdizimi (`tools/check_ts_syntax.cjs`): **GEÇTİ** — 25 dosya, 0 sözdizimi hatası.
- Legacy FAZ13 statik doğrulayıcı: **GEÇTİ**.
- Runtime JS `node --check`: **GEÇTİ**.
- Bağımlılık kurulumu: **ENGELLİ** — npm registry DNS isteği `EAI_AGAIN`.
- Gerçek proje typecheck: **ENGELLİ** — proje bağımlılıkları kurulamadığından global TypeScript ile yapılan deneme React/Three tiplerini bulamıyor; kod hatası olarak sınıflandırılmadı.
- Lint: **ENGELLİ** — yerel ESLint yok.
- Production build: **ENGELLİ** — yerel Next CLI yok.
- Yeni browser capture: **ENGELLİ** — çalıştırılabilir proje bağımlılıkları mevcut değil. Arşiv screenshotları yalnız geçmiş baseline olarak kullanıldı.
- Blender tabanlı varlık düzenleme: **ENGELLİ** — bu ortamda Blender kurulu değil.

## Faz 0 kabulü

FAZ 0'ın amacı kaynak kodunu değiştirmek değil, güvenilir çalışma zemini oluşturmaktı. Bu amaç tamamlandı. Sonraki fazlarda, bağımlılık kurulumu mümkün hale gelmeden build/browser doğrulaması `GEÇTİ` olarak raporlanmayacaktır.
