# Jelajah Kota Kita 💕 — Simulator Mobil Sirkuit Balap 3D

Website statis (HTML + CSS + JS murni) berisi simulator mobil 3D bertema
ulang tahun, sekarang berupa **sirkuit balap oval** dari garis START sampai
FINISH di monumen ulang tahun. Dibangun dengan **Three.js** murni (WebGL
asli), tanpa framework/backend/build tool. Bisa dibuka langsung dengan
**dobel-klik `index.html`** dari file explorer (`file://`) — tidak perlu
server apa pun.

> Catatan: dunia ini awalnya jauh lebih ramai (bangunan kota, billboard
> foto, hewan-hewan, awan, dsb) — semuanya sudah dihapus bertahap sesuai
> permintaan user demi fokus murni ke sirkuit balap. Riwayat lengkapnya ada
> di bagian **Log Keputusan Desain** di bawah.

## Struktur File

```
kota-kenangan/
├── index.html          # markup: lock-screen, canvas WebGL, joystick analog, cake-intro,
│                          layar surat ulang tahun + <script> CDN Three.js
│                          (non-module, versi dipin) + <script src="script.js">
├── style.css            # semua styling & tema visual "cute pastel"
├── script.js            # seluruh logic: scene/camera/renderer/lighting,
│                          sirkuit balap oval (aspal, curb, garis start/finish,
│                          gerbang), air (danau/pantai), mobil, fisika &
│                          collision (2D top-down), input, chase cam, HUD,
│                          lock-screen, suara, loop render
├── assets/photos/        # foto untuk gapura foto di sepanjang lintasan
│                          (foto-1.jpg dst — lihat README.txt di dalamnya)
└── README.md             # dokumen ini
```

