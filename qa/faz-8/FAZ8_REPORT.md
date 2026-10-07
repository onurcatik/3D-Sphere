# CHATGPT V3 — FAZ 8 Raporu

## Kapsam

FAZ 8 kamera yönetimi ve sinematik kadraj fazıdır. GLB geometri/animasyon dosyaları değiştirilmemiştir. Çalışma FAZ 7 aktif modelleri üzerinde yapılmıştır.

## Ana değişiklikler

1. `lib/cameraTimeline.ts` yeniden author edildi ve 11 sahne keyframe'i tanımlandı.
2. 5.50–6.93 saniyedeki açık küre için kamera mesafesi belirgin biçimde artırıldı; eski aşırı yakınlaşma yaklaşımı kaldırıldı.
3. Desktop anlatı tarafına göre optical target X bias kullanır: sol metinde nesne sağa, sağ metinde nesne sola taşınır.
4. Optical target ile gerçek focus target ayrıldı. DOF focus distance artık kompozisyon target'ına değil gerçek konu merkezine göre hesaplanır.
5. Target geçişlerinde monotone cubic Hermite kullanılarak ara kare overshoot'u kaldırıldı.
6. Kamera path C1 sürekliliği sonlu fark testiyle doğrulandı.
7. Tablet/mobil profile özgü distance/FOV/composition ölçekleri güncellendi.
8. Touch cihazlarda parallax sıfırlandı; mouse parallax genliği küçültüldü.
9. Kamera clipping aralığı `near=0.10`, `far=60` olarak sıkılaştırıldı.
10. Final hero kamera daha uzakta ve optical target daha aşağıda olacak şekilde düzenlendi; böylece kapalı küre desktop finalde merkez X, üst ekran bölgesinde görünür.

## Gerçek model boyutu ile kamera kararı

FAZ 7 desktop kabuk geometry'sinde yaklaşık muhafazakâr yarıçap:

- Kapalı küre: ~2.15 sahne birimi
- Tam açık düzen (5.50–6.93 s): ~3.99 sahne birimi

Bu nedenle core zirvesinde kamera mesafesi yaklaşık 13+ birim aralığında tutulmuştur. Kamera artık açık kabuk içine girmez.

## 5.50 saniye desktop kadrajı

Gerçek shell vertices ile yapılan projeksiyonda:

- FOV: 44°
- focus-target mesafesi: ~13.78
- NDC X: yaklaşık `[-0.87, -0.04]`
- NDC Y: yaklaşık `[-0.66, +0.64]`
- En yakın shell depth: ~9.97

Bu, açık kürenin tamamının görünmesini ve sağ taraftaki core anlatı metni için alan bırakılmasını hedefler.

## 60 Hz safe-frame denetimi

FAZ 7 shell local AABB köşeleri, gerçek shell transform animasyonu ile 0.00–11.00 s arasında 661 karede projekte edildi.

| Profil | Taşma | Maks. |X| |
|---|---:|---:|
| Desktop 1440×900 | 0 | 0.9634 |
| Tablet portrait 768×1024 | 0 | 0.9364 |
| Mobile portrait 390×844 | 0 | 0.9243 |
| Mobile landscape 844×390 | 0 | 0.3686 |
| Low-power portrait 360×800 | 0 | 0.9421 |

Bu audit muhafazakâr AABB köşeleriyle yapılmıştır; gerçek geometri sınırından daha katı olabilir.

## C1 süreklilik

İç keyframe sınırlarında ±1e-7 progress sonlu fark testi:

- Maks. position velocity jump: ~0.0001831
- Maks. target velocity jump: ~0.0006622
- Maks. FOV velocity jump: ~0.0000642
- Maks. roll velocity jump: ~0.00000842

Kamera sınırlarında sert yön/hız sıçraması tespit edilmemiştir.

## Regresyon

- V3 FAZ 1 validator: PASS
- V3 FAZ 2 validator: PASS
- V3 FAZ 5 validator: PASS
- V3 FAZ 6 validator: PASS
- V3 FAZ 7 validator: PASS
- TS/TSX syntax: PASS
- camera runtime JS syntax: PASS
- Desktop/mobile FAZ 7 GLB hash: DEĞİŞMEDİ

## Ortam engelleri

Tam proje `typecheck`, lint, Next production build ve yeni canlı WebGL screenshot doğrulaması `node_modules` bulunmadığı için tamamlanamamıştır. `eslint` ve `next` executable'ları mevcut değildir; React/Three tipleri çözülememektedir. Bu nedenle FAZ 8 kamera sistemi kaynak/model projeksiyonu seviyesinde doğrulanmış, canlı browser görseli doğrulanmış sayılmamıştır.
