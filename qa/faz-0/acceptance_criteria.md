# CHATGPT V3 — Sonraki Fazlar İçin Ölçülebilir Başlangıç Kriterleri

## Zaman ve deterministik davranış
- 11,00 saniyelik ana sözleşme korunacak.
- Kritik sahne zamanları: 0,00 / 1,54 / 3,08 / 5,50 / 6,93 / 7,92 / 10,34 / 11,00 sn.
- Aynı sahne zamanı, ileri/geri/rastgele seek sırasından bağımsız olarak aynı ana transform ve ana efekt parametrelerini üretmeli.

## GLB
- `Orb_Main_Cinematic` adı korunmalı ve iki cihaz GLB'sinde aynı ana koreografi bulunmalı.
- `ORB_ROOT`, `CORE_ROOT`, `SHELL_ROOT`, `RINGS_ROOT` düğümleri korunmalı veya açık migration tablosu oluşturulmalı.
- FAZ 3 sonrası gerekli meshlerde NORMAL bulunmalı; doku kullanılan yüzeylerde UV ve gerekliyse tangent doğrulanmalı.
- Yeni GLB glTF 2.0 doğrulamasından hatasız geçmeli.

## Görsel
- 0,00 sn: küre bütün ve okunabilir olmalı; parçalanma henüz başlamamış görünmeli.
- 5,50 sn: kürenin açık hali ve çekirdek aynı kadrajda okunmalı; kamera geometri içine girmemeli.
- 11,00 sn: ana kabuk tamamen birleşmiş görünmeli; sahipsiz ana parça kalmamalı.
- Bloom hiçbir kritik sahne karesinde kabuk/çekirdek ayrımını yok etmemeli.

## Sağlamlık
- Shader NaN/Infinity üretmemeli; ters `smoothstep` çağrıları kaldırılmalı.
- Finalden geriye seek sıçramasız çalışmalı.
- React Strict Mode tekrarlarında sahne kaynağı çoğalmamalı.

## Performans hedefleri
- Desktop başlangıç hedefi: ~60 FPS, p95 kare süresi <= 20 ms.
- Mobil dengeli profil başlangıç hedefi: >=30 FPS, p95 kare süresi <= 36 ms.
- Draw-call başlangıç bütçesi: desktop <=350, mobile <=180.
- GLB başlangıç bütçesi: desktop <=4 MiB, mobile <=2 MiB.

Bu sayılar proje hedefidir; gerçek cihaz ölçümü olmadan “sağlandı” olarak işaretlenemez.