`script.js` ditulis sebagai satu classic script (bukan ES module — lihat Log
Keputusan Desain #1) dan dipecah dengan komentar `SECTION n` untuk memisahkan
tiap bagian logic secara jelas:

0. Konfigurasi global (password lock, ukuran dunia, palet warna, titik acuan)
1. State global (scene refs, state mobil, collider list, input state)
2. Init renderer / scene / kamera (tone mapping, fog, env map prosedural)
3. Utilitas collider & penempatan acak (`findClearRandomSpot`, dsb.)
4. Lintasan sirkuit balap — satu-satunya jalan di dunia ini (aspal, curb
   tikungan, garis start/finish, gerbang START/FINISH)
5. Air (danau, pantai)
7B. Suara (Web Audio API, disintesis — tanpa file audio eksternal)
8. Titik FINISH (koordinat trigger surat ulang tahun) + monumen ulang tahun + kembang api
8D. Monumen foto di luar lintasan (satu per file foto di assets/photos/)
8F. Hamparan bunga yang membentuk tulisan "SELAMAT ULANG TAHUN SAYANG"
    (`buildFlowerFields()`, font bitmap 5x7 `FLOWER_FONT_5X7`,
    InstancedMesh, tanpa collider — lihat Log Keputusan Desain)
9. Mobil (gaya Mini Cooper, geometry primitif)
10. Fisika & collision (2D top-down) + koridor rute (`applyRouteLock`)
11. Kamera chase cam
12. HUD
13. Input (keyboard digital + joystick analog touch, `getThrottleAxis()`/`getSteerAxis()`)
14. Layar kunci password
15. Loop utama (`animate`)
16. Bootstrap (`init`)

## Arsitektur & Konvensi Kunci

### Lintasan sirkuit balap
Satu **sirkuit balap tunggal** berbentuk **oval/stadion** (dua lintasan
lurus panjang + dua tikungan setengah-lingkaran cembung) dari titik START
ke FINISH (monumen ulang tahun), didefinisikan sebagai satu polyline
`TRACK_WAYPOINTS` (`buildOvalTrackWaypoints()`, lebar `TRACK_WIDTH = 14`)
yang dipakai bersama oleh aspalnya sendiri (`buildRaceTrack()`, tiap segmen
lewat `addRoadSegment` + tambalan bundar di tiap tikungan supaya tidak ada
celah) dan koridor collision mobil (`applyRouteLock()`) — satu sumber data
supaya jalan yang terlihat & koridor mobil selalu presis selaras. Marka
jalan (tepi + tengah putus-putus) digambar sebagai mesh `PlaneGeometry`
terpisah di atas badan jalan. Bentuk oval (cembung) sengaja dipilih
ketimbang rute zigzag yang lebih dulu dipakai — lihat Log Keputusan Desain.

Sirkuit ini juga dilengkapi:
- **Curb (kerb) merah-putih** selang-seling di kedua tikungan (`buildCurbs()`)
- **Garis kotak-kotak START & FINISH** digambar langsung di aspal
  (`buildStartFinishLines()`, texture canvas)
- **Gerbang START & FINISH** — banner kain bertuliskan teks (`buildRaceGates()`)

Semua bangunan distrik kota, billboard foto, hewan, awan, dan dekorasi kecil
lainnya yang pernah ada di versi sebelumnya sudah dihapus total — dunia
sekarang murni sirkuit + monumen (titik finish) + air.

### Collision (2D top-down, sumbu x/z)
- **Lingkaran (circle-vs-circle)**: danau, rantai titik sepanjang pantai.
  Pantai sengaja dibuat solid lewat rantai lingkaran berjarak dekat di
  sepanjang tepinya.
- Batas dunia ditegakkan lewat `clamp()` posisi mobil (`WORLD_HALF`).
- Koridor rute (`applyRouteLock`, lihat di bawah) adalah lapisan collision
  TAMBAHAN yang aktif selama `freeRoam` masih `false`.

### Koridor rute (`applyRouteLock`)
Mobil **tidak boleh keluar dari lintasan** selama `freeRoam` masih `false`:
tiap frame, posisi kandidat mobil diproyeksikan ke SEMUA segmen
`TRACK_WAYPOINTS`, dicari segmen terdekat, lalu dijepit dalam radius
`TRACK_HALF_WIDTH` (7 unit) dari segmen itu. `freeRoam` baru diset `true`
setelah pemain menutup surat ulang tahun (klik "Lanjut Jalan-jalan") —
setelah itu mobil bebas ke mana saja.

### Monumen & titik FINISH
`FINISH_POINT` adalah titik TERAKHIR di `TRACK_WAYPOINTS` — bukan koordinat
terpisah lagi, jadi finish selalu berada tepat di ujung aspal yang benar-
benar tersambung dari START (lihat Log Keputusan Desain soal bug "finish
tanpa jalan" yang ini perbaiki). `landmarkCenter` (disalin dari
`FINISH_POINT`) dipakai `checkCakeTrigger()` untuk memicu perayaan begitu
mobil mendekat dalam radius `CAKE_TRIGGER_RADIUS` (16 unit). Monumennya
sendiri (`buildLandmark()`) berupa gapura 10 pilar + kubah + bunting,
banner besar "HAPPY BIRTHDAY", 32 balon mengambang, kue 7 lilin, dan 40
partikel kerlap-kerlip ambient — semua dianimasikan tiap frame lewat
`updateLandmarkAnimations()` (balon naik-turun, bendera berkibar, lilin
berkedip, lampu warna-warni berdenyut, sparkle berkelip). Monumen ini juga
melepas kembang api ambient berkala (setiap 5-9 detik) walau mobil belum
sampai, supaya terasa hidup dari kejauhan. Begitu trigger aktif: overlay
HTML `#cake-intro` muncul (±1.5 detik) dibarengi jingle suara & pesta
kembang api tambahan (`triggerFireworksShow()`, SECTION 8C), lalu otomatis
lanjut ke `#birthday-screen` (surat ulang tahun, dengan bunyi "pop"
kertas) — surat & overlay ini murni HTML/CSS di atas canvas, bukan bagian
dari scene Three.js.

### Layar kunci password
State global `unlocked` dicek di awal `updatePhysics()` sebelum input apa pun
diproses — mobil sama sekali tidak bisa digerakkan sebelum password benar.
Scene 3D tetap dirender di belakang overlay translusen. Password & hint adalah
konstanta (`LOCK_PASSWORD`, `LOCK_HINT`) di bagian atas `script.js`, siap
diganti user.

### Nama yang berulang tahun
Konstanta `BIRTHDAY_PERSON_NAME` (SECTION 0, `script.js`) menyimpan nama
orang yang ulang tahun — saat ini **Gabriela Oktaviany Sihaloho**. Dipakai
di dua tempat lewat `populateBirthdayLetter()`: judul surat
(`#birthday-title`, "Selamat Ulang Tahun, {nama}!") dan baris pembuka
`BIRTHDAY_LETTER_LINES[0]` ("Happy Birthday, {nama}! 🎉"), jadi kalau nama
diganti di satu tempat itu, otomatis konsisten di judul & isi surat.
`<title>` di `index.html` juga disebut "untuk Gabriela" sebagai penanda
cepat di tab browser. Lihat Log Keputusan Desain.

## Cara Pakai

1. Buka `index.html` langsung (dobel-klik dari file explorer, atau drag ke
   browser).
2. Password sudah diisi (`27012026`, hint "sandi hp android kamuuu 🫵") —
   ganti `LOCK_PASSWORD`/`LOCK_HINT` di awal `script.js` kalau mau diubah.
   Nama yang berulang tahun ada di `BIRTHDAY_PERSON_NAME` (lihat bagian
   "Nama yang berulang tahun" di atas).
3. Kontrol: panah/WASD (desktop), joystick analog on-screen (mobile/sentuh
   — geser knob-nya ke arah mana pun, gas & belok mengikuti sebesar
   geserannya), tombol
   `🎥`/`C` untuk ganti jarak chase cam (Dekat/Sedang/Jauh).
4. Di awal permainan mobil dipandu lewat koridor sirkuit menuju FINISH di
   monumen ulang tahun; sepanjang jalan akan melewati gapura-gapura foto
   besar yang melintang di atas jalan. Setelah surat ditutup, mobil bebas
   ke mana saja.
5. Foto di gapura-gapura foto sekarang di-embed langsung
   (`assets/photos-embedded.js`) supaya dijamin tampil walau dibuka lewat
   dobel-klik tanpa server. Mau ganti ke foto asli kamu? Lihat panduannya
   di `assets/photos/README.txt` (dua opsi: jalankan server lokal, atau
   generate ulang file embed-nya).

---

## Log Keputusan Desain

### 2026-09-21 (lanjutan 8) — Kalimat "di pelosok" dihapus (terlalu personal), pesawat diturunkan & baliho tidak terbalik, +3 efek animasi baru
Permintaan user tiga bagian:

**(1) Kalimat balon dialog "di pelosok" terlalu personal.** 25 kalimat di
`GREETER_MESSAGES` (entri lanjutan 7) yang eksplisit menyebut "kerja di
plosok/pelosok", "sinyal susah", "jauh dari hiburan", dsb. digeneralkan:
nada penyemangat/doanya dipertahankan, tapi rujukan konkret ke kondisi
kerja Gabriela dihapus (mis. "kerja di plosok itu tak mudah" -> "perjalananmu
tidak selalu mudah"). Total tetap 200 kalimat unik, semua tetap memuat
nama Gabriela/GbYoung — hanya isinya yang diperhalus.

**(2) Pesawat baliho: dua masalah terpisah.**
- *Terbang lebih rendah*: ketinggian di `buildAirplanes()` diturunkan dari
  `46 + (i%5)*11` (46-90, rata-rata ~68) jadi `32 + (i%5)*6` (32-56,
  rata-rata ~44) — turun ~35%. Batas bawah 32 dihitung sengaja tetap di
  atas struktur tertinggi kota (gedung + spire puncak di
  `buildBigBuilding()`, maksimum ~28.6) supaya pesawat tidak pernah
  terlihat menembus atap gedung manapun.
- *Tulisan baliho terbalik*: baliho pesawat sebelumnya SATU mesh dengan
  `material.side = THREE.DoubleSide` menampilkan texture yang sama dari
  kedua sisi. Karena pesawat terbang muter mengelilingi kota, sisi
  belakang baliho (yang pasti terlihat juga dari sudut tertentu)
  menampilkan tulisan CERMIN/terbalik. Diperbaiki dengan trik yang sama
  yang sudah dipakai banner "HAPPY BIRTHDAY" di monumen: baliho dipecah
  jadi DUA mesh (`bannerFront` & `bannerBack`, `FrontSide` bawaan,
  `DoubleSide` dihapus dari materialnya), salah satunya diputar
  `rotation.y = Math.PI`. Karena geometrinya ikut berputar sebagai satu
  kesatuan rigid (bukan cuma tembus-pandang lewat DoubleSide), tulisan
  terbaca benar dari kedua arah.

**(3) +3 efek animasi baru (SECTION 8G) supaya kota makin ramai**, semua
di-hook ke `init()`/`animate()`:
- **Balon udara** (`buildHotAirBalloons`, 7 buah): melayang mengelilingi
  kota di lapisan langit sendiri (y 60-84) — di ATAS pesawat (32-56) tapi
  di BAWAH awan (48-92), supaya tidak numpuk dengan dekorasi langit lain.
- **Kincir angin** (`buildPinwheels`, 24 buah): tersebar di darat lewat
  `findClearRandomSpot()`, bilahnya berputar terus-menerus
  (`updatePinwheels`) — gerakan cepat & jelas dari dekat, beda dari
  dekorasi statis (tugu/patung/gedung) yang sudah ada.
- **Hujan konfeti ambient** (`buildConfettiRain`, 90 keping): potongan
  kertas kecil jatuh pelan + goyang menyamping, tersebar di SELURUH kota
  sepanjang waktu (bukan cuma meledak sesaat di finish seperti SECTION
  8C) — didaur ulang ke atas lagi saat menyentuh tanah, tanpa alokasi
  objek baru tiap frame. Jumlahnya sengaja dijaga tipis (90, bukan
  ratusan) supaya tidak mengganggu visibilitas saat menyetir.

**Verifikasi**: `node --check script.js` lolos; dihitung ulang margin
ketinggian pesawat vs struktur tertinggi kota (32 vs 28.6, aman ~3.4
unit); disimulasikan ulang ke-200 kalimat balon dialog — 200 unik, semua
tetap memuat nama, tidak ada lagi kata "plosok"/"pelosok".

### 2026-09-21 (lanjutan 7) — Kalimat balon dialog diganti 200 ucapan baru (dari daftar user) yang disesuaikan dengan data Gabriela
Permintaan user: ganti kalimat-kalimat ucapan di balon dialog dengan
daftar ucapan ulang tahun yang user berikan, tetapi disesuaikan dgn data:
nama Gabriela, perempuan, beragama Kristen, ulang tahun ke-26, dan sedang
berjuang bekerja di plosok dengan hiburan minim.

**Perubahan** (SECTION 8B4, `script.js`): pendekatan kombinatorik lama
(`GREETER_OPENERS` × `GREETER_WISHES`, lihat entri lanjutan 4) DIGANTI
array `GREETER_MESSAGES` berisi 200 kalimat tulisan langsung.
`getUniqueGreeterMessage(index)` dipertahankan (nama & pemanggilnya di
`attachGreeterBubble()` tidak berubah), isinya kini cuma mengambil
`GREETER_MESSAGES[index % length]`. Dipilih tulis-langsung karena kalimat
dari daftar user beragam bentuk & panjangnya, tidak bisa dirakit dari
pola pembuka × penutup tanpa terdengar kaku.

**Cara menyesuaikan daftar sumber**: (1) kalimat berbau Islami
(Barakallahu fii umrik, milad, Allah, dsb.) diubah jadi doa Kristiani
(Tuhan Yesus, berkat, kasih karunia, Amin); (2) kalimat khusus usia 17,
21, 30, 40, 50 diubah jadi "ke-26"/"usia 26"; (3) kalimat orang tua
(Ayah/Ibu/kakek-nenek) & kalimat "untukku" (sudut pandang orang
pertama) diubah jadi ditujukan ke Gabriela; (4) kalimat penyemangat
("tahun ini tidak mudah", "kamu tidak sendirian") dikaitkan dgn kerja di
plosok, sinyal susah, & hiburan minim; (5) kutipan tokoh dibuat
tanpa atribusi nama di awal/akhir (kecuali yang memang bagian
kalimat, mis. Carl Jung, Franklin, Shirley Bassey) supaya balon tetap
ringkas & tidak memuat atribusi yang diragukan keakuratannya.

**Konvensi yang tetap dijaga**: tepat 200 kalimat (= `COUNT` orang di
`buildCityPeople`), semuanya unik, dan SETIAP kalimat memuat "Gabriela"
atau "GbYoung" (permintaan user di entri lanjutan 4). Panjang tiap
kalimat dijaga <= ~120 karakter supaya teks di balon tetap besar
(mekanisme word-wrap dari entri lanjutan 6 tidak diubah). Emoji dibatasi
ke yang umum (hindari emoji baru rilis yang bisa jadi kotak kosong di
HP lama).

**Verifikasi**: simulasi di luar browser terhadap ke-200 kalimat: 200
unik, semuanya memuat nama, 0 balon meluber, font 24-32px (mayoritas
26px), maksimal 5 baris. Font uji lebih lebar dari Baloo 2 sehingga di
browser asli teks biasanya sedikit lebih besar.

### 2026-09-21 (lanjutan 6) — Teks balon dialog terpotong: diganti word-wrap multi-baris + font auto-fit lebar & tinggi
Permintaan user: teks di balon dialog ucapan ulang tahun tidak tercover
dengan baik oleh kotak dialognya — terpotong di tepi dan tidak terbaca.

**Akar masalah** (di `makeSpeechBubbleTexture()`, SECTION 8B4): dua hal
yang saling memperparah. (1) Kalimat (opener + harapan dari
`getUniqueGreeterMessage()`, bisa ~75 karakter dgn emoji) digambar dalam
SATU baris, padahal lebar teks yang tersedia di canvas 512px cuma ~450px.
(2) `shrinkFontToFit()` — yang dipakai untuk mengecilkan font — berhenti di
font minimum (22px) TANPA memeriksa apakah teksnya sudah muat, jadi untuk
kalimat panjang hasil akhirnya tetap lebih lebar dari gelembung dan
terpotong di kiri-kanan. (Efek ini baru terlihat setelah balon dinaikkan
ke semua 200 orang dgn kalimat gabungan opener × harapan yang panjang —
lihat entri lanjutan 4.)

**Perbaikan**: teks sekarang dipecah per kata jadi beberapa baris lewat
helper baru `wrapTextToLines(ctx, text, maxWidth)`, lalu font dicari dari
besar ke kecil (46px → 16px, langkah 2px) sampai SEMUA baris muat di
lebar area teks (`w0 - 64`, menyisakan 32px tiap sisi supaya tidak
menyentuh garis tepi/lengkung sudut) DAN total tinggi baris muat di tinggi
gelembung (`h0 - 48`). Baris digambar terpusat secara vertikal & horizontal.
`shrinkFontToFit()` TIDAK diubah/dihapus karena masih dipakai banner
lain (gerbang, monumen, baliho pesawat); hanya balon dialog yang tidak
lagi memakainya. Ukuran sprite (4.4×2.48), posisi (`y=3.15`), resolusi canvas
(512×288), dan radius pemicu tidak diubah — sengaja tidak menaikkan
resolusi canvas karena ada 200 texture, menaikkannya akan melipatgandakan
pemakaian memori GPU.

**Verifikasi**: logika yang sama disimulasikan untuk ke-200 kalimat (di
luar browser, pakai font fallback yang lebih lebar dari Baloo 2 sehingga
tesnya lebih ketat): 0 balon yang meluber, font terkecil 28px (naik dari
22px yang sebelumnya tetap terpotong), maksimal 4 baris per balon.

### 2026-09-21 (lanjutan 5) — Tampilan mobile (tanpa keyboard) dibuat bersih: default kamera Jauh, HUD disembunyikan
Permintaan user, khusus untuk perangkat mobile tanpa keyboard fisik
(perangkat sentuh murni):

- **Default kamera jadi "Jauh"**: `camPresetIndex` (SECTION 1) tadinya
  selalu `1` ("Sedang") untuk semua perangkat. Sekarang di-inisialisasi
  kondisional lewat `window.matchMedia("(pointer: coarse)")` — breakpoint
  yang SAMA PERSIS dipakai CSS untuk memunculkan joystick analog (lihat
  entri log "Kontrol mobile diganti... joystick analog") — jadi definisi
  "mobile tanpa keyboard" konsisten dgn yang sudah dipakai proyek ini:
  perangkat sentuh (`coarse`) dapat `camPresetIndex = 2` ("Jauh"),
  perangkat mouse/trackpad (`fine`) tetap `1` ("Sedang") seperti semula.
  `initChaseCam()` juga disesuaikan supaya label teks `#cam-btn-label`
  di-sync ke preset yang sesungguhnya dipakai saat startup (sebelumnya
  cuma teks statis "Sedang" di `index.html`, bisa salah tampil kalau
  suatu saat tombolnya perlu dimunculkan lagi).
- **HUD disembunyikan supaya tampilan bersih**: tombol ganti kamera
  (`#cam-btn`), card status rute "Ikuti lintasan menuju FINISH..."
  (`#route-status`), kompas (`#compass`), dan HUD kecepatan (`#speed-hud`)
  disembunyikan (`display: none`) di `style.css`, ditaruh di dalam
  media query `@media (pointer: coarse)` yang SAMA dipakai joystick — jadi
  cuma hilang di perangkat sentuh, TIDAK berubah sama sekali di desktop
  (mouse/keyboard). Karena tombol kamera ikut hilang di perangkat ini,
  presetnya sengaja dikunci ke "Jauh" (poin di atas) sejak awal — pemain
  di HP tidak lagi punya cara mengubahnya secara manual, jadi default-nya
  perlu benar sejak pertama kali dibuka. `#hud` sendiri (kontainer
  pembungkus keempatnya) tidak diapa-apakan — sudah `pointer-events: none`
  tanpa background sejak awal, jadi aman ditinggal kosong tanpa efek
  visual apa pun.

### 2026-09-21 (lanjutan 4) — Balon dialog dinaikkan jadi SEMUA 200 orang, tiap kalimat dijamin unik & memuat nama Gabriela/GbYoung
Permintaan lanjutan user: naikkan lagi jumlah penyapa dari 100 jadi
**semua 200 orang** di kota, dengan syarat tambahan tiap kalimat ucapan
HARUS berbeda-beda (tidak boleh ada yang sama) DAN harus memuat nama
"Gabriela" atau "GbYoung" di dalamnya.

`buildCityPeople()` diubah dari kondisi bersyarat (`if (i % 2 === 0)
attachGreeterBubble(...)`) jadi tanpa syarat — `attachGreeterBubble(person)`
dipanggil untuk SEMUA 200 orang, bukan sebagian. Daftar kalimat statis
`GREETER_MESSAGES` (12 item, dipakai round-robin, rawan berulang kalau
dipakai untuk 200 orang) dihapus total, diganti pendekatan kombinatorik
yang menjamin keunikan secara matematis, bukan cuma "kebetulan tidak
sama": `GREETER_OPENERS` (20 kalimat pembuka, MASING-MASING sudah
menyebut nama "Gabriela" atau "GbYoung" — 10 varian per nama) ×
`GREETER_WISHES` (10 kalimat harapan penutup generik, tanpa nama, jadi
tidak perlu diulang di tiap opener). `getUniqueGreeterMessage(index)`
memetakan tiap `index` 0..199 ke SATU pasangan (opener, wish) berbeda
lewat pembagian bilangan bulat (`index % 20` untuk opener, `floor(index /
20) % 10` untuk wish) — karena 20 × 10 = 200 tepat sama dengan jumlah
orang, setiap pasangan dipakai TEPAT SEKALI, sehingga 200 kalimat hasil
gabungannya dijamin semuanya berbeda tanpa perlu menulis 200 baris teks
manual satu-satu (yang rawan salah ketik/tanpa sengaja duplikat).
Diverifikasi lewat simulasi terpisah: dari 200 kalimat yang dihasilkan,
200 di antaranya unik (0 duplikat) dan semuanya memuat kata "Gabriela"
atau "GbYoung". `attachGreeterBubble()` & `updateGreeters()` (jarak
pemicu, ukuran/posisi sprite) tidak diubah — perubahan ini murni soal
jumlah orang & sumber kalimatnya.

### 2026-09-21 (lanjutan 3) — Balon dialog ucapan diperbesar & jumlah penyapa dinaikkan jadi 100 dari 200 orang
Permintaan lanjutan user: balon dialog ucapan ulang tahun (fitur SECTION
8B4 yang baru ditambahkan) diperbesar, dan jumlah orang yang jadi
"penyapa" dinaikkan dari 1/8 (~25 orang) jadi **1/2 (100 dari 200 orang
kota)** — `buildCityPeople()` diubah dari kondisi `i % 8 === 0` jadi
`i % 2 === 0`. Ukuran sprite balon (`attachGreeterBubble()`) dinaikkan
dari 2.6×1.46 jadi **4.4×2.48** (rasio aspek dijaga sama persis dengan
canvas gelembungnya, 512:288, supaya tidak gepeng/melar), dan posisi
vertikalnya ikut dinaikkan dari lokal `y=2.55` ke `y=3.15` — perlu supaya
ekor balon yang sekarang jauh lebih besar tetap menggantung rapi di atas
kepala orangnya, bukan malah menembus/menimpa kepala karena baloonnya
membesar tapi posisinya tetap sama. `GREETER_TRIGGER_RADIUS` (jarak
mobil-ke-orang supaya balon muncul) tidak diubah — permintaan user cuma
soal ukuran & jumlah, bukan jarak pemicunya.

### 2026-09-21 (lanjutan 2) — PIN (bukan "password"), hint & title diganti, tanda tangan surat, spasi PIN↔tombol, dan balon dialog ucapan dari orang-orang random
Enam permintaan lanjutan dari user:

- **"Password" → "PIN"**: seluruh teks user-facing yang menyebut kata
  sandi diganti jadi "PIN" — placeholder input (`Masukkan PIN...`) dan
  pesan error (`PIN salah, coba lagi ya`) di `index.html`, plus komentar
  konstanta `LOCK_PASSWORD` di `script.js` ("Password layar kunci" →
  "PIN layar kunci"). Nama variabel `LOCK_PASSWORD` sendiri sengaja TIDAK
  diganti — itu murni identifier internal, tidak pernah tampil ke user,
  jadi mengubahnya cuma menambah risiko salah ketik tanpa manfaat apa pun.
- **Hint diganti**: `LOCK_HINT` dari "sandi hp android kamuuu 🫵" jadi
  "tanggal akward" sesuai permintaan user persis.
- **Title/heading diganti**: "Jelajah Kota Kita" → "Perayaan di Dunia
  GbYoung" di dua tempat yang memakainya sebagai judul tampilan: tag
  `<title>` (tab browser) dan `<h1>` di layar kunci (`index.html`). Judul
  dokumentasi di `README.md` sendiri tidak ikut diubah karena itu nama
  proyek untuk keperluan dokumentasi teknis, bukan teks yang dilihat
  pemain di dalam game.
- **Tanda tangan penutup surat diganti**: baris terakhir
  `BIRTHDAY_LETTER_LINES` dari "— Yang selalu nungguin jarak ini berakhir
  💕" jadi **"— Aldo💕"** persis sesuai permintaan user.
- **Jarak PIN↔tombol ditambah 30px lagi**: `margin-bottom` pada
  `#lock-input` (`style.css`) dinaikkan dari 34px ke **64px** (34+30)
  sesuai permintaan eksplisit "tambahkan padding 30px lagi".
- **Balon dialog ucapan ulang tahun dari orang-orang random**: fitur baru
  SECTION 8B4 (`GREETER_MESSAGES`, `makeSpeechBubbleTexture()`,
  `attachGreeterBubble()`, `updateGreeters()`). Sebagian orang kota (1 dari
  8, dipilih lewat `i % 8 === 0` di `buildCityPeople()` — total ~25 dari
  200) masing-masing ditempeli satu **balon dialog** (`THREE.Sprite`,
  otomatis selalu menghadap kamera, texture canvas bentuk gelembung
  komik + ekor runcing) berisi SATU kalimat ucapan ulang tahun yang
  BERBEDA per orang — dipilih round-robin dari daftar 12 variasi
  `GREETER_MESSAGES` (bukan `Math.random()` murni) supaya variasinya
  benar-benar tersebar rata ke semua penyapa, bukan kebetulan sering
  mengulang kalimat yang sama. Balon disembunyikan (`sprite.visible =
  false`) sejak dibuat, lalu `updateGreeters()` (dipanggil tiap frame di
  `animate()`) mengecek jarak 2D `carState.x/z` ke posisi tiap penyapa —
  begitu mobil masuk radius 9 unit (`GREETER_TRIGGER_RADIUS`) balonnya
  otomatis muncul, dan begitu mobil menjauh lagi balonnya disembunyikan
  lagi, persis alur yang diminta user. Balon dipasang sebagai child dari
  group orangnya sendiri (posisi lokal `y = 2.55`, sedikit di atas kepala)
  supaya otomatis ikut posisi orangnya tanpa perlu sinkronisasi manual.
  Dibatasi 1 dari 8 orang (bukan semua 200) supaya efeknya terasa sebagai
  "kejutan di tempat tertentu", bukan seluruh kota berteriak sekaligus,
  sekaligus menjaga jumlah sprite tambahan tetap ringan di render.

### 2026-09-21 (lanjutan) — Pesawat baliho jadi armada 10 (bukan 1) + perbaikan akar masalah "tidak terlihat", teks surat disesuaikan, hewan/orang/badut diperbanyak lagi
Tiga permintaan lanjutan dari user setelah pembaruan sebelumnya (pesawat
diperbesar, hewan/orang diperbanyak):

- **Pesawat "tidak terlihat / seperti menetap di satu tempat" — akar
  masalah ketemu, diperbaiki, sekalian dijadikan 10 pesawat**: pesawat
  tunggal sebelumnya SEBENARNYA tetap mengitari radius dekat dinding
  bebatuan tiap frame (posisinya pasti ter-update, bukan macet), tapi
  `scene.fog` (`FogExp2`) membuatnya memudar hampir menyatu dengan warna
  langit dari jarak ratusan unit — dari situ SEOLAH pesawatnya diam/tidak
  kelihatan. Diperbaiki dengan menambahkan `fog: false` di SEMUA material
  pesawat & baliho (badan, aksen sayap/ekor, baling-baling, tali, banner)
  — bagian-bagian ini sekarang selalu dirender dengan warna & kecerahan
  aslinya berapa pun jauhnya dari kamera, pola yang sama dengan
  `toneMapped: false` yang sudah dipakai banner foto/HAPPY BIRTHDAY.
  Sekalian, `buildAirplane()` dirombak jadi `buildOneAirplane()` +
  `buildAirplanes()` (SECTION 8B2) yang membangun **10 pesawat** sekaligus
  (`AIRPLANE_COUNT = 10`), masing-masing dapat radius orbit (0.55..0.885 ×
  `WORLD_HALF`, masih dekat dinding bebatuan batas dunia — tetap
  "mengitari batas bukit bebatuan" seperti permintaan awal, hanya sebagian
  ditarik sedikit lebih dekat supaya lebih gampang terlihat), ketinggian,
  kecepatan, arah putar (searah/berlawanan jarum jam bergantian), dan fase
  awal berbeda-beda (`updateAirplanes()`) — supaya ke-10 pesawat tidak
  bertabrakan satu sama lain dan gerakannya kelihatan jelas hidup, bukan
  satu formasi kaku. Tekstur baliho ("Selamat Ulang Tahun Sayang", sesuai
  permintaan user sebelumnya) dibuat SEKALI (`airplaneBannerTex`) lalu
  dipakai bersama oleh ke-10 banner lewat satu `bannerMat` yang sama —
  tidak perlu 10 canvas 2048×320 terpisah karena isinya identik.
- **Surat: "cantik/ganteng" → "cantik" saja**: baris `BIRTHDAY_LETTER_LINES`
  yang berbunyi "...makin cantik/ganteng..." diubah jadi "...makin
  cantik..." sesuai permintaan user (`BIRTHDAY_PERSON_NAME` memang orang
  spesifik, jadi kata sapaan gender-netral "cantik/ganteng" yang lama
  memang tidak relevan lagi).
- **Hewan, orang, & badut diperbanyak lagi**: `buildCityAnimals()` dan
  `buildCityPeople()` masing-masing dinaikkan lagi dari `COUNT = 110` jadi
  `COUNT = 200`, dan `buildCityClowns()` (yang sebelumnya tidak disebut
  user, tetap 10) sekarang ikut dinaikkan ke `COUNT = 30` karena kali ini
  disebut eksplisit. Semua tetap lewat `findClearRandomSpot()` yang sudah
  ada, otomatis menghindari lintasan/air/bangunan — dunia (`WORLD_HALF =
  320`) cukup luas untuk menampung total ~430 karakter tersebar tanpa
  perlu logic baru.

### 2026-09-21 — Pesawat baliho diperbesar & teksnya diganti; hewan & orang di kota diperbanyak jadi lebih ramai
Dua permintaan user:

- **Pesawat lebih besar, terbang mengitari batas bukit bebatuan, banner
  "Selamat Ulang Tahun Sayang"**: pesawat (`buildAirplane()`, SECTION 8B2)
  sebenarnya sejak iterasi sebelumnya SUDAH terbang melingkar di radius
  `WORLD_HALF*0.9` (dekat dinding bebatuan batas dunia) di ketinggian jauh
  di atas puncak tebing (~28 unit) — jadi "mengitari batas bukit bebatuan"
  tidak perlu logic baru, cukup dipertahankan. Yang diubah: ditambahkan
  konstanta `AIRPLANE_SCALE = 2.4` yang diterapkan sebagai `group.scale`
  di akhir `buildAirplane()` (bukan mengubah tiap ukuran geometry bagian
  per bagian) supaya seluruh bagian pesawat — badan, sayap, ekor, baliho,
  tali — membesar proporsional bersamaan tanpa risiko satu bagian jadi
  tidak sinkron dengan bagian lain. Ukuran plane baliho sendiri juga
  dinaikkan (26×4.1 → 34×5.6) sebelum ikut discale, supaya sebanding
  dengan badan pesawat yang sekarang jauh lebih besar. Ketinggian terbang
  (`updateAirplane`) dinaikkan sedikit (78 → 92 unit) supaya tetap terasa
  proporsional & jelas di atas tebing batas sekarang pesawatnya jauh lebih
  besar dari sebelumnya. Teks baliho (`makeAirplaneBannerTexture`) diganti
  dari "Selamat Ulang Tahun Sayangku" jadi **"Selamat Ulang Tahun Sayang"**
  persis sesuai permintaan user — tetap lewat `shrinkFontToFit()` yang
  sudah ada (lihat entri log banner terpotong sebelumnya) supaya teks baru
  ini pun dijamin muat di kanvas baliho apa pun font yang akhirnya dipakai
  browser.
- **Hewan & orang di kota diperbanyak jadi lebih ramai**: permintaan user
  memperbanyak isi tempat-tempat sepi di luar lintasan. `buildCityAnimals()`
  dan `buildCityPeople()` (SECTION 8B3) sama-sama dinaikkan dari `COUNT = 45`
  jadi `COUNT = 110` — keduanya sudah otomatis disebar lewat
  `findClearRandomSpot()` yang menghindari lintasan/air/bangunan, jadi
  cukup menaikkan angka `COUNT` tanpa perlu logic sebaran baru. Jumlah
  badut (`buildCityClowns`, 10) tidak diubah karena permintaan user hanya
  menyebut hewan & orang.

### 2026-09-21 — Kontrol mobile diganti dari D-pad (digital) jadi joystick analog
Permintaan user: kontroler kemudi di tampilan mobile (perangkat tanpa
keyboard fisik) diganti jadi analog. Sebelumnya kontrol sentuh berupa
D-pad 4 tombol (`#dpad`/`.dpad-btn`) yang murni digital — tiap tombol
cuma set `keys.forward/backward/left/right` ke `true`/`false`, jadi
belok/gas selalu penuh atau nol sama sekali, tidak ada nuansa di antara.

Diganti dengan satu **joystick analog virtual** (`#joystick` →
`#joystick-base` + `#joystick-knob`, style baru di `style.css`, media
query `@media (pointer: coarse)` yang sama dgn D-pad lama supaya tetap
cuma muncul di perangkat sentuh). Sumbu X knob jadi kemudi, sumbu Y knob
jadi gas/mundur, keduanya kontinu `-1..1` sebanding jarak knob ditarik
dari pusat (dijepit ke radius maksimum `MAX_RADIUS = 44px` kalau jari
ditarik lebih jauh dari itu).

Keputusan desain kunci — **keyboard TIDAK ikut diubah sama sekali**:
`keys.forward/backward/left/right` beserta listener `keydown`/`keyup`
dibiarkan persis seperti semula (tetap digital), supaya nol risiko
regresi di kontrol desktop yang sudah stabil. Sebagai gantinya,
`updatePhysics()` (SECTION 10) tidak lagi baca `keys` langsung, tapi
lewat dua fungsi baru `getThrottleAxis()`/`getSteerAxis()` (SECTION 13)
yang mengutamakan nilai joystick kalau `joystick.active` true, else jatuh
balik hitung dari `keys` seperti logic lama (`(keys.left?1:0) -
(keys.right?1:0)`, dst) — jadi input digital (keyboard) & analog
(joystick) hidup berdampingan lewat satu titik baca yang sama tanpa
saling konflik, dan `updatePhysics` sendiri cuma perlu diubah dari
if/else on-off jadi perkalian langsung dgn axis (`carState.speed +=
carState.accel * dt * throttleAxis`) supaya jalan analog beneran
proporsional saat dari joystick, tapi hasilnya identik dgn perilaku lama
saat axis-nya kebetulan cuma -1/0/1 (dari keyboard).

Drag joystick ditangani pakai **Pointer Events** (`pointerdown`/
`pointermove`/`pointerup`/`pointercancel` + `setPointerCapture`) alih-
alih pasangan `touchstart`/`touchend` + `mousedown`/`mouseup` terpisah
seperti D-pad lama — satu set listener otomatis menangani sentuhan HP
maupun drag mouse (berguna saat tes lewat device-toolbar desktop
browser), dan `setPointerCapture` menjamin drag tetap terlacak walau
jari meleset keluar lingkaran `#joystick-base` saat ditarik jauh
(penting utk kontrol joystick — beda dgn tombol D-pad lama yang cukup
event per-tombol, tanpa perlu drag-tracking sama sekali). `#joystick-knob`
diberi `pointer-events: none` supaya listener yang dipasang di
`#joystick-base` tetap menerima event walau jari menyentuh knob (bukan
area base) secara visual.

### 2026-09-21 — Konteks nama yang ulang tahun ditambahkan (`BIRTHDAY_PERSON_NAME`)
Permintaan user: tambahkan konteks bahwa nama yang berulang tahun adalah
**Gabriela Oktaviany Sihaloho**. Sebelumnya proyek ini sama sekali tidak
menyimpan nama — surat & judul cuma pakai sapaan generik "sayang".
Ditambahkan satu konstanta baru `BIRTHDAY_PERSON_NAME` di SECTION 0
(dekat `LOCK_PASSWORD`/`BIRTHDAY_LETTER_LINES`, mengikuti pola "konten
sebagai konstanta yang gampang diganti" yang sudah dipakai di seluruh
proyek), lalu dipakai di dua tempat: baris pembuka
`BIRTHDAY_LETTER_LINES[0]` (template string, bukan hardcode ulang) dan
judul surat `#birthday-title` — yang terakhir ini sebelumnya teks statis
langsung di `index.html`, sekarang diisi dinamis lewat
`populateBirthdayLetter()` supaya kontennya tetap terpusat di satu tempat
(`script.js`), konsisten dengan alasan `BIRTHDAY_LETTER_LINES` sendiri
sudah dipisah dari markup (lihat entri log 2026-07-31 "surat lucu" di
bawah). `<title>` di `index.html` juga disesuaikan jadi "...— untuk
Gabriela" sebagai penanda cepat di tab browser, cukup nama depan supaya
tab title tidak kepanjangan.

### 2026-09-21 — Hamparan bunga diubah dari sebaran acak jadi membentuk tulisan "SELAMAT ULANG TAHUN SAYANG"
Permintaan user lanjutan setelah fitur hamparan bunga (entri log di bawah
ini) sudah ada: bunga-bunganya diubah supaya BENTUK hamparannya sendiri
membentuk tulisan "Selamat Ulang Tahun Sayang", bukan cuma tersebar acak
dalam petak bundar. Ditambahkan `FLOWER_FONT_5X7` — font bitmap 5x7 piksel
buatan sendiri (bukan font/model eksternal, konsisten dengan batasan
proyek "semua objek dari geometry primitif" yang sama dipakai tanda huruf
3D landmark, entri log 2026-07-31) — hanya berisi 11 huruf yang benar-benar
dipakai (S, E, L, A, M, T, U, N, G, H, Y).

Teks disusun 3 baris ("SELAMAT" / "ULANG TAHUN" / "SAYANG",
`FLOWER_TEXT_LINES`) alih-alih 1 baris panjang — satu baris "SELAMAT ULANG
TAHUN SAYANG" penuh akan menghasilkan kotak tulisan terlalu lebar (>250
unit), butuh radius pencarian titik jangkar yang sangat besar lewat
`findClearRandomSpot()` sehingga jarang/sulit menemukan area kosong yang
cukup luas di dunia (`WORLD_HALF = 320`); 3 baris menekan lebar kotak
tulisan ke ~100 unit (radius pencarian ~61 unit, sudah termasuk margin) —
jauh lebih realistis ketemu tempat kosong.

`layoutFlowerTextGrid()` mengubah tiap baris jadi grid sel "menyala/mati"
(memakai lebar baris terlebar sebagai acuan supaya baris yang lebih
pendek otomatis dipusatkan), lalu `buildFlowerTextPositions()` mengubah
tiap sel yang menyala jadi satu bunga individual di koordinat dunia
(dengan jitter kecil `±0.28` sel supaya tetap terasa "kebun bunga asli",
bukan grid piksel kaku), dan `findClearRandomSpot()` dipanggil dengan
radius = setengah diagonal kotak tulisan + margin (bukan cuma radius
kecil seperti petak lama) supaya SELURUH kotak tulisan terjamin bebas
dari lintasan/air/bangunan, bukan cuma titik tengahnya. Kalau pencarian
pertama gagal (dunia kebetulan padat), dicoba ulang sekali lagi dengan
radius diperkecil (70%) — kalau tetap gagal, tulisan cukup dilewati tanpa
error, petak aksen di bawah tetap jalan seperti biasa (graceful fallback,
bukan crash).

Jumlah petak bunga ACAK di luar tulisan dikurangi dari 6 jadi 3
(`FLOWER_ACCENT_PATCH_COUNT`, sebelumnya `FLOWER_PATCH_COUNT`) karena
tulisan sekarang jadi fokus visual utama hamparan bunga — 6 petak acak +
tulisan penuh dinilai bakal membuat area sekitar tulisan terlalu ramai
dan mengaburkan keterbacaan tulisannya sendiri. Warna kepala bunga di
tulisan memakai palet baru `FLOWER_TEXT_HEAD_COLORS` (didominasi pink &
putih) alih-alih palet 7 warna penuh punya petak acak, supaya kontras &
keterbacaan bentuk hurufnya lebih tinggi dari jarak jauh/saat berkendara.
Render tetap lewat 3 `InstancedMesh` yang sama seperti sebelumnya (batang,
kepala bulat, kepala bintang) — tulisan sebesar apa pun (363 bunga untuk
teks lengkap) tetap cuma nambah jumlah instance, bukan draw call baru.

### 2026-09-21 — Hamparan bunga ditambahkan di area-area kosong dunia
Permintaan user: isi area yang masih kosong di dunia dengan hamparan
bunga. Ditambahkan SECTION 8F baru (`buildFlowerFields()`, konstanta
`FLOWER_*`) — 6 "petak" bunga disebar lewat `findClearRandomSpot()`,
konvensi yang sama dipakai `buildBigBuildings`/`buildTugus`/
`buildCuteStatues`/dsb di atas, jadi otomatis menghindari lintasan, air,
& bangunan/dekorasi lain tanpa logic baru. Tiap petak berisi 70-110 bunga
individual (batang hijau + kepala bulat ATAU kepala segi bentuk bintang,
warna acak dari palet pastel), tersebar merata dalam lingkaran radius 8
unit di sekitar titik petak (pakai distribusi `sqrt(random())` supaya
rata per luas, bukan menumpuk di tengah).

Radius petak (8 unit) sengaja dijaga di bawah jarak aman minimum yang
dijamin `findClearRandomSpot` terhadap lintasan (>=16 unit dari titik ke
as jalan, terlepas dari parameter margin yang dikirim — lihat kode
`findClearRandomSpot` di SECTION 3) dikurangi `TRACK_HALF_WIDTH` (7),
supaya bunga di tepi petak yang paling dekat lintasan pun dijamin
matematis tidak pernah menembus aspal, bukan cuma "biasanya aman".

Performa: SEMUA bunga di SEMUA petak (bisa ratusan) dirender lewat cuma 3
`InstancedMesh` (satu utk batang, satu utk kepala bulat, satu utk kepala
bintang) — bukan `THREE.Group` per bunga seperti NPC/hewan di atas —
supaya cuma 1 draw call per jenis bagian, persis pendekatan yang sudah
dipakai `buildBoundaryWalls()` utk ratusan batu. Warna kepala per-instance
lewat `InstancedMesh.setColorAt`. Bunga SENGAJA tidak diberi collider
sama sekali (bunga rumput kecil, bukan penghalang solid) — mobil bebas
melintasi hamparannya, alasannya sama dengan kenapa pohon latar massal
dulu tidak diberi collider individual.

### 2026-09-21 — Tulisan "HAPPY BIRTHDAY" di monumen terpotong di kedua ujung — akar masalah ketemu, sekalian diperbaiki di baliho pesawat
User melaporkan tulisan banner "HAPPY BIRTHDAY" di monumen finish
terlihat terpotong. Akar masalah: `makeColorfulTextTexture()` mengunci
font-size mati di 260px tanpa pengecekan lebar sama sekali terhadap
kanvas 2048px. Diverifikasi dengan mengukur lebar teks sungguhan pakai
font 'Baloo 2' asli (bukan cuma dugaan dari baca kode): `style.css` cuma
meng-`@import` weight 500 & 700 dari Google Fonts, padahal kode minta
`font-weight: 900` — browser sebenarnya jatuh ke wajah 700 (+sintesis
bold) untuk merender teksnya. Pada weight 700, lebar "HAPPY BIRTHDAY" di
260px sudah ~2008px, nyaris pas 2048px TANPA sisa margin sama sekali.
Lebih parah lagi: font 'Baloo 2' dimuat dari jaringan (Google Fonts) —
kalau `index.html` dibuka offline lewat `file://` (cara pakai utama
proyek ini, lihat bagian Cara Pakai) atau font-nya telat/gagal dimuat,
browser diam-diam jatuh ke fallback `sans-serif` bawaan yang JAUH lebih
lebar (diuji pakai DejaVu Sans Bold sbg pembanding: ~2537px, meluber
~490px dari kanvas) — skenario yang bikin tulisannya kepotong parah di
KEDUA ujung, persis yang dilaporkan user.

Diperbaiki dengan utilitas baru `shrinkFontToFit()` (dekat
`makeBannerTexture`, SECTION 4): mengecilkan font-size bertahap sampai
lebar teks terukur pasti muat dalam kanvas dengan margin aman (~6-12%),
berapa pun panjang teksnya & font apa pun yang akhirnya benar-benar
dipakai browser. Diterapkan ke `makeColorfulTextTexture()` (banner HAPPY
BIRTHDAY) DAN `makeAirplaneBannerTexture()` (baliho pesawat "Selamat
Ulang Tahun Sayangku", SECTION 8B2) — yang disebut terakhir ternyata
punya kelemahan identik (~2101px di font tetap 150px vs kanvas 2048px)
walau belum sempat dilaporkan user; sekalian diperbaiki dengan fix yang
sama supaya tidak muncul sebagai bug terpisah nanti. Diverifikasi lewat
simulasi numerik lebar teks (font Baloo 2 asli & fallback sans-serif,
sebelum & sesudah perbaikan) — keduanya sekarang pasti muat dengan
margin aman.

### 2026-08-19 (lanjutan 6) — Mobil diganti gaya "microcar retro" hijau mint sesuai foto referensi user
`buildCar()` dirombak total mengikuti 3 foto referensi (mobil retro
mungil hijau mint/teal dengan banyak aksen krom): warna bodi diganti dari
pink ke hijau mint (`0x3fcdb6`), bumper depan/belakang & rocker panel
diganti jadi KROM (bukan warna bodi lagi), ditambahkan spatbor bulat
menonjol di keempat roda (kesan mobil "gembul" retro), ventilasi/louver
samping di spatbor depan, lampu depan bulat besar menonjol dibingkai
cincin krom + lampu sein oranye kecil di bawahnya, lampu belakang bulat
merah dibingkai krom, spion bulat krom di tiang tipis (menggantikan
spion kotak sebelumnya), list krom di tepi atap, dan interior jok tan/
coklat + setir kecil yang terlihat sekilas dari balik kaca. Racing stripe
tengah (gaya Mini Cooper versi sebelumnya) dihapus karena tidak ada di
referensi. Proporsi/ukuran dasar bodi (2.6×1.0×4.2) sengaja TIDAK diubah
supaya tetap selaras dengan fisika, koridor lintasan, dan tuning chase
cam yang sudah ada — cuma tampilan visualnya yang diganti total.

### 2026-08-19 (lanjutan 5) — Monumen dirombak jadi ISTANA LEBAR, bukan menara tinggi — dan tidak lagi bertumpuk dengan gapura lama
Permintaan user: monumen jadi gedung megah yang LEBAR (bukan tinggi) dan
unik sendiri dibanding gedung-gedung lain. Menara 4-tingkat setinggi 82
unit dari iterasi sebelumnya dihapus total, diganti **istana lebar**:
rotunda bundar besar (radius 15 unit, tinggi cuma 13 unit — sengaja jauh
lebih lebar daripada tinggi), dikelilingi 16 pilar besar & 16 jendela
melingkar, kubah raksasa di tengah sebagai pusat perhatian (bukan menara
tunggal menjulang), 4 menara kecil di penjuru dengan lampion emissive di
puncaknya, serta pita+bow raksasa ala kado ulang tahun. Bentuknya sengaja
dibuat SANGAT berbeda dari 30 "gedung besar" kotak biasa di kota — supaya
langsung kelihatan ini bangunan spesial begitu terlihat dari kejauhan.

Sekaligus diperbaiki masalah tumpang-tindih yang baru ketahuan saat
merancang ulang: gapura gazebo kecil versi lama (10 pilar + kubah kecil +
bunting) yang SEBELUMNYA masih ada di titik yang sama persis dengan
menara tinggi (dan kalau dibiarkan, juga akan bertumpuk aneh dengan
istana baru) — dihapus total, karena perannya sudah sepenuhnya digantikan
istana. Posisi kue, balon mengambang, dan kerumunan orang-orang juga
disesuaikan ulang (radiusnya digeser ke luar ~19+ unit dari pusat) supaya
tidak lagi "terkubur" di dalam badan istana yang sekarang solid — di
desain lama posisinya dihitung relatif ke gapura kecil yang sudah
dihapus, jadi otomatis perlu diselaraskan ke skala istana yang baru.

### 2026-08-19 (lanjutan 4) — Gedung dilebarkan & diwarnai, orang jadi humanoid, pesawat terbang di atas tebing batas, kota diramaikan
Empat pembaruan sesuai permintaan user setelah screenshot menunjukkan
gedung masih terasa kurang berwarna & terlalu menjulang, orang-orang masih
terlalu abstrak, dan kota terasa sepi di luar area monumen:

- **Gedung dilebarkan, bukan ditinggikan, & lebih warna-warni**:
  `buildBigBuilding()` — lebar/dalam dinaikkan dari 8-14 ke 15-26 unit,
  tinggi diturunkan dari 20-50 ke 9-22 unit (sekarang jelas terlihat
  LEBAR, bukan menjulang). Palet warna badan diganti ke varian jauh lebih
  jenuh/pekat (mis. `0xff4fa0`, `0x8a4fe0`, `0x1fbf8f`), dan yang tadinya
  cuma aksen putih polos (jendela, garis lantai, atap) sekarang semua
  pakai warna aksen kedua yang juga diacak per gedung — kesan gedung jauh
  lebih hidup & warna-warni.
- **Karakter orang jadi humanoid yang jelas**: fungsi `buildPersonNPC()`
  baru (dipakai bersama di banyak tempat) menggantikan model lama yang
  cuma kerucut+silinder tanpa kaki — sekarang punya kaki + sepatu, badan/
  baju silinder, leher, kepala bulat + rambut (warna acak), lengan +
  tangan bulat kecil, proporsi lebih jelas menyerupai figur manusia mini.
- **Pesawat+baliho terbang di atas tebing batas**: radius terbang
  (`updateAirplane`) dibesarkan dari `WORLD_HALF*0.55` ke `WORLD_HALF*0.9`
  (mendekati dinding bebatuan batas dunia, bukan cuma muter di tengah
  peta), ketinggian dinaikkan ke ~78 unit (jelas di atas puncak tebing
  yang paling tinggi ~28 unit) — sekarang pesawat+baliho kelihatan
  melintas persis di atas garis pegunungan batas dari hampir semua titik.
- **Kota diramaikan di luar lintasan**: `SECTION 8B3` baru — 45 orang
  (`buildCityPeople`), 10 badut tambahan (`buildCityClowns`, di luar 3
  badut yang sudah ada di monumen), dan 45 hewan lucu (`buildCityAnimals`
  — campuran anjing/capybara/kucing sederhana, `buildDog`/`buildCapybara`/
  `buildCat`) tersebar acak lewat `findClearRandomSpot()` (otomatis
  menghindari lintasan). Hewan-hewan ini jalan pelan bolak-balik lewat
  `updateAnimals()`.

Sekalian diperbaiki bug tulisan "HAPPY BIRTHDAY" yang terlihat tercermin
dari sisi belakang di screenshot — bannernya sebelumnya satu plane
`DoubleSide` (yang sisi belakangnya memang selalu tercermin di WebGL),
diganti dua mesh terpisah (depan & belakang) memakai texture yang sama,
persis pola perbaikan yang sudah terbukti bekerja di billboard foto.

### 2026-08-19 (lanjutan 3) — Banner FINISH diperbesar, badut & pesawat baliho, tikungan lebih mulus, monumen jadi gedung tinggi megah + kerumunan orang
Lima pembaruan besar sesuai permintaan user:

- **Tulisan "HAPPY BIRTHDAY" diperbesar drastis**: plane banner dari 17×3.6
  jadi 32×7.2, resolusi canvas texture dinaikkan (1024×256 → 2048×460,
  font 130px → 260px) supaya tetap tajam di ukuran sebesar itu. Material
  banner ini juga diganti `MeshBasicMaterial` (unlit) — konsisten dengan
  perbaikan billboard foto — supaya tulisannya selalu terang & jelas
  apa pun arah cahaya mataharinya.
- **Karakter badut**: `buildClown()`/`buildClowns()` (3 badut, tersebar di
  sekitar monumen) — badan kerucut belang dua warna, kepala + rambut warna-
  warni + topi kecil + hidung bulat merah emissive, sepatu besar. Animasi
  idle lewat `updateClowns()`: badan mantul-mantul, kepala miring pelan,
  satu lengan melambai terus-menerus.
- **Pesawat + baliho ucapan**: `buildAirplane()` — pesawat kecil (badan +
  sayap + ekor + baling-baling berputar) menarik baliho besar bertuliskan
  "Selamat Ulang Tahun Sayangku" (`makeAirplaneBannerTexture()`, canvas
  2048×320) lewat "tali" pendek. Terbang melingkar tinggi di atas seluruh
  dunia (`updateAirplane()`, radius `WORLD_HALF*0.55`, ketinggian ~56-68
  unit berosilasi pelan) supaya kelihatan dari hampir semua titik lintasan.
- **Tikungan lintasan lebih mulus**: `TRACK_ARC_STEPS` dinaikkan drastis
  dari 16 ke 40 — baik tikungan kanan (setengah lingkaran penuh) maupun
  tikungan kiri (menuju finish) jadi didekati dengan jauh lebih banyak
  segmen pendek, hasilnya melengkung mulus alih-alih terlihat patah-patah
  bersudut. Penempatan curb ikut otomatis menyesuaikan (lebih rapat,
  masih tidak tumpang tindih).
- **Monumen jadi gedung tinggi megah + kerumunan orang**: ditambahkan
  menara 4-tingkat setinggi 82 unit (jauh lebih tinggi dari 30 "gedung
  besar" biasa yang cuma 20-50 unit) di tengah plaza — tiap tingkat warna
  pastel beda, pita pemisah putih, jendela melingkar, puncak ala cupcake
  topper raksasa bercahaya, dan spiral titik-titik warna-warni melilit
  badan menara (kesan kawaii). Gapura/kue/balon/banner yang sudah ada
  sebelumnya tetap dipertahankan sebagai dekorasi di sekelilingnya, bukan
  diganti. Ditambahkan juga 24 karakter "orang" (`crowdPeople`) tersebar
  di plaza — badan kerucut+silinder, kepala bulat, dua lengan, warna
  pakaian & kulit bervariasi acak — dengan idle bob halus lewat
  `updateLandmarkAnimations()`.

### 2026-08-19 (lanjutan 2) — Akar masalah "banner hitam" SESUNGGUHNYA ketemu: foto di-embed langsung; kartu ikut bergeser saat tombol malas kabur; gaya tombol dibedakan lagi
Tiga laporan lanjutan dari user setelah pengujian:

- **Banner masih hitam total (bukan placeholder lagi)**: dua percobaan
  sebelumnya (unset `crossOrigin`, lalu ganti ke pemuatan manual via
  `Image()`) ternyata masih belum menyentuh akar masalah SESUNGGUHNYA.
  Faktanya: gambar lokal lewat `file://` BISA berhasil dimuat sebagai
  elemen `<img>` biasa (event `onload` terpicu normal, `naturalWidth`/
  `naturalHeight` valid), TAPI begitu dipakai sebagai TEKSTUR WEBGL,
  banyak kombinasi browser tetap menganggapnya "tainted" (setiap file
  `file://` diperlakukan sebagai origin uniknya sendiri-sendiri oleh
  sebagian browser, walau sama-sama dibuka dari folder yang sama) —
  kegagalannya terjadi DIAM-DIAM di level upload GPU, BUKAN di event
  `onload`/`onerror` biasa, jadi tidak ada satu pun pengecekan JS
  sinkron yang bisa menangkapnya sebelum kejadian. Ini penyebab sesungguhnya
  kenapa dua perbaikan sebelumnya (yang sama-sama fokus di level
  loading gambar, bukan level upload tekstur) tidak pernah benar-benar
  menyelesaikannya.

  Solusi yang benar-benar dijamin bekerja: foto dummy sekarang di-**embed
  langsung sebagai data URI base64** di file baru `assets/photos-embedded.js`
  (dimuat sebagai `<script>` terpisah sebelum `script.js`, isinya cuma
  objek `EMBEDDED_PHOTOS` berisi 10 foto hewan dummy). Data URI TIDAK
  PERNAH punya masalah tainted-canvas/CORS sama sekali di WebGL — jadi
  dijamin tampil di kondisi apa pun, termasuk dobel-klik langsung tanpa
  server. `buildPhotoGate()` disederhanakan untuk memakai `EMBEDDED_PHOTOS`
  langsung, `loadLocalPhotoTexture()` (pemuatan file eksternal yang
  ternyata tidak bisa diandalkan) dihapus total dari kode.

  **Konsekuensi bagi user yang ingin pakai foto asli**: karena sekarang
  sumber utamanya adalah data yang di-embed (bukan file yang dibaca ulang
  tiap kali dibuka), sekadar menimpa file `assets/photos/foto-N.jpg` TIDAK
  akan otomatis berubah lagi di gapura foto. Ini didokumentasikan di
  `assets/photos/README.txt` beserta dua opsi: (1) jalankan server lokal
  sederhana (`python3 -m http.server` dari folder proyek) lalu pemuatan
  file eksternal-nya akan cukup andal tanpa masalah CORS, atau
  (2) generate ulang `assets/photos-embedded.js` dari foto-foto baru
  (butuh sedikit scripting Python, base64-encode tiap file jadi data URI).

- **Kartu ikut bergeser (jarak input↔tombol berubah) saat tombol malas
  kabur**: begitu KEDUA tombol dikonversi ke `position: fixed`,
  `.lock-btn-row` jadi kosong (tidak ada child yang masih ikut flow) dan
  tingginya kolaps ke 0 — kartu jadi lebih pendek, elemen di atasnya
  (input password) ikut bergeser mendekati posisi tombol yang sudah fixed.
  Diperbaiki dengan mengunci tinggi `.lock-btn-row` (`row.style.height`)
  ke tinggi aslinya TEPAT SEBELUM kedua tombol dilepas dari flow, di
  `escapeToFixed()` — jadi sisa layout kartu (termasuk jarak ke input
  password) sama sekali tidak berubah, apa pun yang terjadi pada tombol
  malas.

- **Gaya tombol malas dibedakan lagi dari "Buka Gerbang"**: permintaan
  user membalik keputusan penyeragaman gaya sebelumnya. `#dodge-btn`
  sekarang punya tampilan sendiri (putih dengan garis tepi mint, teks
  gelap) yang jelas berbeda dari `#lock-submit` (gradasi solid pink-
  lavender, teks putih) — supaya sekilas pandang langsung kelihatan mana
  tombol "jahil" dan mana tombol sungguhan untuk buka gerbang.

### 2026-08-19 (lanjutan lagi) — Jarak input↔tombol ditambah lagi, banner foto masih hitam total — diperkeras dengan 3 lapis pengaman
Screenshot terbaru user menunjukkan: (1) jarak input password ke tombol
masih terasa mepet meski sudah dinaikkan ke 22px, dan (2) banner gapura
foto sekarang malah tampil HITAM TOTAL (bukan lagi placeholder pastel
seperti laporan paling awal) — artinya perbaikan `MeshBasicMaterial` +
loader manual sebelumnya belum menuntaskan masalahnya, malah placeholder-
nya sendiri yang jadi tidak muncul.

- **Jarak input↔tombol**: `margin-bottom` pada `#lock-input` dinaikkan
  lagi dari 22px ke 34px, supaya gap-nya jelas terlihat.
- **Banner foto hitam total — diperkeras 3 lapis**: dugaan paling
  mungkin — `img.onload` browser kadang tetap terpanggil walau gambarnya
  sebenarnya gagal/kosong (mis. diam-diam diblokir), lalu kode lama
  langsung menganggapnya berhasil dan MENIMPA placeholder yang tadinya
  baik-baik saja dengan tekstur rusak (yang di-render sebagai kotak hitam
  polos). Diperkeras dengan tiga lapis pengaman sekaligus supaya tidak
  bisa lolos dari salah satu penyebab yang mungkin: (1) `loadLocalPhotoTexture()`
  sekarang mengecek `img.naturalWidth`/`naturalHeight` dulu — kalau 0,
  dianggap GAGAL (panggil `onError`, JANGAN timpa placeholder); (2) kedua
  material foto (`photoMatFront`/`photoMatBack`) diberi `color: 0xffffff`
  eksplisit sebagai pengaman warna; (3) `toneMapped: false` diset di kedua
  material itu, supaya warna banner (baik placeholder maupun foto asli)
  dirender APA ADANYA — sama sekali tidak melewati kurva tone-mapping
  ACES/exposure scene yang dipakai objek 3D lain, jadi tidak akan pernah
  ikut "tergelapkan" walau exposure scene diturunkan lagi di masa depan.

### 2026-08-19 (lanjutan) — "Buka Gerbang" masih berpindah & foto masih tidak muncul (banner hitam) — akar masalah SESUNGGUHNYA, diperbaiki tuntas
User menguji hasil perbaikan sebelumnya dan melaporkan keduanya masih
bermasalah. Ternyata perbaikan sebelumnya belum menyentuh akar masalah
sesungguhnya untuk dua-duanya:

- **"Buka Gerbang" masih berpindah**: perbaikan sebelumnya cuma mengunci
  LEBAR-nya (`flex: none` + `width` eksplisit) tapi TETAP membiarkannya di
  dalam `.lock-btn-row`. Begitu tombol malas (satu-satunya sibling) lepas
  dari flow, "Buka Gerbang" yang tersisa sendirian tetap ikut BERGESER ke
  posisi flex-start (kiri) walau ukurannya sudah tidak berubah — cuma
  separuh masalah yang kebetulan ke-fix. Sekarang di `escapeToFixed()`,
  KEDUA tombol diukur bersamaan lalu KEDUANYA dijadikan `position: fixed`
  di koordinat persis itu (bukan cuma dikunci ukurannya di dalam flex row)
  — "Buka Gerbang" sekarang benar-benar lepas dari flex layout sepenuhnya,
  jadi tidak mungkin lagi bergeser apa pun yang terjadi pada tombol malas.
- **Foto masih tidak muncul (kini "banner hitam")**: dugaan sebelumnya
  (cuma soal `crossOrigin` di `THREE.TextureLoader`) ternyata belum cukup.
  Diganti total dengan `loadLocalPhotoTexture()` — pemuatan manual pakai
  elemen `<img>` milik sendiri yang SAMA SEKALI tidak pernah menyentuh
  properti `.crossOrigin` (bukan di-unset, tapi memang tidak pernah ada
  kode yang menyentuhnya), persis seperti `<img src="...">` biasa di HTML,
  supaya file lokal lewat `file://` dijamin bisa dimuat browser tanpa
  terjegal pemeriksaan CORS apa pun. Material foto (`photoMatFront`/
  `photoMatBack`) juga diganti dari `MeshStandardMaterial` ke
  `MeshBasicMaterial` — banner sekarang SELALU terang & jelas terlihat
  apa adanya (warna asli foto/placeholder), tidak bergantung arah cahaya
  matahari sama sekali. Ini juga otomatis menutup kemungkinan "banner
  hitam" terulang di masa depan kalau pencahayaan scene diubah lagi,
  karena billboard foto memang sewajarnya tidak perlu ikut sistem
  pencahayaan 3D seperti objek lain.

File-file foto sisa dari sistem lama (billboard rute lama & Monumen Foto
yang sudah dihapus di iterasi-iterasi sebelumnya — `kota-1.jpg`,
`kenangan-1.jpg`, `foto-11.jpg` s/d `foto-30.jpg`, dst) juga dibersihkan
dari `assets/photos/`, sisa 10 file (`foto-1.jpg` s/d `foto-10.jpg`) yang
memang dipakai `TOTAL_PHOTO_COUNT`.

### 2026-08-19 — Foto asli tidak pernah muncul (akar masalah ketemu), spasi & ukuran tombol layar kunci, kontras warna dunia dinaikkan
Empat perbaikan sesuai laporan user:

- **Foto dummy tidak muncul (akar masalah)**: `THREE.TextureLoader` bawaan
  (lewat kelas dasar `Loader`) otomatis men-set `crossOrigin = 'anonymous'`
  pada elemen `<img>` yang dipakainya. Untuk halaman yang dibuka via
  `file://` (dobel-klik, tanpa server), ini membuat browser diam-diam
  menolak memuat gambar lokal — jatuh ke placeholder terus-menerus tanpa
  error yang terlihat. Ini SUDAH menjadi masalah sejak sistem foto pertama
  kali dibuat, cuma baru ketahuan sekarang. Diperbaiki dengan
  `photoTextureLoader` (satu instance `TextureLoader` bersama, dipakai di
  `buildPhotoGate()`) yang `crossOrigin`-nya sengaja di-set `undefined`
  (bukan string kosong — string kosong tetap dianggap "anonymous" oleh
  browser).
- **Jarak input password ↔ tombol**: `margin-bottom` pada `#lock-input`
  dinaikkan dari 14px ke 22px.
- **Ukuran "Buka Gerbang" tidak berubah lagi**: sebelumnya cuma tombol
  malas yang "dikunci" saat kabur; ternyata itu membuat "Buka Gerbang"
  (flex:1, tersisa sendirian di baris) ikut melebar mengisi ruang kosong.
  Sekarang `escapeToFixed()` juga mengunci lebar `#lock-submit`
  (`flex:none` + width eksplisit) TEPAT SEBELUM tombol malas dilepas dari
  flex row, diukur di saat yang sama — jadi "Buka Gerbang" benar-benar
  tidak berubah ukuran apa pun yang terjadi pada tombol malas.
- **Kontras warna dunia dinaikkan**: `PALETTE.ground/road/water` diperdalam
  (mis. tanah dari `0xa6e6c3` ke `0x74d69e`), palet warna gedung besar
  diganti ke varian lebih pekat (`0xff8fc0, 0xa67cf0, 0x4fd6a8, ...`),
  serta `toneMappingExposure` diturunkan lagi (0.78→0.68) dan
  ambient/hemisphere/fill light ikut diturunkan — kombinasi ini membuat
  warna dunia jauh lebih jelas beda satu sama lain, bukan pudar/mirip
  putih semua seperti sebelumnya.

### 2026-08-19 — Monumen Foto diganti gapura foto di atas jalan; tombol layar kunci disamakan gayanya
Dua perubahan sesuai permintaan user:

- **Monumen Foto → gapura foto di jalan**: sistem pedestal-di-luar-lintasan
  (`buildPhotoMonument`, `buildPhotoMonuments`, `findMonumentSpot`,
  `photoMonumentSpots`) dihapus total, diganti `buildPhotoGate()` —
  gapura dua tiang persis gaya `buildRaceGate()` (START/FINISH), tapi
  bannernya jauh lebih besar (17×5.4 vs 12.8×3.2) dan menampilkan FOTO
  (lewat `PHOTO_FILENAMES`) alih-alih teks. `buildPhotoGates()`
  menyebarnya merata di SEPANJANG `TRACK_WAYPOINTS` (pola distribusi sama
  seperti sistem billboard rute yang lama), jadi mobil melintas TEPAT DI
  BAWAH tiap gapura foto selama perjalanan ke FINISH — bukan lagi harus
  disambangi satu-satu di luar lintasan. Foto dipasang di KEDUA sisi
  banner lewat dua mesh terpisah (bukan cuma `DoubleSide`) supaya tidak
  ada foto yang tampil tercermin dari arah manapun mobil datang — pelajaran
  dari bug teks gerbang terbalik sebelumnya. `distanceToTrack()` tetap
  dipertahankan karena masih dipakai `findClearRandomSpot()` untuk
  gedung/tugu/patung.
- **Gaya tombol layar kunci disamakan**: `#lock-submit` dan `#dodge-btn`
  sebelumnya punya tampilan berbeda (submit gradasi pink-lavender solid,
  dodge putih transparan berbingkai). Sekarang keduanya memakai satu rule
  CSS gabungan (gradasi, padding, radius, shadow, font yang sama persis) —
  tetap dua tombol terpisah berdampingan kiri-kanan dengan fungsi masing-
  masing (kiri: kabur-kaburan jahil; kanan: buka gerbang sungguhan), cuma
  tampilannya sekarang serasi sebagai satu pasang tombol.

### 2026-08-19 — 30 gedung besar & estetik (ganti 14 rumah kecil), monumen finish makin mewah, foto dummy jadi bertema hewan
Tiga perubahan sesuai permintaan user:

- **Gedung besar & estetik**: `buildLittleHouse(s)` (14 rumah kecil) dihapus
  total, diganti `buildBigBuilding(s)` — 30 menara besar (tinggi 20-50 unit,
  jauh lebih besar dari rumah sebelumnya) dengan panel jendela kaca depan-
  belakang, garis lantai horizontal tipis (kesan gedung berlantai-lantai),
  atap/topi kontras putih, dan sebagian dapat aksen antena/spire di puncak
  buat variasi siluet. Warna badan tetap palet pastel, tapi proporsinya
  jauh lebih "estetik ala gedung kota" ketimbang rumah kecil bergaya desa.
- **Monumen finish lebih mewah** (mengacu referensi gambar user): ditambah
  **pelangi besar** 4-lapis (`rainbowGroup`) di belakang gapura, **8 pohon
  cemara pink** bertingkat 3 mengelilingi plaza, dan **2 buket balon di
  atas tongkat** (7 balon per buket) di dekat pintu masuk — selain 32 balon
  mengambang yang sudah ada. Banner "HAPPY BIRTHDAY" yang tadinya satu
  warna solid diganti `makeColorfulTextTexture()` — tiap huruf otomatis
  dapat warna berbeda (pink/kuning/putih/biru/ungu bergantian) via canvas,
  meniru gaya teks warna-warni di gambar referensi, tanpa perlu font/model
  eksternal.
- **Foto dummy diganti tema hewan**: 10 foto dummy generik sebelumnya
  diganti ilustrasi wajah hewan sederhana (kucing, anjing, kelinci,
  beruang, panda, rubah, gajah, jerapah, bebek, burung hantu) — digambar
  procedural pakai PIL (lingkaran untuk wajah/telinga/mata/pipi), disimpan
  sebagai `foto-1.jpg` s/d `foto-10.jpg` di `assets/photos/`, dipakai oleh
  sistem Monumen Foto yang sudah ada (`TOTAL_PHOTO_COUNT` tidak berubah,
  masih 10 — cuma isinya yang diganti).

### 2026-07-31 — Dekorasi "alam" diganti bangunan, tugu, & patung lucu
Permintaan user: hapus dekorasi lucu di luar lintasan sebelumnya (jamur,
semak permen-warna, hati/bintang melayang, pelangi), ganti dengan
bangunan/rumah-rumah, tugu, patung, dan sejenisnya. `SECTION 8E` dirombak:
seluruh fungsi dekorasi "alam" (`buildMushroom*`, `buildGumdropBush*`,
`buildRainbow*`, `buildFloatingHeart/Star`, `buildFloatingCuteObjects`,
`updateFloatingCuteObjects`, `floatingCuteList`) dihapus total, diganti:

- **Rumah kecil** (`buildLittleHouse`, 14 buah) — badan kotak + atap
  limas, pintu, dua jendela, cerobong asap, warna dinding/atap pastel acak.
- **Tugu** (`buildTugu`, 5 buah) — dasar 3 tingkat (kotak menyusut ke
  atas) + obelisk segi-4 meruncing + bola dekoratif emissive di puncak.
- **Patung kucing duduk** (`buildCuteStatue`, 8 buah) — pedestal bundar +
  badan & kepala dari bola, telinga kerucut, ekor melengkung, warna solid
  ala bahan patung (marmer/perunggu pastel).

Semua tetap disebar lewat `findClearRandomSpot()` yang sudah otomatis
menghindari lintasan, dan masing-masing dapat rect collider (`addRectCollider`)
supaya mobil tidak bisa menembusnya. Awan & burung di langit dari iterasi
sebelumnya (`buildClouds`/`buildBirds`) TIDAK diikutkan penghapusan —
tetap dipertahankan karena permintaan user cuma soal dekorasi darat.

### 2026-07-31 — Tombol layar kunci masih tidak rapi — didesain ulang total (bukan sekadar tambal lagi)
Screenshot terbaru menunjukkan kedua tombol sudah tidak saling menimpa,
tapi tetap tidak sejajar rapi (tinggi & posisinya beda). Setelah dua kali
perbaikan sebelumnya masih bermasalah, akar masalah sesungguhnya
ditemukan: `initDodgeButton()` SELALU mengonversi tombol malas (dan
sempat juga tombol submit) ke `position: fixed` tepat saat halaman
dimuat, dengan koordinat "difoto" lewat `getBoundingClientRect()`. Kalau
font custom (Baloo 2, di-`@import` dari Google Fonts) belum selesai
dimuat persis saat itu, ukuran/posisi yang terekam bisa beda dari
tampilan akhir setelah font aktif — dua tombol yang direkam di waktu
berbeda pun jadi tidak sinkron.

Didesain ulang total (bukan tambal lagi): sekarang KEDUA tombol dibiarkan
100% mengikuti CSS flexbox normal (`.lock-btn-row`, `align-items: stretch`)
sejak awal — JS tidak menyentuh posisi keduanya sama sekali. Tombol malas
baru dikonversi ke `position: fixed` (`escapeToFixed()`) tepat pada saat
kursor/jari BENAR-BENAR mendekat untuk pertama kalinya — pada titik itu
halaman sudah pasti sempat dilihat & di-interaksi, jadi font sudah pasti
termuat dan ukuran yang direkam pasti akurat. Tombol "Buka Gerbang" tidak
pernah disentuh JS sama sekali, jadi tidak mungkin lagi ikut bergeser atau
salah posisi — sepenuhnya aman dari kelas bug yang sama.

### 2026-07-31 — Tombol layar kunci overlap lagi (kali ini "Buka Gerbang" yang tertimpa) — akar masalah & perbaikan permanen
Screenshot menunjukkan tombol "Buka Gerbang" tertimpa/tersembunyi di
belakang "Maless Ahh....". Penyebabnya: perbaikan sebelumnya cuma
mengunci LEBAR tombol submit sebelum tombol malas dilepas dari flex row —
tapi tidak mengunci POSISINYA. Begitu tombol malas (anak PERTAMA di baris,
setelah dipindah ke kiri) keluar dari flow, tombol submit yang tersisa
(satu-satunya child) tetap ikut bergeser mengisi slot flex-start (kiri),
jadi malah tumpang tindih lagi dengan tombol malas yang sudah di-fixed di
posisi lama (juga di kiri).

Diperbaiki secara permanen: KEDUA tombol sekarang diukur dulu selagi masih
di flex row normal, LALU keduanya SEKALIGUS dikunci jadi `position: fixed`
di koordinat masing-masing (bukan cuma salah satu). Dengan begitu baris
tombol berhenti bergantung pada flex layout sama sekali — lepasnya satu
tombol dari flow tidak lagi memengaruhi posisi tombol yang lain, apa pun
urutannya di HTML.

### 2026-07-31 — Dekorasi lucu di luar lintasan + objek langit (awan & burung)
Permintaan user: area di luar jalur jangan kosong, dan tambah objek di
langit selain matahari. `findClearRandomSpot()` (dipakai monumen foto,
sekarang dipakai juga untuk dekorasi) diperbarui supaya otomatis
menghindari lintasan juga (`distanceToTrack()`, bukan cuma collider
bangunan/air) — jadi dekorasi baru ini dijamin tidak nyangkut di aspal.

Ditambahkan `SECTION 8E`: jamur (20 klaster, 2-4 jamur per klaster), semak
permen-warna (26 buah), pelangi (4 buah), serta hati & bintang melayang
(22+22, mengambang naik-turun sambil berputar pelan lewat
`updateFloatingCuteObjects()`) — semua disebar di luar lintasan. Untuk
langit: awan (`buildClouds()`, 30 gerombolan bola putih lembut, melayang
pelan & wrap-around lewat `updateClouds()`) dan burung-burung kecil
terbang melingkar tinggi di beberapa titik (`buildBirds()`/`updateBirds()`,
mengepakkan sayap sederhana lewat rotasi dua kerucut).

### 2026-07-31 — Dunia diperlebar lagi (220 → 320) & tombol "Buka Gerbang" dipastikan di kanan
Permintaan user: tombol "Buka Gerbang" di sebelah kanan (sudah terpenuhi
dari perubahan sebelumnya — `.lock-btn-row` di `index.html` sudah menaruh
`#dodge-btn` lebih dulu/kiri lalu `#lock-submit` setelahnya/kanan, jadi
tidak perlu perubahan lagi di bagian ini), dan dunia diperlebar lagi
dengan dinding bebatuan tetap mengikuti di batas barunya.

`WORLD_HALF` dinaikkan dari 220 ke 320. Karena hampir semua sistem batas
dunia (ground plane, `buildBoundaryWalls()`, `resolveCollisions()` clamp,
sebaran acak billboard/hewan/monumen foto lewat `findClearRandomSpot()` &
`findMonumentSpot()`) sudah dihitung relatif terhadap `WORLD_HALF`, cukup
satu angka itu yang diubah dan semuanya otomatis menyesuaikan ke batas
baru — termasuk dinding bebatuan yang otomatis pindah & tetap presis di
garis batas fisik yang baru. Yang butuh penyesuaian manual: posisi pantai
(`beachZ`, sebelumnya angka tetap 195) diganti jadi relatif
(`WORLD_HALF - 40`) supaya ikut pindah mendekati tepi dunia yang baru;
jumlah batu dinding (`ROCKS_PER_SIDE`) dinaikkan dari 46 ke 66 supaya
kepadatannya tetap konsisten di sisi yang sekarang lebih panjang; jarak
pandang kamera (`camera.far`) dan cakupan shadow camera juga sedikit
dilebarkan supaya tetap mencakup dunia yang lebih besar ini.

### 2026-07-31 — Dinding bebatuan di batas dunia + tombol "Maless Ahh...." pindah ke kiri
Permintaan user: dinding bebatuan di tiap sisi/ujung area supaya mobil
tidak bisa melewatinya, dan tombol jahil di layar kunci dipindah ke
sebelah kiri tombol "Buka Gerbang".

`resolveCollisions()` sebenarnya sudah lama menjepit posisi mobil dalam
kotak persegi ±(WORLD_HALF-4) — tapi sebelumnya batas itu tidak terlihat
sama sekali (dinding tak kasat mata). Ditambahkan `buildBoundaryWalls()`
(SECTION 5B): `InstancedMesh` berisi 184 batu (46 per sisi × 4 sisi)
tersebar di sepanjang keempat tepi dunia (`x = ±WORLD_HALF` dan
`z = ±WORLD_HALF`), dengan sedikit jitter posisi & rotasi/skala acak per
batu supaya terlihat alami, bukan barisan kotak rapi. Posisinya sengaja
tepat di garis batas fisik yang sudah ada, jadi dinding yang terlihat dan
batas collision yang sesungguhnya selalu selaras — mobil memang benar-
benar tidak bisa menembusnya, bukan cuma ilusi visual.

Tombol "Maless Ahh...." dipindah ke sebelah kiri lewat urutan elemen di
`.lock-btn-row` (HTML) — karena `initDodgeButton()` membaca posisi awal
tombol itu secara dinamis lewat `getBoundingClientRect()` (bukan
di-hardcode ke salah satu sisi), pemindahan cukup lewat urutan HTML saja
tanpa perlu ubah logic JS apa pun.

### 2026-07-31 — Monumen foto tersebar di luar lintasan
Permintaan user: monumen-monumen di luar lintasan yang masing-masing
menampilkan satu foto, jumlahnya mengikuti jumlah foto yang ada. Foto
dummy lama (30 file bernama `kota-1.jpg` dst dari fitur billboard yang
sudah dihapus) diganti 10 foto dummy baru bernama generik `foto-1.jpg` s/d
`foto-10.jpg`, digenerate ulang (gradient pastel + label + ikon kamera).

Ditambahkan `SECTION 8D` di `script.js`: `TOTAL_PHOTO_COUNT` (10) menentukan
jumlah monumen, `PHOTO_FILENAMES` men-generate daftar nama file otomatis
dari angka itu (bukan daftar manual) — sama seperti pola yang dipakai
sistem billboard versi sebelumnya. Tiap monumen (`buildPhotoMonument()`)
berupa pedestal bertingkat (2 tier bundar + pilar) dengan bingkai foto di
atasnya dan bola dekoratif emissive di puncak — beda gaya dari billboard
lama yang berupa papan tipis di pinggir jalan, sesuai permintaan ("monumen",
bukan papan).

Penempatannya (`findMonumentSpot()`) memakai `distanceToTrack()` (proyeksi
titik ke segmen terdekat sepanjang `TRACK_WAYPOINTS`, dipakai juga oleh
`applyRouteLock()`) untuk memastikan tiap monumen SUNGGUH-SUNGGUH di luar
lintasan (jarak minimum `TRACK_HALF_WIDTH + 16`), plus jaga jarak dari
monumen ulang tahun, danau, dan monumen foto lain (biar tidak berdempetan).
Karena posisinya di luar koridor lintasan, monumen-monumen ini otomatis
baru bisa didatangi mobil setelah `freeRoam` aktif (selesai FINISH & baca
surat) — konsisten dengan alur permainan yang sudah ada, tidak perlu logic
tambahan apa pun untuk itu.

### 2026-07-31 — FINISH sekarang JADI ujung aspal itu sendiri (bukan spur ke koordinat terpisah) + monumen makin mewah
Screenshot masih menunjukkan monumen terlihat "mengambang" tanpa jalan
nyata menujunya — meski tikungan sudah diperpendek di perbaikan
sebelumnya, akar masalah sesungguhnya adalah desainnya sendiri: FINISH
selalu berupa **koordinat tetap terpisah** (`DISTRICT_ANCHORS.landmark`)
yang lalu disambung lewat spur di ujung lintasan. Ini rawan terasa
"tidak ada jalan" kalau posisi landmark itu terlihat dekat secara garis
lurus dari sudut pandang awal, padahal jalur sebenarnya jauh memutar.

Diperbaiki dengan menghapus konsep spur/koordinat terpisah sama sekali:
sekarang lintasan berhenti begitu saja di titik tertentu (5/6 dari
tikungan kiri, `TRACK_FINISH_ARC_FRACTION`), dan titik berhenti TERAKHIR
itu sendiri yang otomatis jadi `FINISH_POINT` — dipakai langsung oleh
`buildLandmark()`, `checkCakeTrigger()`, dan `triggerFireworksShow()`.
Dengan begini **mustahil** ada kondisi "finish tanpa jalan", karena
finish-nya secara definisi adalah ujung aspal yang sudah pasti tersambung
dari START. `DISTRICT_ANCHORS.landmark` (koordinat tetap yang lama) sudah
dihapus total dari `DISTRICT_ANCHORS`.

Monumen juga dibuat makin mewah sesuai permintaan: plaza diperbesar lagi
(20→22), dan ditambahkan **40 partikel kerlap-kerlip ambient**
(`landmarkSparkles`, warna-warni, berkedip terus-menerus lewat
`updateLandmarkAnimations`) plus **kembang api ambient berkala** (setiap
5-9 detik, lewat penanda waktu `nextAmbientFireworkAt`) yang meletus di
sekitar monumen walau mobil belum sampai FINISH — supaya monumen terasa
hidup & mewah bahkan dari kejauhan, bukan cuma pada momen kedatangan saja.

### 2026-07-31 — Rute finish "tidak terhubung" — akar masalah & perbaikan
Screenshot menunjukkan rute menuju finish terlihat terputus/berantakan di
sekitar area START. Analisis: tikungan kiri lintasan oval sebelumnya
diteruskan PENUH (setengah lingkaran utuh) sampai balik ke koordinat yang
SAMA PERSIS dengan titik START, lalu spur menuju FINISH (monumen) juga
berangkat dari titik itu juga. Ternyata arah spur finish dari titik itu
cuma beda ~14° dari arah awal lap (lintasan lurus bawah) — dua jalan itu
jadi nyaris sejajar/tumpang-tindih tepat di dekat START alih-alih
bercabang dengan jelas, sehingga terlihat seperti rute yang tidak
tersambung dengan benar. Diperbaiki dengan memotong tikungan kiri jadi
cuma SEPARUH (`TRACK_ARC_STEPS_HALF`, berhenti di titik paling kiri jauh
lintasan, bukan diteruskan sampai balik ke dekat START) — dari titik potong
itu, arah spur finish jadi jelas berbeda (~90°+) dari arah lap manapun di
dekatnya, jadi persimpangannya bersih & mudah dibedakan. `buildCurbs()`
ikut disesuaikan supaya penempatan curb tikungan kiri mengikuti jumlah
titik yang baru (separuh, bukan penuh).

Fog (`scene.fog`) juga diturunkan densitasnya (0.0032 → 0.0021) supaya
monumen/area FINISH tetap terlihat dari jarak lebih jauh — membantu pemain
mengira-ira arah lintasan di dunia yang sekarang berskala jauh lebih besar
daripada versi-versi awal proyek ini.

### 2026-07-31 — Monumen ulang tahun dibangun kembali (lebih megah) + kembang api + surat konteks LDR
Setelah sebelumnya dihapus total, monumen ulang tahun dibangun ulang di
titik FINISH — kali ini lebih megah sesuai permintaan user: plaza
diperbesar (radius 15→20), gapura 10 pilar (dari 8) + kubah + bunting
melengkung, balon ditambah jadi 32, kue 7 lilin, dan ditambah **banner
besar "HAPPY BIRTHDAY"** berdiri di depan gapura — posisi & rotasinya
dihitung dari arah pendekatan sesungguhnya di segmen terakhir
`TRACK_WAYPOINTS` (bukan asumsi arah tetap), supaya tulisannya konsisten
terbaca benar dari arah mobil datang, mengikuti perbaikan bug "tulisan
gerbang terbalik" sebelumnya.

Ditambahkan juga **sistem kembang api** (`SECTION 8C`): `spawnFirework()`
membuat satu ledakan partikel (`THREE.Points`, ~46 partikel per ledakan,
warna acak, kecepatan radial ke segala arah + gravitasi ringan, memudar
lewat opacity seiring waktu), dan `triggerFireworksShow()` melepas 6
ledakan berturutan (jeda 260ms) di sekitar monumen. Dipanggil bersamaan
dengan jingle & confetti yang sudah ada, tepat saat `triggerCakeIntro()`
terpicu (mobil sampai FINISH).

Isi surat ulang tahun (`BIRTHDAY_LETTER_LINES`) diganti ke konteks
pasangan LDR (long-distance relationship) sesuai permintaan user, dengan
teks "Happy Birthday" eksplisit di baris pertama.

Alur "sampai FINISH → baca surat → bebas jelajah" **tidak berubah** —
mekanismenya (`checkCakeTrigger`, `triggerCakeIntro`, `freeRoam = true`
saat tombol "Lanjut Jalan-jalan" diklik) sudah ada sejak sebelumnya dan
tetap dipertahankan; yang baru murni penambahan visual/animasi di atasnya.

### 2026-07-31 — Bukit tanda "HAPPY BIRTHDAY", monumen (finish), & semua dekorasi dihapus; lintasan diperbagus
Permintaan eksplisit user: hapus bukit + tanda Hollywood-style, hapus
monumen ulang tahun beserta seluruh dekorasi (pohon, awan, hewan,
billboard, jamur, pelangi, dll — bukan bangunan kota, yang memang sudah
dihapus di iterasi sebelumnya), dan perbagus lintasan jalannya. Dihapus
total dari `script.js`: `buildBirthdaySign()` + bitmap font 5x7-nya
(SECTION 8B), seluruh isi 3D `buildLandmark()` (gapura, kue, balon,
bunting, dome, point light animasi — SECTION 8 disederhanakan jadi cuma
menyimpan `landmarkCenter` untuk trigger surat), `buildDecorAnchors()` +
gazebo/taman bunga/bangku/pohon anchor, seluruh SECTION 5C (hewan: anjing,
capybara, kupu-kupu), SECTION 6 (tebing batas & pohon latar
`InstancedMesh`), SECTION 6B (awan, jamur, pelangi, hati/bintang melayang,
semak permen), dan SECTION 7 (sistem billboard foto beserta
`TOTAL_PHOTO_COUNT`/`PHOTO_FILENAMES`). Semua pemanggilnya di `init()` dan
`animate()` ikut dibersihkan, termasuk fungsi `updateWorldAnimations()`
yang jadi dead code karena semua elemen yang dianimasikannya sudah tidak
ada. `PALETTE` juga dirapikan (`cliff`/`trunk`/`leaf`/`plazaFloor` yang
sudah tidak dipakai dihapus, diganti `curbA`/`curbB` untuk fitur baru di
bawah).

Sebagai gantinya, lintasan balap sendiri **diperbagus** dengan tiga elemen
baru: **curb merah-putih selang-seling** di kedua tikungan (`buildCurbs()`,
ditempel di tepi luar lengkung berdasarkan posisi terhadap titik pusat
tikungan), **garis kotak-kotak START & FINISH** yang digambar langsung di
permukaan aspal (`buildStartFinishLines()`, texture canvas 8x8 kotak-kotak,
bukan cuma banner di atas seperti sebelumnya), dan konstanta bentuk
lintasan (`TRACK_L`, `TRACK_R`, `TRACK_ARC_STEPS`) yang di-hoist ke level
modul supaya bisa dipakai bersama oleh generator waypoint maupun fungsi
curb yang baru.

### 2026-07-31 — Semua bangunan distrik dihapus, dunia jadi murni sirkuit balap
Permintaan eksplisit user: hapus semua bangunan & pastikan tidak ada jalan
lain selain sirkuit. `buildStructure()` (factory bangunan generik) dan
`buildDistrictBuildings()` (kota/cafe/gereja/kantor/mall/desa beserta semua
bangunannya) dihapus total dari `script.js`, begitu juga pemanggilannya di
`init()`. `DISTRICT_ANCHORS` dirapikan — hanya menyisakan `landmark`
(FINISH) dan `danau`, karena entri distrik lain sudah tidak dipakai di
mana pun. Dikonfirmasi juga tidak ada jaringan jalan lain selain
`buildRaceTrack()` (satu-satunya pemanggil `addRoadSegment`) — dunia
sekarang murni sirkuit oval + monumen ulang tahun + dekorasi (pohon, awan,
hewan, billboard, dsb — bukan "bangunan" kota, tetap dipertahankan).

### 2026-07-31 — Bentuk lintasan diganti jadi oval/stadion (bukan zigzag 17 titik) + warna aspal dipertegas
Screenshot menunjukkan mobil terlihat jauh dari aspal yang tampak di depan
mata, padahal seharusnya terkunci dalam radius 6 unit dari lintasan.
Analisis akar masalah: bentuk lintasan sebelumnya (poligon zigzag 17 titik
yang menyusuri hampir seluruh tepi peta) tidak cembung (non-convex) —
titik-titik di tengah peta kadang secara garis lurus justru lebih DEKAT ke
segmen yang jauh/tidak berdekatan di urutan jalur, ketimbang ke segmen
jalan yang sedang dilalui pemain. Karena `applyRouteLock()` mencari
"segmen TERDEKAT" tanpa mempertimbangkan urutan/kedekatan sepanjang jalur,
ini bisa membuat mobil "ditarik" ke segmen yang salah, membuatnya terlihat
terlempar jauh dari aspal yang tampak di depan.

Diperbaiki dengan mengganti total bentuk lintasan jadi **oval/stadion**
(`buildOvalTrackWaypoints()`): dua lintasan lurus panjang (masing-masing
240 unit) dihubungkan dua tikungan setengah-lingkaran radius 90 unit di
kedua ujung — bentuk CEMBUNG yang jauh lebih aman dari ambiguitas
"segmen terdekat yang salah" di atas, sekaligus terlihat jelas sebagai
sirkuit balap sungguhan (bukan rute zigzag acak). Lintasan lurus/tikungan
ini baru menyimpang lewat satu spur pendek di ujung menuju monumen ulang
tahun sebagai FINISH. Lebar jalan (`TRACK_WIDTH`) dinaikkan dari 12 ke 14,
`TRACK_HALF_WIDTH` ikut disesuaikan ke 7.

Warna aspal (`PALETTE.road`) juga diganti dari lavender pucat (`0xd8c2ef`,
terlalu dekat ke warna tanah/langit pastel) ke abu-mauve lebih gelap
(`0x9689b3`) supaya jalan benar-benar kontras & mudah dikenali sebagai
jalan dari kejauhan, plus marka tepi jalan dipertebal (0.25→0.4 unit).

### 2026-07-31 — SEMUA jalan lama dihapus, diganti SATU sirkuit balap besar
Permintaan eksplisit user setelah screenshot menunjukkan tulisan "START"
terbalik (cermin) dan mempertanyakan skala jaringan jalan. Seluruh sistem
jalan sebelumnya (hub + cincin/ring road + spur per distrik) dihapus total
dan diganti **satu** lintasan tunggal yang jauh lebih panjang & besar —
`TRACK_WAYPOINTS` (17 titik, lebar jalan `TRACK_WIDTH = 12`, hampir
mengelilingi seluruh peta) dari titik START custom sampai FINISH tepat di
monumen ulang tahun. `TRACK_WAYPOINTS` ini sekarang jadi SATU sumber data
yang dipakai bersama oleh tiga sistem: `buildRaceTrack()` (aspal &
tambalan bundar tiap tikungan), `applyRouteLock()` (koridor collision —
logic-nya sendiri tidak berubah, cuma sekarang jalan yang diikuti jauh
lebih panjang), dan `buildPhotoBillboards()` (sebaran billboard rute) —
supaya jalan yang terlihat, koridor mobil, dan billboard selalu presis
selaras. Posisi & arah spawn mobil (`initCarState`) juga dipindah ke titik
START lintasan baru (sebelumnya di alun-alun/hub yang sekarang sudah tidak
ada).

### 2026-07-31 — Tulisan gerbang START/FINISH terbalik (cermin) — diperbaiki
Screenshot menunjukkan tulisan "START" terlihat seperti pantulan cermin
("TRATS"). Penyebabnya: banner gerbang pakai `PlaneGeometry` yang secara
default punya normal (sisi depan/bacaan benar) menghadap +Z lokal; setelah
`group.rotation.y = angle` (angle = arah laju mobil), normal itu ikut
menghadap KE ARAH mobil PERGI, bukan ke arah mobil DATANG — jadi mobil
yang baru mulai (posisi di belakang gerbang, arah mobil datang) malah
melihat sisi BELAKANG banner, yang dengan material `DoubleSide` tampil
tercermin/terbalik. Diperbaiki dengan `group.rotation.y = angle + Math.PI`
di `buildRaceGate()` — sisi depan banner sekarang menghadap balik ke arah
mobil datang, sesuai posisi kamera saat mendekati gerbang manapun di
lintasan.

### 2026-07-31 — Tombol "Buka Gerbang" & "Maless Ahh...." saling menimpa — diperbaiki
Screenshot menunjukkan kedua tombol tumpang-tindih alih-alih berdampingan.
Penyebabnya: begitu `initDodgeButton()` mengubah tombol malas jadi
`position: fixed` (supaya bisa "kabur" dari posisi awalnya), tombol itu
otomatis KELUAR dari flex row (`.lock-btn-row`) — dan karena tombol
"Buka Gerbang" masih `flex: 1` sebagai satu-satunya child yang tersisa, ia
langsung MELEBAR mengisi seluruh baris, jadi tertimpa tombol malas yang
sudah dikunci posisi lamanya (separuh lebar baris). Diperbaiki dengan
mengunci lebar tombol "Buka Gerbang" (`flex: none` + `width` eksplisit
dalam px, diambil dari `getBoundingClientRect()`) TEPAT SEBELUM tombol
malas dilepas dari flow — sekarang keduanya benar-benar terbagi dua
berdampingan (bukan ditimpa), persis seperti tata letak awalnya.

### 2026-07-31 — Jaringan jalan dijadikan satu sirkuit balap START→FINISH
Sebelumnya mobil hanya dikunci dalam koridor garis lurus hub→landmark.
Sekarang seluruh jaringan jalan yang sudah ada (hub → keluar ke cincin
lewat spoke distrik "kota" → satu putaran penuh cincin → balik ke hub →
menuju landmark) dijadikan satu lintasan balap utuh lewat
`TRACK_WAYPOINTS` (polyline banyak segmen, di-generate oleh
`buildTrackWaypoints()`), dan `applyRouteLock()` dirombak dari
"jarak ke satu garis" jadi "jarak ke segmen TERDEKAT di seluruh polyline"
— supaya mobil benar-benar terkunci mengikuti jalur manapun sepanjang
sirkuit, bukan cuma satu ruas jalan. `TRACK_HALF_WIDTH` diperketat ke 6
unit (dari sebelumnya 11) supaya mobil terasa benar-benar "di jalur"
aspal, bukan di lapangan bebas selebar itu. Ditambahkan juga gerbang
**START** (di alun-alun) dan **FINISH** (tepat sebelum plaza landmark) —
banner kain bermotif kotak-kotak ala bendera balap (`buildRaceGates()`,
`makeBannerTexture()`) — supaya kota terasa seperti sirkuit balap
sungguhan, bukan cuma jaringan jalan kota biasa. `freeRoam` tetap baru
aktif setelah surat ulang tahun ditutup, konsisten dengan sebelumnya.

### 2026-07-31 — Billboard rute ditambah & disebar di sepanjang seluruh sirkuit
`ROUTE_BILLBOARD_COUNT` dinaikkan dari 10 ke 24 (foto sisanya, 6, tetap
disebar acak ke seluruh kota) karena sirkuit sekarang jauh lebih panjang
(dulu cuma ruas hub→landmark, ~60 unit; sekarang mencakup satu putaran
cincin penuh, ~1000+ unit). Penempatannya dihitung lewat
`pointAlongTrack()` yang berjalan di sepanjang `TRACK_WAYPOINTS` secara
kumulatif, bukan cuma menyebar di satu ruas garis lurus seperti
sebelumnya — supaya billboard foto benar-benar menemani mobil dari garis
START sampai FINISH di seluruh sirkuit, bukan cuma di ujung dekat
landmark.

### 2026-07-31 — Awan-awan lucu & objek-objek dekoratif imut lainnya
Ditambahkan lapisan dekorasi baru murni dari geometry primitif, semua di
SECTION 6B (`script.js`):
- **Awan** (`buildClouds`, 26 buah): tiap awan adalah gerombolan 4-6 bola
  putih lembut (`buildCloudPuff`) melayang di ketinggian 42-76 unit,
  melayang pelan ke arah +X tiap frame (`updateClouds`) dan wrap-around ke
  sisi lain peta begitu keluar batas — supaya langit terasa hidup tanpa
  perlu logic partikel/sprite rumit.
- **Jamur mini** (`buildMushroomClusters`, 14 klaster, 2-4 jamur per
  klaster) tersebar di titik acak lewat `findClearRandomSpot()`.
- **Pelangi kecil** (`buildRainbows`, 3 buah): tumpukan 6 setengah-torus
  warna pelangi pastel dengan radius menyusut, ditaruh di titik acak yang
  cukup lapang (margin 12) supaya tidak nyangkut bangunan.
- **Hati & bintang melayang** (`buildFloatingCuteObjects`, 12+12): mengambang
  naik-turun + berputar pelan (`updateFloatingCuteObjects`), tersebar acak
  di ketinggian rendah (2-5 unit) di seluruh kota.
- **Semak permen-warna** (`buildGumdropBushes`, 20 buah): bola pastel
  warna-warni sebagai variasi dekorasi selain pohon hijau biasa, masing-
  masing dapat circle collider kecil supaya tetap solid seperti semak
  sungguhan.

Semua dipanggil lewat `findClearRandomSpot()` yang sama dipakai billboard
& hewan, jadi otomatis menghindari bangunan/air yang sudah terdaftar
sebagai collider — tidak perlu koordinat manual satu-satu.

### 2026-07-31 — Sistem foto jadi dinamis (`foto-N.jpg`), lebih banyak billboard tersebar acak, lebih banyak hewan acak, papan rute & goyang pohon dihapus
Rangkuman perubahan sesuai permintaan user:

- **Foto dummy diganti penamaan generik**: dari nama per-distrik
  (`kota-1.jpg`, dst) menjadi deret generik `foto-1.jpg` s/d `foto-30.jpg`
  (30 foto dummy digenerate ulang). `PHOTO_SPOTS_CONFIG` (per-distrik) yang
  lama dihapus total, diganti `TOTAL_PHOTO_COUNT` + `PHOTO_FILENAMES` yang
  men-generate daftar nama file secara otomatis dari satu angka — supaya
  jumlah billboard betul-betul "mengikuti jumlah foto yang ada" seperti
  yang diminta. User tinggal ganti angka `TOTAL_PHOTO_COUNT` di script.js
  kalau menambah/mengurangi foto (dijelaskan juga di
  `assets/photos/README.txt`).
- **Billboard rute + sebaran acak**: `ROUTE_BILLBOARD_COUNT` (10) foto
  pertama dipasang berjajar di sepanjang rute wajib awal (hub→landmark),
  sisanya (20 foto) disebar acak ke seluruh penjuru kota lewat
  `findClearRandomSpot()` — helper baru yang dipakai bersama untuk sebaran
  billboard maupun hewan, mengecek posisi acak terhadap semua collider
  yang sudah terdaftar supaya tidak nyangkut di bangunan/air.
- **2 gaya billboard baru**: ditambah `cloud` (bingkai gerombolan lingkaran
  ala awan) dan `hanging` (foto digantung dua tiang pakai "tali") di atas 3
  gaya sebelumnya (classic/polaroid/round) — total 5 gaya bergantian.
- **Hewan disebar acak**: `buildAnimals()` dirombak dari daftar titik tetap
  menjadi jumlah tetap (10 anjing, 8 capybara, 16 kupu-kupu) yang
  ditempatkan di titik acak manapun di peta lewat `findClearRandomSpot()`.
- **Animasi goyang pohon dihapus** (`bgTreeMeshes`/`bigTreeList` beserta
  animasinya di `updateWorldAnimations()`) — permintaan eksplisit user.
- **Papan penunjuk rute (signpost) dihapus** (`buildRouteSignpost`,
  `makeSignLabelTexture`, `DISTRICT_LABELS`) — permintaan eksplisit user.
- **Tombol "Tombol Malas" pindah posisi awal**: sebelumnya muncul di pojok
  kanan-bawah layar; sekarang dirender dalam `.lock-btn-row` bersebelahan
  langsung dengan tombol "Buka Gerbang", lalu `initDodgeButton()` mengunci
  posisi renderan itu (`getBoundingClientRect()`) jadi `position: fixed`
  di koordinat yang sama persis — supaya baru mulai "kabur" dari titik itu
  saat kursor mendekat, bukan muncul di pojok sejak awal. Teksnya diganti
  jadi "Maless Ahh....".
- **Password & hint diganti** sesuai permintaan user langsung di
  `LOCK_PASSWORD`/`LOCK_HINT`.

### 2026-07-31 — Langit biru cerah + matahari, rute mobil dikunci sampai monumen, dan banyak animasi
Rangkuman pembaruan besar sesuai permintaan user:

- **Langit & pencahayaan**: `PALETTE.sky`/`fog` diganti dari pink pastel ke
  biru cerah, ambient/hemisphere ikut disesuaikan ke rona biru langit, dan
  ditambahkan bola matahari terlihat (`MeshBasicMaterial` emissive + glow)
  di posisi yang sama dengan `DirectionalLight` utama supaya matahari
  benar-benar tampak di langit, bukan cuma efek cahaya tak kasat mata.
- **Tanda HAPPY BIRTHDAY ketutupan kubah gapura**: bukit dudukan tanda
  dinaikkan drastis (tinggi 11→24 unit) dan digeser sedikit lebih jauh dari
  landmark, supaya tulisannya berdiri jelas DI ATAS kubah gapura, bukan
  tertutup olehnya saat dilihat dari jalur pendekatan.
- **Billboard tidak monoton**: `buildBillboard()` sekarang punya 3 varian
  gaya (`classic` bingkai kotak dua tiang, `polaroid` bingkai putih tebal
  satu tiang sedikit miring, `round` bingkai bulat torus) yang dipakai
  bergantian (`STYLES` cycle) di `buildPhotoBillboards()`.
- **Papan penunjuk rute**: ditambah satu signpost di alun-alun (hub) dengan
  lengan panah bertuliskan nama tiap distrik (`buildRouteSignpost()`,
  label lewat canvas texture `makeSignLabelTexture()`), menghadap arah
  distrik masing-masing.
- **Hewan-hewan lucu**: anjing, capybara, dan kupu-kupu ditambahkan dari
  geometry primitif (`buildDog`, `buildCapybara`, `buildButterfly`),
  tersebar di titik-titik taman/anchor dekoratif, dianimasikan tiap frame
  lewat `updateAnimals()` — anjing/capybara jalan pelan bolak-balik +
  idle-bob, kupu-kupu terbang melingkar sambil mengepakkan sayap.
- **Mobil lebih realistis**: ditambah rocker panel dua-warna, garis
  sambungan pintu + gagang pintu, grille depan, plat nomor depan/belakang,
  pipa knalpot, dan atap diganti dari kotak jadi setengah silinder (lebih
  membulat/halus).
- **Rute dikunci sampai monumen, baru bebas jelajah**: ditambahkan
  `applyRouteLock()` yang membatasi posisi mobil dalam koridor lurus dari
  titik spawn ke landmark ulang tahun (`ROUTE_LOCK`, half-width 11 unit)
  selama `freeRoam` masih `false`. `freeRoam` baru diset `true` saat
  pengguna menutup surat ulang tahun (klik "Lanjut Jalan-jalan") — sesuai
  urutan yang diminta: sampai ke monumen dulu & baca surat, baru bebas ke
  mana saja. Status ini ditampilkan lewat badge kecil di HUD
  (`updateRouteHUD()`) yang otomatis memudar begitu rute terbuka.
- **Animasi tambahan di berbagai objek**: balon landmark mengambang naik-
  turun, bendera gapura berkibar, api lilin kue berkedip (skala +
  intensitas emissive berosilasi), dan pohon (baik `InstancedMesh` latar
  massal maupun pohon anchor eksplisit) bergoyang pelan seperti tertiup
  angin — semua lewat `updateWorldAnimations()` yang dipanggil tiap frame
  di `animate()`.

### 2026-07-31 — Jaringan jalan dirombak jadi hub + cincin/ring road + spur
Screenshot menunjukkan rute jalan terasa tidak beraturan. Penyebabnya:
sistem "loop" sebelumnya menghubungkan anchor distrik LANGSUNG satu sama
lain secara berurutan (diurutkan berdasarkan sudut), padahal jarak tiap
distrik dari hub sangat bervariasi (55–184 unit) — hasilnya poligon
zigzag/bintang yang tidak terlihat seperti jalan lingkar sungguhan.
Diganti dengan cincin jalan lingkaran PENUH berjari-jari tetap
(`RING_RADIUS = 125`, ±28 segmen pendek), dengan distrik dekat (radius <
cincin, mis. landmark) disambung LANGSUNG dari hub, dan distrik jauh
disambung lewat spoke radial hub→cincin + spur pendek cincin→distrik. Hasil
akhir: rute jauh lebih rapi & terprediksi, sekaligus landmark ulang tahun
otomatis dapat akses langsung dari hub tanpa muter dulu.

### 2026-07-31 — Sungai dihapus dari dunia
Permintaan eksplisit user. Fungsi pembangun sungai (rantai collider +
mesh strip mengikuti kurva) di `buildWater()` dihapus seluruhnya; danau dan
pantai/laut tetap dipertahankan. Ini juga otomatis menyederhanakan
navigasi (satu sumber potensi jalan "terputus" oleh air hilang).

### 2026-07-31 — Tulisan "HAPPY BIRTHDAY" terbalik/cermin — diperbaiki
Screenshot menunjukkan tanda Hollywood terlihat seperti pantulan cermin
(setiap huruf & urutan katanya terbalik). Penyebabnya: `signGroup.rotation.y
= Math.PI` yang ditambahkan di iterasi sebelumnya membalik seluruh sumbu X
lokal — padahal mobil sejak awal sudah menghadap -Z (heading awal
`Math.PI`) dan huruf sudah disusun H→Y di sepanjang +X lokal, yang tanpa
rotasi apa pun SUDAH terbaca benar dari sudut pandang mobil yang mendekat.
Rotasi 180° itu dihapus.

### 2026-07-31 — Landmark ulang tahun dibuat lebih meriah & benar-benar bebas diakses
Collider kecil dekoratif yang sebelumnya (tanpa sengaja) dipasang tepat di
tengah plaza dihapus total — plaza sekarang tidak punya collider sama
sekali sehingga mobil bisa masuk dari arah mana pun tanpa terhalang.
Ditambahkan untaian bendera pesta (bunting) melengkung antar 8 pilar
gapura, jumlah balon ditambah dari 14 menjadi 22 dengan sebaran tinggi
lebih variatif, dan tanda HAPPY BIRTHDAY ditambahi lampu marquee kecil yang
berkelap-kelip (`updateBirthdaySign()`, animasi sinusoidal per-lampu
dengan fase berbeda) plus deretan bendera kecil di puncak bukit — semuanya
untuk memperkuat kesan "meriah" sesuai permintaan user.

### 2026-07-31 — Foto dummy digenerate langsung ke `assets/photos/`
Sebelumnya folder foto kosong dan billboard mengandalkan fallback canvas
placeholder saat runtime. Sekarang 12 foto dummy (satu per entri di
`PHOTO_SPOTS_CONFIG`) digenerate sebagai file `.jpg` sungguhan (gradient
pastel + ikon kamera + label) dan disimpan permanen di `assets/photos/`,
supaya proyek langsung terlihat "terisi" begitu dibuka tanpa perlu foto asli
dulu. User tinggal menimpa file-file itu dengan foto asli (nama file harus
tetap sama) kapan saja — fallback canvas di `script.js` tetap dipertahankan
sebagai jaring pengaman kalau ada file yang dihapus/hilang.

### 2026-07-31 — Tanda "HAPPY BIRTHDAY" gaya Hollywood di landmark
Ditambahkan tanda huruf 3D raksasa bertuliskan "HAPPY BIRTHDAY" berdiri di
atas bukit kecil di belakang landmark ulang tahun, terinspirasi dari tanda
ikonik Hollywood — permintaan eksplisit user supaya landmark terasa lebih
meriah. Karena batasan proyek melarang font/model eksternal, huruf dibangun
dari bitmap font 5x7 sederhana (`PIXEL_FONT_5X7`) yang di-generate jadi
kubus-kubus kecil per piksel aktif (`buildLetterBlock()`) — pendekatan yang
konsisten dengan prinsip "semua objek dari geometry primitif" yang sudah
dipakai di seluruh proyek. Tiap huruf diberi warna pastel berbeda (siklus
dari `SIGN_LETTER_COLORS`) untuk kesan playful/meriah, bukan putih polos
seperti tanda Hollywood asli.

### 2026-07-31 — Layar ulang tahun diubah jadi "surat lucu" + suara
Sebelumnya `#birthday-screen` berupa kartu ucapan generik satu paragraf.
Sekarang direstyle jadi tampilan surat kertas bergaris (font tulisan tangan
"Patrick Hand", animasi buka-surat) dengan isi lucu dari konstanta yang bisa
diedit, `BIRTHDAY_LETTER_LINES`, di-render otomatis lewat
`populateBirthdayLetter()` — memisahkan konten dari markup supaya gampang
diganti tanpa menyentuh HTML. Ditambahkan juga suara lewat Web Audio API
murni (osilator disintesis on-the-fly, `playPartyJingle()` &
`playPaperPopSound()`) — bukan file audio eksternal, supaya tetap konsisten
dengan batasan "tanpa aset eksternal" dan tetap jalan dari `file://` tanpa
request jaringan apa pun. Melodinya sengaja berupa arpeggio naik generik
(C5-E5-G5-C6-E6), bukan lagu "Happy Birthday" yang sebenarnya, untuk
menghindari ambiguitas hak cipta sama sekali. `AudioContext` sengaja baru
dibuat/di-resume di dalam `attemptUnlock()` (dipicu klik/Enter pengguna
asli di layar kunci) supaya lolos kebijakan autoplay browser — trigger
suara berikutnya di landmark (yang bukan gesture langsung) tetap bisa
berbunyi karena context sudah aktif sejak proses unlock.


### 2026-07-30 — Pin Three.js ke r147 (non-module, `unpkg.com/three@0.147.0`)
Batasan wajib proyek ini: harus bisa dibuka lewat `file://` tanpa server, yang
berarti tidak bisa pakai `<script type="module">` + `import` (diblokir CORS di
`file://`). Direktori `examples/js/` (addon non-module seperti `OrbitControls`
versi classic script) resmi dihapus dari repositori Three.js mulai **r148**;
build global `three.js`/`three.min.js` sendiri baru dihapus total di **r160**
(dapat warning deprecated sejak r150). Karena proyek berpotensi butuh addon
non-module, dipilih **r147** sebagai versi teraman terakhir yang masih
menyediakan keduanya (build global + `examples/js`) tanpa warning maupun error
CORS/module apa pun.

### 2026-07-30 — Collision dihitung di ruang 2D top-down (x/z), bukan 3D penuh
Dunia ini pada dasarnya datar (mobil tidak melompat/terbang), jadi collision
3D penuh (bounding box 3D) menambah kompleksitas tanpa manfaat gameplay nyata.
Circle-vs-circle dipakai untuk objek bulat (danau, sungai, pantai, petak
bunga, pohon anchor, batas dunia), rect presisi (titik terdekat dengan
rotasi) untuk objek persegi (bangunan, gazebo, bangku) — supaya sudut-sudut
bangunan tetap solid tanpa perlu physics engine penuh.

### 2026-07-30 — Sungai & pantai dibuat solid lewat rantai collider lingkaran, tanpa logic jembatan
Daripada membangun sistem jembatan (deteksi persimpangan jalan-sungai, mesh
jembatan, dsb) yang menambah kompleksitas signifikan, jaringan jalan hub+loop
sengaja dirancang tidak memotong langsung jalur sungai/pantai. Sungai/pantai
"solid" cukup lewat rantai titik collider lingkaran berjarak dekat di
sepanjang kurvanya — pendekatan yang jauh lebih sederhana untuk cakupan
proyek ini.

### 2026-07-30 — Pohon latar massal (`InstancedMesh`) tidak diberi collider individual
Untuk menjaga performa mobile (draw call & perhitungan collision tetap
ringan), ratusan pohon dekoratif di `buildBackgroundTrees()` dirender lewat
`InstancedMesh` tanpa collider per instance — hanya dijaga penempatannya
menjauhi jalan/air/bangunan lewat filter jarak saat generate. Pohon yang
memang perlu solid (anchor dekoratif eksplisit) dibangun terpisah lewat
`addBigTree()` dan diberi circle collider sendiri.

### 2026-07-30 — Skala landmark ulang tahun: "sedang"
Dikonfirmasi dengan pengguna sebelum dibangun (sesuai instruksi prompt awal):
plaza landmark dibuat mencolok secara visual (gapura 8 pilar + kubah + kue +
balon + lighting animasi khusus) tapi proporsinya (radius ~15 unit) sengaja
tidak melebihi distrik-distrik lain seperti Mall atau Kantor, supaya tetap
terasa jadi satu titik istimewa tanpa mendominasi keseluruhan peta.

### 2026-07-30 — Tidak ada mode orbit bebas
Dikonfirmasi dengan pengguna: kamera hanya memakai chase-cam (3 preset jarak:
Dekat/Sedang/Jauh) sepanjang waktu, tanpa mode orbit tambahan saat mobil diam
— menjaga kontrol kamera tetap sederhana & konsisten dengan gaya "drive
simulator" yang jadi referensi.

### 2026-07-30 — Perbaikan tampilan pudar/overexposed & env map dibatasi hanya ke mobil
Screenshot awal menunjukkan seluruh dunia (tanah, pohon, tebing, mobil)
terlihat pudar/nyaris putih tanpa kontras. Penyebabnya: (1) `scene.environment`
dipasang secara global dari env map gradient prosedural, sehingga SEMUA
material standar (tanah, bangunan, pohon) ikut memantulkan gradient
putih/lavender itu di atas pencahayaan langsung yang sudah tinggi; (2) total
intensitas ambient + hemisphere + sun + fill light terlalu tinggi dikombinasi
`toneMappingExposure` 1.15, sehingga warna pastel (yang secara alami sudah
bernilai terang) langsung "meledak" ke putih setelah tone mapping. Perbaikan:
env map prosedural sekarang HANYA dipasang ke material bodi & atap mobil
(`carEnvMap`, bukan `scene.environment`), intensitas ambient/hemi/fill
diturunkan (masing-masing dari 0.55/0.65/0.35 menjadi 0.3/0.38/0.16), dan
`toneMappingExposure` diturunkan ke 0.85. Geometry mobil juga disederhanakan:
tabung "fender" yang membentang penuh sepanjang bodi dihapus (diganti rounded
corner kecil di 4 sudut bawah) karena menambah blob visual tanpa manfaat
kejelasan, dan ditambahkan kaca depan/belakang/samping bertona gelap supaya
bodi mobil tidak terlihat sebagai satu balok datar pastel.

### 2026-07-30 — Palet warna dipertajam & geometry mobil dirombak (screenshot ke-2)
Setelah perbaikan exposure/lighting sebelumnya, screenshot kedua masih
menunjukkan tanah/jalan/tebing terlihat nyaris putih tanpa nuansa warna yang
jelas — karena nilai hex pastel yang dipakai sebelumnya (mis. tanah
`0xd7f5e3`) sudah sangat dekat ke putih secara bawaan, sehingga sedikit saja
pencahayaan langsung mendorongnya melewati ambang putih di tone mapping.
Semua warna tanah/jalan/tebing/daun pohon diganti ke varian pastel yang
lebih pekat (saturasi lebih tinggi, mis. tanah jadi `0xa6e6c3`) supaya tetap
kelihatan sebagai warna, bukan putih, setelah tone mapping. `toneMappingExposure`
diturunkan lagi ke 0.78 dan ambient/hemisphere sedikit dikurangi lagi.

Screenshot yang sama juga menunjukkan bodi mobil punya gumpalan pink besar
menyerupai pontoon di bagian bawah — ternyata dari rounded-corner tube yang
ditambahkan di iterasi sebelumnya (radius 0.5, di posisi hampir sama dengan
roda) yang secara visual menutupi & mendominasi roda asli. Tube itu dihapus,
diganti bumper depan/belakang tipis (radius 0.22) yang jauh lebih halus.
Roda sendiri diperbesar & digeser lebih ke luar bodi (dari x=±1.25 ke
x=±1.42, radius 0.42→0.48) supaya benar-benar menonjol jelas dari siluet
bodi saat dilihat dari belakang/depan (chase cam), plus ditambah hub cap
kecil untuk detail.

### 2026-07-30 — Tombol "Tombol Malas" di layar kunci (menghindar dari kursor)
Ditambahkan tombol dekoratif jahil (`#dodge-btn`) di layar kunci password
yang sengaja tidak pernah bisa diklik: begitu kursor mouse atau jari
mendekat dalam radius ~110px, tombol langsung berpindah ke posisi acak lain
di layar (`initDodgeButton()`). Murni untuk hiburan, tidak terhubung ke
logic unlock (`attemptUnlock`) sama sekali — permintaan pengguna eksplisit
untuk fitur usil yang membuat kesal. Ditangani lewat `mousemove`/`touchstart`
listener terpisah dari input password, dan otomatis ikut memudar/tidak bisa
disentuh begitu `#lock-screen` mendapat class `.hidden` (mewarisi
`opacity`/`pointer-events` dari parent-nya), jadi tidak mengganggu layar
setelah password benar dimasukkan.

### 2026-07-30 — Ukuran dunia: "sedang" (`WORLD_HALF = 220`)
Dikonfirmasi dengan pengguna: dunia terbentang -220..220 pada sumbu x/z,
cukup luas untuk memuat 7 distrik + fitur air + landmark dengan jarak
berkendara yang terasa seimbang — tidak sesempit sehingga terasa sesak, tidak
seluas sehingga jelajahnya kelamaan.
