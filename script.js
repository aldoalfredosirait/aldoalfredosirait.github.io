/* =====================================================================
   JELAJAH KOTA KITA — Simulator Mobil Kenangan 3D
   Three.js r147 (global build, non-module — lihat README.md untuk alasan)
   Satu file classic script (tanpa import/export ES module) supaya bisa
   dibuka langsung lewat file:// tanpa server/build tool.
   ===================================================================== */

// =====================================================================
// SECTION 0 — KONFIGURASI GLOBAL
// =====================================================================

// --- PIN layar kunci (GANTI di sini) ---
const LOCK_PASSWORD = "27012026";
const LOCK_HINT = "tanggal akward";

// --- Nama yang berulang tahun (dipakai di judul surat & baris pembuka di
//     bawah — GANTI di sini kalau suatu saat dipakai utk orang lain) ---
const BIRTHDAY_PERSON_NAME = "Gabriela Oktaviany Sihaloho";

// --- Isi surat ulang tahun (GANTI di sini sesuka hati) ---
const BIRTHDAY_LETTER_LINES = [
  `Happy Birthday, ${BIRTHDAY_PERSON_NAME}! 🎉`,
  "Maaf ya, cuma bisa rayain ini lewat mobil-mobilan kecil yang muter satu kota, bukan meluk kamu langsung. Jarak emang nyebelin.",
  "Tapi walau LDR-an, rasanya nggak pernah kalah jauh sama sayangnya aku ke kamu.",
  "Semoga di sana kamu sehat terus, makin cantik, dan makin sabar hadapin aku yang suka rewel kalau kangen. 😆",
  "Nanti kalau udah ketemu, kita rayain lagi versi yang beneran ya — sampai saat itu, ini dulu surat dari aku, dari jauh. 💌",
  "— Aldo💕",
];

// --- Ukuran dunia ("sedang — seimbang") ---
const WORLD_HALF = 320;           // dunia diperlebar lagi (sebelumnya 220) — dinding bebatuan ikut mengikuti di batas baru ini

// Palet "cute pastel"
const PALETTE = {
  sky: 0x6bbdf2,
  fog: 0xbfe0fa,
  ground: 0x74d69e,
  road: 0x7d6f9e,
  roadLine: 0xffffff,
  water: 0x4fc3e0,
  curbA: 0xffffff,  // curb tikungan — putih
  curbB: 0xff6f8f,  // curb tikungan — merah muda (selang-seling, ala sirkuit balap)
};

// Titik acuan yang masih dipakai di dunia (FINISH sekarang diturunkan dari
// ujung lintasan itu sendiri — lihat FINISH_POINT — bukan koordinat tetap)
const DISTRICT_ANCHORS = {
  danau: { x: 0, z: -150 },
};

// =====================================================================
// SECTION 1 — STATE GLOBAL
// =====================================================================

let scene, camera, renderer, clock;
let carGroup, carState;
let carEnvMap = null; // env map prosedural, dipakai khusus untuk bodi mobil
let unlocked = false;
let cakeTriggered = false;

const RECT_COLLIDERS = [];   // { x, z, w, d, rotY }
const CIRCLE_COLLIDERS = []; // { x, z, r }

const keys = { forward: false, backward: false, left: false, right: false };

const CAM_PRESETS = [
  { name: "Dekat",  dist: 6,  height: 3.0, look: 1.2 },
  { name: "Sedang", dist: 9,  height: 4.6, look: 1.6 },
  { name: "Jauh",   dist: 13, height: 6.6, look: 2.1 },
];
// Default preset kamera: "Sedang" (index 1) untuk desktop, tapi "Jauh"
// (index 2) untuk perangkat sentuh murni tanpa keyboard fisik — deteksi
// pakai `matchMedia('(pointer: coarse)')`, breakpoint yang SAMA persis
// dipakai CSS untuk joystick analog & menyembunyikan HUD di style.css
// (lihat komentar di sana) — permintaan user. Tombol ganti kamera sendiri
// disembunyikan di perangkat ini (lihat style.css), tapi preset default-nya
// tetap perlu diset benar di sini karena tombolnya memang sengaja tidak
// bisa diklik lagi utk mengubahnya di perangkat itu.
let camPresetIndex = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ? 2 : 1;
const camCurrent = new THREE.Vector3();
const camTargetCurrent = new THREE.Vector3();

// =====================================================================
// SECTION 2 — INIT RENDERER / SCENE / KAMERA
// =====================================================================

function initRenderer() {
  const canvas = document.getElementById("app-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.68; // diturunkan lagi supaya warna dunia tidak terlihat terlalu soft (lihat Log Keputusan Desain)
  renderer.outputEncoding = THREE.sRGBEncoding;
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0021); // diturunkan supaya monumen/FINISH tetap terlihat dari jauh di lintasan yang sekarang jauh lebih besar

  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 8, 16);
}

function initProceduralEnvMap() {
  // Gradient DataTexture sederhana sebagai environment map (tanpa file HDR eksternal)
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const top = new THREE.Color(0xfff2f8);
  const bottom = new THREE.Color(0xd9c9ff);
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const c = top.clone().lerp(bottom, t);
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = c.r * 255;
      data[i + 1] = c.g * 255;
      data[i + 2] = c.b * 255;
      data[i + 3] = 255;
    }
  }
  const gradientTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  gradientTex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(gradientTex);
  // Env map SENGAJA tidak dipasang ke scene.environment (itu akan membuat SEMUA
  // material — tanah, bangunan, pohon — ikut memantulkan gradient ini dan
  // membuat seluruh dunia terlihat pudar/putih). Env map hanya dipakai untuk
  // bodi mobil yang mengkilap (lihat buildCar()). Lihat Log Keputusan Desain.
  carEnvMap = envRT.texture;
  gradientTex.dispose();
  pmrem.dispose();
}

function initLights() {
  const ambient = new THREE.AmbientLight(0xfff8ea, 0.16);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xaee0ff, 0xcdeedd, 0.22);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff6da, 1.25);
  sun.position.set(80, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -200;
  sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200;
  sun.shadow.camera.bottom = -200;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0xcfe8ff, 0.11);
  fill.position.set(-60, 40, -60);
  scene.add(fill);

  // --- Matahari yang terlihat di langit (bola emissive + glow lembut) ---
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(14, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4 })
  );
  sunDisc.position.copy(sun.position).multiplyScalar(4.2);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(24, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.28 })
  );
  sunGlow.position.copy(sunDisc.position);
  scene.add(sunGlow);
}

function buildGround() {
  const groundGeo = new THREE.PlaneGeometry(WORLD_HALF * 2.4, WORLD_HALF * 2.4, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

// =====================================================================
// SECTION 3 — UTILITAS COLLIDER & PENEMPATAN ACAK
// =====================================================================
// (Factory bangunan distrik & seluruh bangunannya DIHAPUS sesuai
// permintaan user — dunia sekarang murni sirkuit balap + dekorasi, tanpa
// bangunan kota. Lihat Log Keputusan Desain.)

function addRectCollider(x, z, w, d, rotY) {
  RECT_COLLIDERS.push({ x, z, w, d, rotY: rotY || 0 });
}

// --- Cari titik acak di peta yang bebas dari collider (air, dekorasi, dsb)
// dan tidak terlalu dekat titik tengah peta — dipakai untuk sebaran
// billboard & hewan supaya tidak nyangkut di air/dekorasi lain. ---
function findClearRandomSpot(margin, maxAttempts) {
  margin = margin || 5;
  maxAttempts = maxAttempts || 30;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = (Math.random() * 2 - 1) * (WORLD_HALF - 25);
    const z = (Math.random() * 2 - 1) * (WORLD_HALF - 25);
    if (Math.hypot(x, z) < 22) continue; // hindari titik tengah peta
    if (typeof distanceToTrack === "function" && distanceToTrack(x, z) < TRACK_HALF_WIDTH + 9) continue; // hindari lintasan
    let clear = true;
    for (const c of CIRCLE_COLLIDERS) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + margin) { clear = false; break; }
    }
    if (clear) {
      for (const r of RECT_COLLIDERS) {
        if (Math.hypot(x - r.x, z - r.z) < Math.max(r.w, r.d) + margin) { clear = false; break; }
      }
    }
    if (clear) return { x, z };
  }
  return null;
}

// =====================================================================
// SECTION 4 — LINTASAN SIRKUIT BALAP (SATU-SATUNYA JALAN DI DUNIA INI)
// =====================================================================

function addRoadSegment(x1, z1, x2, z2, width) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 1 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(width, len), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = -angle;
  road.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
  road.receiveShadow = true;
  scene.add(road);

  // marka tepi
  const edgeMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  [-1, 1].forEach((side) => {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.4, len), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.rotation.z = -angle;
    const nx = Math.cos(angle) * (width / 2 - 0.2) * side;
    const nz = -Math.sin(angle) * (width / 2 - 0.2) * side;
    edge.position.set((x1 + x2) / 2 + nx, 0.03, (z1 + z2) / 2 + nz);
    scene.add(edge);
  });

  // marka tengah putus-putus
  const dashLen = 2.2, gap = 2.2;
  const count = Math.floor(len / (dashLen + gap));
  for (let i = 0; i < count; i++) {
    const t = (i * (dashLen + gap) + dashLen / 2) / len;
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, dashLen), edgeMat);
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = -angle;
    dash.position.set(x1 + dx * t, 0.03, z1 + dz * t);
    scene.add(dash);
  }
}

// --- SATU sirkuit balap besar berbentuk OVAL/STADION (dua lintasan lurus
// panjang + dua tikungan setengah-lingkaran) — bentuk CEMBUNG (convex)
// yang sengaja dipilih ketimbang rute zigzag yang lebih dulu dipakai: pada
// rute zigzag, titik di tengah peta kadang lebih dekat secara garis lurus
// ke segmen yang jauh/tidak berdekatan di jalur, sehingga koridor collision
// (applyRouteLock, dicari berdasar "segmen terdekat") bisa "salah pilih"
// segmen acuan dan membuat mobil terlihat terlempar jauh dari aspal yang
// terlihat di depan mata. Bentuk oval cembung ini jauh lebih aman dari
// ambiguitas itu. Titik-titik ini dipakai bersama oleh buildRaceTrack()
// (aspal) dan applyRouteLock() (koridor mobil) — satu sumber data supaya
// jalan yang terlihat & koridor collision selalu selaras persis. Lintasan
// menyimpang lewat satu spur pendek di ujung menuju monumen ulang tahun
// (titik FINISH) — lihat Log Keputusan Desain. ---
const TRACK_L = 120;    // panjang separuh lintasan lurus
const TRACK_R = 90;     // radius tikungan setengah-lingkaran di kedua ujung
const TRACK_ARC_STEPS = 40; // dinaikkan jauh (dari 16) supaya tikungan terlihat melengkung mulus, bukan patah-patah bersudut
// Tikungan kiri SENGAJA tidak diteruskan sampai penuh 180° — lintasan
// cukup berhenti di titik ini, dan titik BERHENTI itu sendiri yang jadi
// FINISH (bukan menyimpang lewat spur terpisah ke koordinat lain). Jadi
// dijamin SELALU ada aspal tersambung persis sampai ke monumen — tidak
// mungkin lagi "tidak ada jalan menuju finish" seperti sebelumnya, karena
// finish-nya sendiri adalah ujung aspal itu. Lihat Log Keputusan Desain.
const TRACK_FINISH_ARC_FRACTION = 5 / 6;
const TRACK_FINISH_ARC_STEPS = Math.round(TRACK_ARC_STEPS * TRACK_FINISH_ARC_FRACTION);

function buildOvalTrackWaypoints() {
  const L = TRACK_L, R = TRACK_R, ARC_STEPS = TRACK_ARC_STEPS;
  const points = [];

  // START — ujung kiri-bawah lintasan lurus bawah
  points.push({ x: -L, z: -R });
  // Lintasan lurus BAWAH (kiri -> kanan)
  points.push({ x: L, z: -R });
  // Tikungan KANAN (setengah lingkaran, pusat (L,0)), dari bawah ke atas lewat sisi kanan jauh
  for (let i = 1; i <= ARC_STEPS; i++) {
    const a = -Math.PI / 2 + (i / ARC_STEPS) * Math.PI;
    points.push({ x: L + R * Math.cos(a), z: R * Math.sin(a) });
  }
  // Lintasan lurus ATAS (kanan -> kiri)
  points.push({ x: -L, z: R });
  // Tikungan KIRI, berhenti di TRACK_FINISH_ARC_FRACTION (5/6) — titik
  // berhenti terakhir inilah yang jadi FINISH.
  for (let i = 1; i <= TRACK_FINISH_ARC_STEPS; i++) {
    const a = Math.PI / 2 + (i / ARC_STEPS) * Math.PI;
    points.push({ x: -L + R * Math.cos(a), z: R * Math.sin(a) });
  }

  return points;
}

const TRACK_WAYPOINTS = buildOvalTrackWaypoints();
const TRACK_WIDTH = 14; // jalan besar/lebar, sesuai permintaan "panjang dan besar"
// Titik FINISH = titik terakhir lintasan itu sendiri (lihat komentar di atas).
const FINISH_POINT = TRACK_WAYPOINTS[TRACK_WAYPOINTS.length - 1];

function buildRaceTrack() {
  const cornerMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 1 });
  for (let i = 0; i < TRACK_WAYPOINTS.length - 1; i++) {
    const p1 = TRACK_WAYPOINTS[i], p2 = TRACK_WAYPOINTS[i + 1];
    addRoadSegment(p1.x, p1.z, p2.x, p2.z, TRACK_WIDTH);
  }
  // Tambalan bundar di tiap tikungan supaya jalan menyambung mulus tanpa
  // celah segitiga di sisi luar belokan (segmen lurus bertemu di sudut).
  for (let i = 1; i < TRACK_WAYPOINTS.length - 1; i++) {
    const p = TRACK_WAYPOINTS[i];
    const patch = new THREE.Mesh(new THREE.CircleGeometry(TRACK_WIDTH / 2, 20), cornerMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(p.x, 0.021, p.z);
    patch.receiveShadow = true;
    scene.add(patch);
  }

  buildCurbs();
  buildStartFinishLines();
  buildRaceGates();
}

// --- Curb (kerb) merah-putih selang-seling di kedua tikungan — "perbagus
// lintasan" ala sirkuit balap sungguhan, ditempel di tepi luar tiap
// tikungan supaya tikungannya terlihat jelas & lebih meriah. ---
function buildCurbs() {
  const halfW = TRACK_WIDTH / 2;
  const curbLen = 3.4;
  const curbOut = halfW + 0.5;

  function placeCurbArc(startIdx, endIdx, center) {
    for (let i = startIdx; i <= endIdx; i++) {
      const p = TRACK_WAYPOINTS[i];
      const outX = p.x - center.x, outZ = p.z - center.z;
      const outLen = Math.hypot(outX, outZ) || 1;
      const nx = outX / outLen, nz = outZ / outLen;
      const cx = p.x + nx * curbOut, cz = p.z + nz * curbOut;
      const tangentAngle = Math.atan2(-nz, nx); // tegak lurus arah keluar (normal)
      const color = i % 2 === 0 ? PALETTE.curbA : PALETTE.curbB;
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(curbLen, 0.28, 1.1),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
      );
      curb.position.set(cx, 0.14, cz);
      curb.rotation.y = tangentAngle;
      curb.castShadow = true;
      curb.receiveShadow = true;
      scene.add(curb);
    }
  }

  const rightArcStart = 2, rightArcEnd = rightArcStart + TRACK_ARC_STEPS - 1;
  const leftArcStart = rightArcEnd + 2, leftArcEnd = leftArcStart + TRACK_FINISH_ARC_STEPS - 1;
  placeCurbArc(rightArcStart, rightArcEnd, { x: TRACK_L, z: 0 });
  placeCurbArc(leftArcStart, leftArcEnd, { x: -TRACK_L, z: 0 });
}

// --- Garis kotak-kotak START & FINISH digambar langsung di aspal, ala
// sirkuit balap sungguhan (bukan cuma banner di atas). ---
function makeCheckerTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const n = 8;
  const cell = canvas.width / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#ffffff" : "#4a4056";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 4);
  return tex;
}

function buildStartFinishLine(x, z, angle) {
  const mat = new THREE.MeshStandardMaterial({ map: makeCheckerTexture(), roughness: 0.6 });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_WIDTH - 0.6, 3), mat);
  line.rotation.x = -Math.PI / 2;
  line.rotation.z = -angle;
  line.position.set(x, 0.025, z);
  line.receiveShadow = true;
  scene.add(line);
}

function buildStartFinishLines() {
  const p0 = TRACK_WAYPOINTS[0], p1 = TRACK_WAYPOINTS[1];
  const startAngle = Math.atan2(p1.x - p0.x, p1.z - p0.z);
  buildStartFinishLine(p0.x, p0.z, startAngle);

  const pPrev = TRACK_WAYPOINTS[TRACK_WAYPOINTS.length - 2];
  const pLast = TRACK_WAYPOINTS[TRACK_WAYPOINTS.length - 1];
  const finishAngle = Math.atan2(pLast.x - pPrev.x, pLast.z - pPrev.z);
  const finishDirX = Math.sin(finishAngle), finishDirZ = Math.cos(finishAngle);
  buildStartFinishLine(pLast.x - finishDirX * 6, pLast.z - finishDirZ * 6, finishAngle);
}

// --- Gerbang START (di awal sirkuit) & FINISH (tepat sebelum monumen
// ulang tahun) — banner kain bertuliskan teks lewat canvas texture. ---
function makeBannerTexture(text, bg) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  // motif kotak-kotak ala bendera balap di kedua ujung
  const checkSize = 16;
  ctx.fillStyle = "#ffffff";
  for (let row = 0; row < 128 / checkSize; row++) {
    for (let col = 0; col < 3; col++) {
      if ((row + col) % 2 === 0) {
        ctx.fillRect(col * checkSize, row * checkSize, checkSize, checkSize);
        ctx.fillRect(512 - (col + 1) * checkSize, row * checkSize, checkSize, checkSize);
      }
    }
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 66);
  return new THREE.CanvasTexture(canvas);
}

// --- Utilitas bersama dipakai SEMUA banner teks kanvas yang teksnya bisa
// panjang/berubah (banner "HAPPY BIRTHDAY" di monumen & baliho pesawat di
// bawah): kecilkan font-size bertahap dari initialSize sampai lebar teks
// (dihitung lewat callback `measureWidth`, dipanggil ulang tiap ctx.font
// berganti) muat dalam `maxWidth` piksel. Tanpa ini, font-size yang
// dikunci mati bisa melebihi lebar kanvas & tulisannya terpotong di kedua
// ujung — apalagi karena font 'Baloo 2' dimuat dari Google Fonts (lihat
// @import di style.css) dan bisa diam-diam jatuh ke fallback 'sans-serif'
// yang jauh lebih lebar kalau gagal/telat dimuat (mis. index.html dibuka
// offline lewat file://, sesuai Cara Pakai README). Lihat Log Keputusan
// Desain untuk kronologi bug ini. ---
function shrinkFontToFit(ctx, fontSpec, initialSize, maxWidth, measureWidth, minSize) {
  minSize = minSize || 40;
  let size = initialSize;
  while (size > minSize) {
    ctx.font = fontSpec(size);
    if (measureWidth() <= maxWidth) break;
    size -= 6;
  }
  return size;
}

function buildRaceGate(x, z, angle, text, bg) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const poleGeo = new THREE.CylinderGeometry(0.28, 0.32, 6.5, 10);
  const pole1 = new THREE.Mesh(poleGeo, poleMat);
  pole1.position.set(-6.2, 3.25, 0);
  const pole2 = new THREE.Mesh(poleGeo, poleMat);
  pole2.position.set(6.2, 3.25, 0);
  const bannerMat = new THREE.MeshStandardMaterial({ map: makeBannerTexture(text, bg), roughness: 0.7, side: THREE.DoubleSide });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 3.2), bannerMat);
  banner.position.set(0, 5.4, 0);
  group.add(pole1, pole2, banner);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.position.set(x, 0, z);
  // + Math.PI supaya sisi DEPAN banner (bacaan benar, tidak cermin)
  // menghadap ke arah mobil DATANG, bukan ke arah mobil PERGI — lihat Log
  // Keputusan Desain (bug tulisan terbalik pada gerbang sebelumnya).
  group.rotation.y = angle + Math.PI;
  scene.add(group);
}

function buildRaceGates() {
  const p0 = TRACK_WAYPOINTS[0], p1 = TRACK_WAYPOINTS[1];
  const startAngle = Math.atan2(p1.x - p0.x, p1.z - p0.z);
  const startDirX = Math.sin(startAngle), startDirZ = Math.cos(startAngle);
  buildRaceGate(p0.x + startDirX * 9, p0.z + startDirZ * 9, startAngle, "START", "#ff8fb8");

  const pPrev = TRACK_WAYPOINTS[TRACK_WAYPOINTS.length - 2];
  const pLast = TRACK_WAYPOINTS[TRACK_WAYPOINTS.length - 1];
  const finishAngle = Math.atan2(pLast.x - pPrev.x, pLast.z - pPrev.z);
  const finishDirX = Math.sin(finishAngle), finishDirZ = Math.cos(finishAngle);
  const segDist = Math.hypot(pLast.x - pPrev.x, pLast.z - pPrev.z);
  const gateBackDist = Math.min(17, segDist - 3);
  buildRaceGate(
    pLast.x - finishDirX * gateBackDist,
    pLast.z - finishDirZ * gateBackDist,
    finishAngle, "FINISH", "#b6e3f2"
  );
}

// =====================================================================
// SECTION 5 — AIR (DANAU & PANTAI) & DEKORASI KECIL
// =====================================================================

function buildWater() {
  const waterMat = new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.92 });

  // --- Danau ---
  const danau = DISTRICT_ANCHORS.danau;
  const lakeR = 42;
  const lake = new THREE.Mesh(new THREE.CircleGeometry(lakeR, 32), waterMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(danau.x, 0.05, danau.z);
  scene.add(lake);
  CIRCLE_COLLIDERS.push({ x: danau.x, z: danau.z, r: lakeR + 2 });

  // --- Pantai / laut (tepi selatan dunia) ---
  const beachZ = WORLD_HALF - 40; // ikut menyesuaikan kalau dunia diperlebar
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(340, 60), waterMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.03, beachZ + 20);
  scene.add(beach);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(340, 22),
    new THREE.MeshStandardMaterial({ color: 0xffe9c9, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.025, beachZ - 3);
  scene.add(sand);
  for (let x = -170; x <= 170; x += 20) {
    CIRCLE_COLLIDERS.push({ x, z: beachZ + 5, r: 16 });
  }
}

// =====================================================================
// SECTION 5B — DINDING BEBATUAN DI BATAS DUNIA
// =====================================================================
// Permintaan user: dinding bebatuan di setiap sisi/ujung area supaya mobil
// tidak bisa melewatinya. `resolveCollisions()` sudah menjepit posisi
// mobil dalam kotak persegi ±(WORLD_HALF-4) — dinding ini dipasang tepat
// di garis batas itu (InstancedMesh, murni geometry primitif) supaya
// batasnya juga TERLIHAT sebagai dinding sungguhan, bukan cuma dinding
// tak kasat mata.

function buildBoundaryWalls() {
  const ROCKS_PER_SIDE = 66; // dinaikkan sebanding dengan pelebaran dunia, supaya kepadatan dinding tetap konsisten
  const count = ROCKS_PER_SIDE * 4;
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xa8789e, roughness: 0.95, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const B = WORLD_HALF;
  let idx = 0;

  function placeRock(x, z) {
    const scale = 7 + Math.random() * 9;
    dummy.position.set(x, scale * 0.42, z);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    dummy.scale.set(scale, scale * (0.9 + Math.random() * 0.4), scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(idx, dummy.matrix);
    idx++;
  }

  for (let i = 0; i < ROCKS_PER_SIDE; i++) {
    const t = (i / (ROCKS_PER_SIDE - 1)) * 2 - 1; // -1..1 sepanjang sisi
    const jitter = (Math.random() - 0.5) * 9;
    placeRock(t * B + jitter, -B + jitter * 0.4); // sisi Z negatif
    placeRock(t * B + jitter, B + jitter * 0.4);  // sisi Z positif
    placeRock(-B + jitter * 0.4, t * B + jitter); // sisi X negatif
    placeRock(B + jitter * 0.4, t * B + jitter);  // sisi X positif
  }

  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}

// =====================================================================
// SECTION 8 — MONUMEN ULANG TAHUN DI GARIS FINISH
// =====================================================================
// Permintaan user: monumen megah & meriah bertema ulang tahun di ujung
// lintasan (garis finish), lengkap animasi & petasan. Semua dari geometry
// primitif — gapura 10 pilar + kubah, kue bertingkat + lilin berkedip,
// banyak balon mengambang, bunting melengkung, banner "HAPPY BIRTHDAY",
// serta pesta kembang api saat mobil tiba di titik ini.

let landmarkCenter;
const CAKE_TRIGGER_RADIUS = 16;
const landmarkBalloons = []; // { mesh, baseY, phase }
const landmarkFlags = [];    // { mesh, phase }
const candleFlames = [];     // { mesh, phase }
const landmarkSparkles = []; // { mesh, phase, speed } — kerlap-kerlip ambient
const crowdPeople = []; // { group, phase } — kerumunan orang di sekeliling menara & tersebar di kota

// --- Karakter orang 3D yang lebih jelas menyerupai manusia (kaki, badan/
// baju, kepala, rambut, tangan) — dipakai bersama untuk kerumunan di
// monumen MAUPUN orang-orang yang tersebar di luar lintasan. ---
function buildPersonNPC(x, z) {
  const shirtColors = [0xff8fb8, 0xb6e3f2, 0xfff2a8, 0xd9c9ff, 0xffb066, 0xa8e6cf, 0xff6f9f, 0x8fd0f7];
  const pantsColors = [0x5a4a6e, 0x3a5a7e, 0x7a5a4a, 0x4a4a5a, 0x8a6a9e];
  const hairColors = [0x3a2a2a, 0x6a4a2a, 0x2a2a2a, 0xc9a878, 0x8a4a2a, 0xff8fb8];
  const skinColors = [0xffd9b3, 0xe8b088, 0xc98a5c, 0xfff0e0];

  const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
  const pantsColor = pantsColors[Math.floor(Math.random() * pantsColors.length)];
  const hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];
  const skinColor = skinColors[Math.floor(Math.random() * skinColors.length)];

  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 });

  // kaki
  const legGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.62, 8);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.13, 0.31, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.13, 0.31, 0);
  // sepatu kecil
  const shoeGeo = new THREE.BoxGeometry(0.16, 0.12, 0.26);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3a2f38, roughness: 0.7 });
  const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
  shoeL.position.set(-0.13, 0.06, 0.04);
  const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
  shoeR.position.set(0.13, 0.06, 0.04);

  // badan/baju
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.62, 10), shirtMat);
  torso.position.y = 0.94;

  // leher & kepala
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8), skinMat);
  neck.position.y = 1.29;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), skinMat);
  head.position.y = 1.5;
  // rambut
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.8 });
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.7), hairMat);
  hair.position.y = 1.57;

  // lengan & tangan
  const armGeo = new THREE.CylinderGeometry(0.07, 0.075, 0.55, 8);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.33, 1.0, 0);
  armL.rotation.z = 0.18;
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.33, 1.0, 0);
  armR.rotation.z = -0.18;
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skinMat);
  handL.position.set(-0.38, 0.73, 0);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skinMat);
  handR.position.set(0.38, 0.73, 0);

  group.add(legL, legR, shoeL, shoeR, torso, neck, head, hair, armL, armR, handL, handR);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  return group;
}

let landmarkLight;
let nextAmbientFireworkAt = 4; // detik — kembang api ambient berkala walau mobil belum sampai

function makeColorfulTextTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048; canvas.height = 460;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 2048, 460);
  const colors = ["#ff6f9f", "#ffd166", "#ffffff", "#8fd0f7", "#c9a8ff"];

  // Font-size mulai dari 260px (ukuran "sangat besar" sesuai permintaan
  // user sebelumnya) tapi otomatis diperkecil kalau perlu supaya SELALU
  // muat dalam lebar kanvas dengan margin ~6% tiap sisi — sebelumnya
  // ukurannya dikunci mati 260px tanpa pengecekan lebar sama sekali,
  // itulah sebabnya tulisannya bisa terpotong di kedua ujung. Widths
  // per-huruf dihitung ulang tiap kali shrinkFontToFit mencoba font-size
  // baru (lewat closure di bawah) supaya hasil akhirnya presis dipakai
  // saat menggambar. Lihat shrinkFontToFit() & Log Keputusan Desain.
  const fontSpec = (sz) => `900 ${sz}px 'Baloo 2', sans-serif`;
  let widths = [];
  const fontSizeUsed = shrinkFontToFit(ctx, fontSpec, 260, canvas.width * 0.88, () => {
    widths = [...text].map((ch) => ctx.measureText(ch).width);
    return widths.reduce((a, b) => a + b, 0);
  }, 90);
  const total = widths.reduce((a, b) => a + b, 0);

  ctx.textBaseline = "middle";
  let x = (canvas.width - total) / 2;
  let ci = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== " ") {
      ctx.fillStyle = colors[ci % colors.length];
      ctx.strokeStyle = "rgba(122, 90, 110, 0.55)";
      ctx.lineWidth = Math.max(4, fontSizeUsed / 26); // stroke ikut menyesuaikan proporsional kalau font mengecil
      ctx.textAlign = "left";
      ctx.strokeText(ch, x, 236);
      ctx.fillText(ch, x, 236);
      ci++;
    }
    x += widths[i];
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function buildLandmark() {
  const a = FINISH_POINT;
  landmarkCenter = new THREE.Vector3(a.x, 0, a.z);
  const PLAZA_R = 24; // "megah" — plaza sedikit diperlebar lagi mengikuti istana baru

  const plazaFloor = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA_R, PLAZA_R, 0.15, 36),
    new THREE.MeshStandardMaterial({ color: 0xffc2dc, roughness: 0.9 }));
  plazaFloor.position.set(a.x, 0.05, a.z);
  plazaFloor.receiveShadow = true;
  scene.add(plazaFloor);
  // Plaza SENGAJA tidak diberi collider apa pun — supaya monumen ulang
  // tahun benar-benar mudah & bebas diakses langsung oleh mobil.

  // --- Variabel bersama yang masih dipakai dekorasi lain di bawah (pelangi,
  // pohon cemara, buket balon, dsb). Gapura gazebo kecil versi lama SUDAH
  // DIHAPUS di sini — digantikan total oleh istana lebar di bawah, supaya
  // tidak ada dua struktur bertumpuk/berbenturan di titik yang sama. ---
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 });
  const pillarR = PLAZA_R * 0.6;

  // --- Pelangi besar di belakang gapura, ala referensi ---
  const rainbowColors = [0xff8fb8, 0xffffff, 0xffd166, 0xb6e3f2];
  const rainbowGroup = new THREE.Group();
  rainbowColors.forEach((color, i) => {
    const r = pillarR + 6 - i * 1.1;
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.55, 10, 28, Math.PI),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
    );
    arc.rotation.z = Math.PI;
    arc.position.y = 0.1;
    rainbowGroup.add(arc);
  });
  rainbowGroup.position.set(a.x, 0, a.z - pillarR * 0.15);
  scene.add(rainbowGroup);

  // --- Pohon cemara pink dekoratif, mengapit plaza ala referensi ---
  const pineColors = [0xff8fb8, 0xffb3cf];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.3;
    const r = PLAZA_R + 4 + Math.random() * 4;
    const px = a.x + Math.cos(ang) * r, pz = a.z + Math.sin(ang) * r;
    const pine = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.8 }));
    trunk.position.y = 0.4;
    const tiers = 3;
    for (let t = 0; t < tiers; t++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3 - t * 0.32, 1.5, 10),
        new THREE.MeshStandardMaterial({ color: pineColors[i % 2], roughness: 0.6 }));
      cone.position.y = 0.9 + t * 1.0;
      pine.add(cone);
    }
    pine.add(trunk);
    pine.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    pine.position.set(px, 0, pz);
    pine.scale.setScalar(1.2 + Math.random() * 0.6);
    scene.add(pine);
  }

  // --- Buket balon di atas tongkat, berjajar dekat gapura ---
  const bouquetColors = [0xff8fb8, 0xfff2a8, 0xd9c9ff, 0xffffff, 0xb6e3f2];
  [-1, 1].forEach((side) => {
    const bx = a.x + side * (pillarR + 3);
    const bz = a.z + pillarR * 0.4;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
    stick.position.set(bx, 1.6, bz);
    stick.castShadow = true;
    scene.add(stick);
    for (let i = 0; i < 7; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.55;
      const color = bouquetColors[i % bouquetColors.length];
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.42 + Math.random() * 0.15, 10, 10),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
      const baseY = 3.3 + Math.random() * 0.9;
      balloon.position.set(bx + Math.cos(ang) * r, baseY, bz + Math.sin(ang) * r);
      balloon.castShadow = true;
      scene.add(balloon);
      landmarkBalloons.push({ mesh: balloon, baseY, phase: Math.random() * Math.PI * 2 });
    }
  });

  // --- Banner besar "HAPPY BIRTHDAY" berdiri di depan gapura, diposisikan
  // & dihadapkan mengikuti arah datang mobil yang sesungguhnya (segmen
  // terakhir lintasan menuju FINISH) — lihat Log Keputusan Desain soal
  // bug tulisan gerbang yang pernah terbalik karena arah banner keliru.
  // Diperbesar SANGAT BESAR sesuai permintaan user, dan materialnya
  // sengaja MeshBasicMaterial (unlit) — sama seperti perbaikan billboard
  // foto — supaya tulisannya selalu terang & jelas terbaca apa pun arah
  // cahaya mataharinya. ---
  const bannerTex = makeColorfulTextTexture("HAPPY BIRTHDAY");
  const bannerMatFront = new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true, toneMapped: false });
  const bannerMatBack = new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true, toneMapped: false });
  const bannerGroup = new THREE.Group();
  const bp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 11, 10), pillarMat);
  bp1.position.set(-15, 5.5, 0);
  const bp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 11, 10), pillarMat);
  bp2.position.set(15, 5.5, 0);
  // Dua mesh terpisah (bukan satu plane DoubleSide) — supaya sisi belakang
  // TIDAK tercermin, sama seperti perbaikan billboard foto sebelumnya.
  const bannerFront = new THREE.Mesh(new THREE.PlaneGeometry(32, 7.2), bannerMatFront);
  bannerFront.position.set(0, 10, 0.05);
  const bannerBack = new THREE.Mesh(new THREE.PlaneGeometry(32, 7.2), bannerMatBack);
  bannerBack.position.set(0, 10, -0.05);
  bannerBack.rotation.y = Math.PI;
  bannerGroup.add(bp1, bp2, bannerFront, bannerBack);
  bannerGroup.traverse((o) => { if (o.isMesh && o !== bannerFront && o !== bannerBack) o.castShadow = true; });

  const pPrev = TRACK_WAYPOINTS[TRACK_WAYPOINTS.length - 2];
  const approachAngle = Math.atan2(a.x - pPrev.x, a.z - pPrev.z);
  const approachDirX = Math.sin(approachAngle), approachDirZ = Math.cos(approachAngle);
  bannerGroup.position.set(a.x - approachDirX * (PLAZA_R + 6), 0, a.z - approachDirZ * (PLAZA_R + 6));
  bannerGroup.rotation.y = approachAngle + Math.PI; // sisi depan menghadap balik ke arah mobil datang
  scene.add(bannerGroup);

  // --- Balon-balon banyak, mengambang — radiusnya sengaja di LUAR badan
  // istana (radius ~15-17.5) supaya tidak "terkubur" di dalam gedung. ---
  const balloonColors = [0xff8fb8, 0xb6e3f2, 0xfff2a8, 0xd9c9ff, 0xffffff, 0xffc27a];
  for (let i = 0; i < 32; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 19 + Math.random() * 9;
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.25, 10, 10),
      new THREE.MeshStandardMaterial({ color: balloonColors[i % balloonColors.length], roughness: 0.4 }));
    const baseY = 3.2 + Math.random() * 6;
    balloon.position.set(a.x + Math.cos(ang) * r, baseY, a.z + Math.sin(ang) * r);
    balloon.castShadow = true;
    scene.add(balloon);
    landmarkBalloons.push({ mesh: balloon, baseY, phase: Math.random() * Math.PI * 2 });
  }

  // --- Kue ulang tahun besar di tengah ---
  const cake = new THREE.Group();
  const tierColors = [0xffe1ee, 0xffc6dd, 0xffffff];
  const tierSizes = [[2.8, 1.15], [2.0, 0.95], [1.25, 0.7]];
  let cakeY = 0;
  tierSizes.forEach(([r, h], i) => {
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 26),
      new THREE.MeshStandardMaterial({ color: tierColors[i], roughness: 0.7 }));
    tier.position.y = cakeY + h / 2;
    tier.castShadow = true;
    cake.add(tier);
    cakeY += h;
  });
  const candleColors = [0xff8fb8, 0xb6e3f2, 0xfff2a8];
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6),
      new THREE.MeshStandardMaterial({ color: candleColors[i % candleColors.length] }));
    candle.position.set(Math.cos(ang) * 0.6, cakeY + 0.22, Math.sin(ang) * 0.6);
    cake.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffaa33, emissiveIntensity: 1.4 }));
    flame.position.set(candle.position.x, cakeY + 0.48, candle.position.z);
    cake.add(flame);
    candleFlames.push({ mesh: flame, phase: Math.random() * Math.PI * 2 });
  }
  // Kue diposisikan di depan pintu masuk istana (bukan lagi persis di
  // tengah) — karena badan istana yang baru sekarang solid mengisi radius
  // ~15 unit dari pusat, kue akan "terkubur" di dalam gedung kalau
  // dibiarkan di titik pusat seperti versi sebelumnya.
  cake.position.set(a.x - approachDirX * 19, 0.3, a.z - approachDirZ * 19);
  scene.add(cake);

  // --- ISTANA LEBAR sebagai pusat monumen — sengaja LEBAR (bukan menara
  // tunggal menjulang seperti versi sebelumnya) supaya beda gaya secara
  // jelas dari 30 "gedung besar" biasa di kota yang berbentuk kotak biasa.
  // Bentuknya: rotunda bundar besar + kubah raksasa + 4 menara kecil di
  // penjuru + pilar depan, dihias pernak-pernik ulang tahun kawaii
  // warna-warni. ---
  const palaceGroup = new THREE.Group();
  const R_MAIN = 15;   // radius badan istana — jauh lebih LEBAR daripada tinggi
  const H_MAIN = 13;   // tinggi badan utama — sengaja rendah, kesan "lebar"
  const palaceColors = [0xffb6c9, 0xd9c9ff, 0xb6e3f2, 0xfff2a8, 0xffd6a8];
  const mainColor = palaceColors[0];

  // Badan utama (rotunda bundar lebar)
  const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(R_MAIN, R_MAIN * 1.08, H_MAIN, 28),
    new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.5, metalness: 0.08 }));
  rotunda.position.y = H_MAIN / 2;
  palaceGroup.add(rotunda);
  // pita putih di bawah atap rotunda
  const rotundaCap = new THREE.Mesh(new THREE.CylinderGeometry(R_MAIN * 1.1, R_MAIN * 1.1, 0.9, 28),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  rotundaCap.position.y = H_MAIN;
  palaceGroup.add(rotundaCap);
  // garis-garis lantai berwarna, sekeliling badan (bukan cuma putih polos)
  for (let f = 1; f <= 2; f++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R_MAIN * 1.01, R_MAIN * 1.06, 0.5, 28),
      new THREE.MeshStandardMaterial({ color: palaceColors[f % palaceColors.length], roughness: 0.5, transparent: true, opacity: 0.75 }));
    band.position.y = (H_MAIN / 3) * f;
    palaceGroup.add(band);
  }
  // pilar-pilar besar mengelilingi rotunda (kesan istana, bukan gedung kotak)
  const pillarBigMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
  const bigPillarCount = 16;
  for (let i = 0; i < bigPillarCount; i++) {
    const ang = (i / bigPillarCount) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, H_MAIN * 0.92, 10), pillarBigMat);
    pillar.position.set(Math.cos(ang) * (R_MAIN + 0.6), H_MAIN * 0.46, Math.sin(ang) * (R_MAIN + 0.6));
    palaceGroup.add(pillar);
  }
  // jendela-jendela besar melingkar
  const bigWinMat = new THREE.MeshStandardMaterial({ color: 0xfff7fb, roughness: 0.25, metalness: 0.3 });
  const bigWinCount = 16;
  for (let i = 0; i < bigWinCount; i++) {
    const ang = ((i + 0.5) / bigWinCount) * Math.PI * 2;
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.2, 0.2), bigWinMat);
    win.position.set(Math.cos(ang) * (R_MAIN + 0.05), H_MAIN * 0.5, Math.sin(ang) * (R_MAIN + 0.05));
    win.rotation.y = -ang;
    palaceGroup.add(win);
  }

  // Kubah raksasa di tengah — pusat perhatian, bukan menara tinggi
  const palaceDome = new THREE.Mesh(new THREE.SphereGeometry(R_MAIN * 0.72, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.15 }));
  palaceDome.position.y = H_MAIN;
  palaceGroup.add(palaceDome);
  // puncak kubah ala cupcake topper raksasa bercahaya
  const domeTop = new THREE.Group();
  const topperBase = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.4, 16),
    new THREE.MeshStandardMaterial({ color: 0xffb6c9, roughness: 0.5 }));
  topperBase.position.y = H_MAIN + R_MAIN * 0.72 + 1.7;
  const topperStar = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 4),
    new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffcc55, emissiveIntensity: 0.7 }));
  topperStar.position.y = H_MAIN + R_MAIN * 0.72 + 4.4;
  domeTop.add(topperBase, topperStar);
  palaceGroup.add(domeTop);

  // 4 menara kecil di penjuru — menegaskan kesan "istana lebar" (bukan
  // satu menara tunggal menjulang) ---
  const turretColors = [0xb6e3f2, 0xd9c9ff, 0xfff2a8, 0xffd6a8];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const tx = Math.cos(ang) * (R_MAIN * 0.98);
    const tz = Math.sin(ang) * (R_MAIN * 0.98);
    const turretH = H_MAIN * 1.45;
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, turretH, 14),
      new THREE.MeshStandardMaterial({ color: turretColors[i], roughness: 0.5 }));
    turret.position.set(tx, turretH / 2, tz);
    const turretRoof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 3.2, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    turretRoof.position.set(tx, turretH + 1.6, tz);
    palaceGroup.add(turret, turretRoof);
    // lampion kecil emissive di puncak tiap menara
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10),
      new THREE.MeshStandardMaterial({ color: turretColors[(i + 2) % 4], emissive: turretColors[(i + 2) % 4], emissiveIntensity: 0.6 }));
    lantern.position.set(tx, turretH + 3.4, tz);
    palaceGroup.add(lantern);
  }

  // pita besar (ribbon+bow) melilit rotunda, ala kado ulang tahun raksasa
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xff6f9f, roughness: 0.45 });
  const ribbonV = new THREE.Mesh(new THREE.BoxGeometry(2.2, H_MAIN + 1.2, 0.4), ribbonMat);
  ribbonV.position.set(0, H_MAIN / 2, R_MAIN + 0.1);
  palaceGroup.add(ribbonV);
  const bowKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.1, 0.32, 40, 8, 2, 3),
    new THREE.MeshStandardMaterial({ color: 0xff6f9f, roughness: 0.4 }));
  bowKnot.position.set(0, H_MAIN + 0.5, R_MAIN + 0.3);
  bowKnot.scale.setScalar(0.9);
  palaceGroup.add(bowKnot);

  palaceGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  palaceGroup.position.set(a.x, 0, a.z);
  scene.add(palaceGroup);

  // --- Kerumunan karakter orang-orang di sekeliling istana (radius dijaga
  // di luar badan istana yang sekarang solid sampai ~17.5 unit) ---
  for (let i = 0; i < 24; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 19 + Math.random() * 5;
    const px = a.x + Math.cos(ang) * r, pz = a.z + Math.sin(ang) * r;
    const person = buildPersonNPC(px, pz);
    crowdPeople.push({ group: person, phase: Math.random() * Math.PI * 2 });
  }

  landmarkLight = new THREE.PointLight(0xff8fb8, 2.4, 32, 2);
  landmarkLight.position.set(a.x, 6, a.z);
  scene.add(landmarkLight);

  // --- Kerlap-kerlip ambient di sekitar monumen, aktif TERUS (bukan cuma
  // saat trigger) supaya monumen terasa hidup & mewah bahkan dari jauh
  // sebelum mobil sampai. ---
  const sparkleColors = [0xfff2a8, 0xffffff, 0xff8fb8, 0xb6e3f2];
  for (let i = 0; i < 40; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = PLAZA_R * (0.3 + Math.random() * 0.9);
    const color = sparkleColors[i % sparkleColors.length];
    const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 }));
    const baseY = 1 + Math.random() * 8;
    sparkle.position.set(a.x + Math.cos(ang) * r, baseY, a.z + Math.sin(ang) * r);
    scene.add(sparkle);
    landmarkSparkles.push({ mesh: sparkle, phase: Math.random() * Math.PI * 2, speed: 2 + Math.random() * 2 });
  }
}

function updateLandmarkAnimations(elapsed) {
  landmarkBalloons.forEach((b) => {
    b.mesh.position.y = b.baseY + Math.sin(elapsed * 1.4 + b.phase) * 0.35;
  });
  landmarkFlags.forEach((f) => {
    f.mesh.rotation.z = Math.sin(elapsed * 2.2 + f.phase) * 0.25;
  });
  candleFlames.forEach((c) => {
    const flicker = 1.0 + Math.sin(elapsed * 18 + c.phase) * 0.35 + Math.sin(elapsed * 7 + c.phase) * 0.15;
    c.mesh.material.emissiveIntensity = 1.2 * flicker;
    c.mesh.scale.setScalar(0.85 + flicker * 0.15);
  });
  if (landmarkLight) {
    const hue = ((Math.sin(elapsed * 0.6) * 0.5 + 0.5) * 0.85 + 0.9) % 1;
    landmarkLight.color.setHSL(hue, 0.6, 0.72);
    landmarkLight.intensity = 2.0 + Math.sin(elapsed * 1.4) * 0.8;
    landmarkLight.position.y = 6 + Math.sin(elapsed * 0.8) * 0.6;
  }
  landmarkSparkles.forEach((s) => {
    const twinkle = Math.sin(elapsed * s.speed + s.phase) * 0.5 + 0.5;
    s.mesh.material.emissiveIntensity = 0.3 + twinkle * 1.4;
    s.mesh.scale.setScalar(0.6 + twinkle * 0.8);
  });
  crowdPeople.forEach((p) => {
    p.group.position.y = Math.abs(Math.sin(elapsed * 1.8 + p.phase)) * 0.08;
    p.group.rotation.y += Math.sin(elapsed * 0.5 + p.phase) * 0.002;
  });
  // Kembang api ambient berkala di monumen, walau mobil belum sampai FINISH
  // — supaya monumen terasa meriah & hidup bahkan dari jauh.
  if (landmarkCenter && elapsed >= nextAmbientFireworkAt) {
    nextAmbientFireworkAt = elapsed + 5 + Math.random() * 4;
    spawnFirework(
      landmarkCenter.x + (Math.random() - 0.5) * 14,
      10 + Math.random() * 5,
      landmarkCenter.z + (Math.random() - 0.5) * 14
    );
  }
}

// =====================================================================
// SECTION 8B2 — BADUT & PESAWAT BALIHO
// =====================================================================
// Permintaan user: karakter badut lucu beranimasi di dekat monumen, dan
// pesawat terbang menarik baliho besar bertuliskan ucapan ulang tahun,
// terbang tinggi mengelilingi dunia.

const clownList = []; // { group, phase, headBase }

function buildClown(x, z) {
  const group = new THREE.Group();
  const suitColor = [0xff6f9f, 0xfff2a8][Math.floor(Math.random() * 2)];
  const suitColor2 = suitColor === 0xff6f9f ? 0x8fd0f7 : 0xb894e0;

  // badan belang dua warna
  const bodyMat1 = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.6 });
  const bodyMat2 = new THREE.MeshStandardMaterial({ color: suitColor2, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.5, 12), bodyMat1);
  body.position.y = 1.1;
  const bodyBand = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.35, 12), bodyMat2);
  bodyBand.position.y = 0.7;
  group.add(body, bodyBand);

  // kepala & wajah
  const headGroup = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xfff0e0, roughness: 0.6 }));
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff3355, emissiveIntensity: 0.4 }));
  nose.position.set(0, -0.02, 0.38);
  const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x3a2f38 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.14, 0.08, 0.35);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.14, 0.08, 0.35);
  // rambut warna-warni dua sisi
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5cd6a8, roughness: 0.8 });
  [-1, 1].forEach((s) => {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), hairMat);
    hair.position.set(0.36 * s, -0.05, -0.05);
    hair.scale.set(1, 1.3, 1);
    headGroup.add(hair);
  });
  // topi kerucut kecil
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x8fd0f7, roughness: 0.5 }));
  hat.position.y = 0.55;
  const hatPom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  hatPom.position.y = 0.82;
  headGroup.add(head, nose, eyeL, eyeR, hat, hatPom);
  headGroup.position.y = 2.05;
  group.add(headGroup);

  // lengan (bisa dilambaikan)
  const armMat = new THREE.MeshStandardMaterial({ color: suitColor2, roughness: 0.6 });
  const armGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8);
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.62, 1.35, 0);
  armL.rotation.z = 0.6;
  const gloveL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff }));
  gloveL.position.set(-0.95, 1.05, 0);
  const armR = new THREE.Group();
  const armRMesh = new THREE.Mesh(armGeo, armMat);
  armRMesh.position.y = 0.4;
  const gloveR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff }));
  gloveR.position.y = 0.8;
  armR.add(armRMesh, gloveR);
  armR.position.set(0.6, 1.35, 0);
  group.add(armL, gloveL, armR);

  // sepatu besar
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xff8f3d, roughness: 0.6 });
  [-1, 1].forEach((s) => {
    const shoe = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 8), shoeMat);
    shoe.rotation.z = Math.PI / 2;
    shoe.rotation.y = s * 0.3;
    shoe.position.set(0.22 * s, 0.12, 0.18);
    group.add(shoe);
  });

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  clownList.push({ group, armR, headGroup, phase: Math.random() * Math.PI * 2 });
}

function buildClowns() {
  const a = landmarkCenter;
  if (!a) return;
  const count = 3;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + 0.6;
    const r = 15 + Math.random() * 6;
    buildClown(a.x + Math.cos(ang) * r, a.z + Math.sin(ang) * r);
  }
}

function updateClowns(elapsed) {
  clownList.forEach((c) => {
    c.group.position.y = Math.abs(Math.sin(elapsed * 2.4 + c.phase)) * 0.18;
    c.headGroup.rotation.z = Math.sin(elapsed * 1.6 + c.phase) * 0.2;
    c.armR.rotation.z = Math.sin(elapsed * 4 + c.phase) * 0.9 - 0.3; // melambai
  });
}

// --- Armada pesawat terbang menarik baliho besar ---
// Diganti dari 1 pesawat jadi 10 (permintaan user) sekaligus memperbaiki
// laporan "tidak terlihat / seperti menetap di satu tempat": akar masalah
// SESUNGGUHNYA adalah `scene.fog` (FogExp2) — pada radius terbang yang
// jauh (dekat dinding bebatuan, ratusan unit dari kamera), fog exponensial
// membuat pesawat memudar hampir menyatu dengan warna langit dari
// kebanyakan sudut pandang, jadi SEOLAH tidak bergerak/tidak kelihatan
// padahal posisinya sebenarnya tetap ter-update tiap frame. Diperbaiki
// dengan `fog: false` di SEMUA material pesawat & baliho di bawah — bagian
// ini sekarang selalu dirender dengan warna & kecerahan aslinya berapa pun
// jauhnya dari kamera, sama seperti perbaikan `toneMapped: false` yang
// sudah dipakai banner foto/HAPPY BIRTHDAY (lihat Log Keputusan Desain).
const AIRPLANE_COUNT = 10;
const AIRPLANE_SCALE = 2.4;
let airplaneBannerTex = null;
const airplaneList = []; // { group, propeller, radius, height, speed, dir, phase }

function makeAirplaneBannerTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048; canvas.height = 320;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff6e9";
  ctx.fillRect(0, 0, 2048, 320);
  ctx.strokeStyle = "#ff8fb8";
  ctx.lineWidth = 18;
  ctx.strokeRect(14, 14, 2048 - 28, 320 - 28);
  ctx.fillStyle = "#ff5f8f";

  // Sama seperti perbaikan banner "HAPPY BIRTHDAY" di monumen (lihat
  // shrinkFontToFit & Log Keputusan Desain) — teks baliho ini bisa
  // melebihi lebar kanvas di font-size 150px tetap, terutama kalau font
  // 'Baloo 2' jatuh ke fallback sans-serif. Dibatasi supaya tetap di
  // dalam garis tepi baliho.
  const fontSpec = (sz) => `900 ${sz}px 'Baloo 2', sans-serif`;
  shrinkFontToFit(ctx, fontSpec, 150, (2048 - 28 * 2) * 0.94, () => ctx.measureText(text).width, 50);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 1024, 168);
  return new THREE.CanvasTexture(canvas);
}

// Membangun SATU unit pesawat+baliho (dipanggil 10x oleh buildAirplanes()).
// Tekstur baliho (`airplaneBannerTex`) dibuat sekali saja di luar fungsi
// ini dan dipakai bersama oleh ke-10 pesawat lewat satu `bannerMat` yang
// sama — sepuluh canvas 2048x320 terpisah tidak perlu, teksnya toh identik
// ("Selamat Ulang Tahun Sayang"), jadi cukup satu texture di-share.
function buildOneAirplane(bannerMat) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.15, fog: false });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xff8fb8, roughness: 0.5, fog: false });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.5, 6, 12), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.6, 12), bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 3.8;
  group.add(nose);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.25, 1.6), accentMat);
  wing.position.set(0, -0.1, 0);
  group.add(wing);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 1), accentMat);
  tailWing.position.set(-3.1, 0.3, 0);
  group.add(tailWing);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, 0.18), accentMat);
  tailFin.position.set(-3.1, 1.0, 0);
  group.add(tailFin);

  const propeller = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x3a2f38, fog: false }));
  propeller.position.set(4.6, 0, 0);
  group.add(propeller);

  // baliho besar di belakang, ditarik pakai "tali"
  const bannerW = 34, bannerH = 5.6;
  const bannerFront = new THREE.Mesh(new THREE.PlaneGeometry(bannerW, bannerH), bannerMat);
  bannerFront.position.set(-3.1 - bannerW / 2 - 3, -1.6, 0);
  group.add(bannerFront);

  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0xffffff, fog: false }));
  rope.rotation.z = Math.PI / 2 - 0.5;
  rope.position.set(-4.6, -0.8, 0);
  group.add(rope);

  group.traverse((o) => { if (o.isMesh && o !== bannerFront) o.castShadow = true; });
  group.scale.set(AIRPLANE_SCALE, AIRPLANE_SCALE, AIRPLANE_SCALE);
  scene.add(group);
  return { group, propeller };
}

function buildAirplanes() {
  airplaneBannerTex = makeAirplaneBannerTexture("Selamat Ulang Tahun Sayang");
  const bannerMat = new THREE.MeshBasicMaterial({ map: airplaneBannerTex, side: THREE.DoubleSide, toneMapped: false, fog: false });
  for (let i = 0; i < AIRPLANE_COUNT; i++) {
    const { group, propeller } = buildOneAirplane(bannerMat);
    // Radius disebar 0.55..0.885 dari WORLD_HALF — masih dekat dinding
    // bebatuan batas dunia (mengitari batas bukit bebatuan, sesuai
    // permintaan awal user) tapi sebagian sengaja ditarik sedikit lebih
    // dekat supaya jauh lebih mudah terlihat dari lintasan, bukan cuma
    // menumpuk persis di garis batas terjauh.
    const radius = WORLD_HALF * (0.55 + 0.035 * i);
    // Ketinggian & kecepatan divariasikan per pesawat (bukan angka sama
    // semua) supaya ke-10 pesawat tidak bertabrakan satu sama lain dan
    // gerakannya terasa jelas hidup, bukan seperti satu formasi kaku.
    const height = 46 + (i % 5) * 11;
    const speed = 0.05 + (i % 4) * 0.011;
    const dir = i % 2 === 0 ? 1 : -1; // separuh searah jarum jam, separuh berlawanan
    const phase = (i / AIRPLANE_COUNT) * Math.PI * 2;
    airplaneList.push({ group, propeller, radius, height, speed, dir, phase });
  }
}

function updateAirplanes(elapsed, dt) {
  airplaneList.forEach((p) => {
    const t = p.phase + elapsed * p.speed * p.dir;
    const x = Math.cos(t) * p.radius;
    const z = Math.sin(t) * p.radius;
    const y = p.height + Math.sin(elapsed * 0.15 + p.phase) * 6;
    p.group.position.set(x, y, z);
    // hadapkan ke arah gerak (turunan posisi lingkaran, ikut arah `dir`)
    const dirX = -Math.sin(t) * p.dir, dirZ = Math.cos(t) * p.dir;
    p.group.rotation.y = Math.atan2(dirX, dirZ);
    p.group.rotation.z = Math.sin(elapsed * 0.4 + p.phase) * 0.05;
    if (p.propeller) p.propeller.rotation.x += dt * 40;
  });
}

// =====================================================================
// SECTION 8B3 — KERAMAIAN KOTA: ORANG, BADUT & HEWAN DI LUAR LINTASAN
// =====================================================================
// Permintaan user: kota jangan cuma ramai di monumen — sebar juga orang-
// orang, badut, dan binatang lucu di luar lintasan supaya kota terasa
// ramai. Semua dipakai lewat findClearRandomSpot() yang otomatis
// menghindari aspal lintasan.

const animalList = []; // { group, type, baseX, baseZ, phase, dir }

function buildDog(x, z) {
  const group = new THREE.Group();
  const furColors = [0xe8c9a0, 0xfff6e9, 0x9a7a5a, 0x3a2f38];
  const furMat = new THREE.MeshStandardMaterial({ color: furColors[Math.floor(Math.random() * furColors.length)], roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.46), furMat);
  body.position.y = 0.42;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.38), furMat);
  head.position.set(0.58, 0.55, 0);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.22), darkMat);
  muzzle.position.set(0.8, 0.48, 0);
  const earGeo = new THREE.ConeGeometry(0.1, 0.24, 6);
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(earGeo, darkMat);
    ear.position.set(0.56, 0.76, 0.14 * s);
    ear.rotation.x = s * 0.3;
    group.add(ear);
  });
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.4, 6), furMat);
  tail.position.set(-0.52, 0.6, 0);
  tail.rotation.z = 0.9;
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.36, 6);
  [[-0.32, -0.16], [-0.32, 0.16], [0.32, -0.16], [0.32, 0.16]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, darkMat);
    leg.position.set(lx, 0.18, lz);
    group.add(leg);
  });
  group.add(body, head, muzzle, tail);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

function buildCapybara(x, z) {
  const group = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: 0xa07850, roughness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x4a382c, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 1.1, 12), furMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.46;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.46), furMat);
  head.position.set(0.72, 0.5, 0);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.34), darkMat);
  nose.position.set(0.94, 0.44, 0);
  const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.28, 6);
  [[-0.34, -0.24], [-0.34, 0.24], [0.3, -0.24], [0.3, 0.24]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, darkMat);
    leg.position.set(lx, 0.15, lz);
    group.add(leg);
  });
  group.add(body, head, nose);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

function buildCat(x, z) {
  const group = new THREE.Group();
  const colors = [0xff9d5c, 0x3a2f38, 0xfff6e9, 0xa8938f];
  const furMat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 10), furMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.26;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), furMat);
  head.position.set(0.35, 0.34, 0);
  const earGeo = new THREE.ConeGeometry(0.08, 0.16, 6);
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(earGeo, furMat);
    ear.position.set(0.3, 0.5, 0.09 * s);
    group.add(ear);
  });
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6), furMat);
  tail.position.set(-0.32, 0.42, 0);
  tail.rotation.z = -0.8;
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6);
  [[-0.16, -0.1], [-0.16, 0.1], [0.16, -0.1], [0.16, 0.1]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, furMat);
    leg.position.set(lx, 0.12, lz);
    group.add(leg);
  });
  group.add(body, head, tail);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

function buildCityAnimals() {
  const builders = [buildDog, buildCapybara, buildCat];
  const COUNT = 200; // dinaikkan lagi dari 110 — permintaan user memperbanyak lagi biar makin ramai
  for (let i = 0; i < COUNT; i++) {
    const spot = findClearRandomSpot(3);
    if (!spot) continue;
    const builder = builders[Math.floor(Math.random() * builders.length)];
    const group = builder(spot.x, spot.z);
    group.rotation.y = Math.random() * Math.PI * 2;
    animalList.push({
      group, baseX: spot.x, baseZ: spot.z,
      phase: Math.random() * Math.PI * 2,
      dir: Math.random() < 0.5 ? 1 : -1,
    });
  }
}

function updateAnimals(elapsed) {
  animalList.forEach((a) => {
    const speed = 0.5;
    const range = 3;
    const t = elapsed * speed + a.phase;
    const offset = Math.sin(t) * range;
    a.group.position.x = a.baseX + offset * a.dir;
    a.group.position.y = Math.abs(Math.sin(elapsed * 4 + a.phase)) * 0.05;
    a.group.rotation.y = (Math.cos(t) * a.dir >= 0 ? 0 : Math.PI) + Math.PI / 2;
  });
}

function buildCityPeople() {
  const COUNT = 200; // dinaikkan lagi dari 110 — permintaan user memperbanyak lagi biar makin ramai
  for (let i = 0; i < COUNT; i++) {
    const spot = findClearRandomSpot(3);
    if (!spot) continue;
    const person = buildPersonNPC(spot.x, spot.z);
    crowdPeople.push({ group: person, phase: Math.random() * Math.PI * 2 });
    // SEMUA orang (200/200, permintaan user dinaikkan dari sebelumnya
    // 1/2) dijadikan "penyapa" — tiap orang di kota punya balon dialog
    // ucapan ulang tahun sendiri saat mobil mendekat.
    attachGreeterBubble(person);
  }
}

// =====================================================================
// SECTION 8B4 — BALON DIALOG UCAPAN ULANG TAHUN (muncul saat mobil dekat)
// =====================================================================
// Permintaan user: sebagian orang random, kalau didekati mobil, memunculkan
// balon dialog ucapan ulang tahun (versi kalimat berbeda-beda per orang),
// lalu balonnya hilang lagi begitu mobil menjauh.

// Daftar kalimat ucapan DIJAMIN 200 unik & tidak ada yang sama satu sama
// lain (permintaan user), dan SETIAP kalimat memuat nama "Gabriela" atau
// "GbYoung" (permintaan user) — dibangun dari kombinasi 20 "pembuka"
// (masing-masing sudah menyebut nama) × 10 "harapan penutup" (generik,
// tanpa nama). Karena 20 × 10 = 200 tepat sama dengan jumlah orang
// (`COUNT` di `buildCityPeople`), `getUniqueGreeterMessage(index)` di
// bawah memetakan tiap `index` 0..199 ke SATU pasangan (pembuka, harapan)
// yang berbeda lewat pembagian bilangan bulat — matematis dijamin tidak
// ada dua index yang menghasilkan pasangan sama, jadi tidak perlu daftar
// 200 kalimat ditulis manual satu-satu (rawan salah ketik/duplikat).
const GREETER_OPENERS = [
  "Selamat ulang tahun, Gabriela!",
  "Happy Birthday, Gabriela!",
  "Met ultah ya, Gabriela!",
  "Gabriela, hari ini harimu banget!",
  "Dear Gabriela, selamat bertambah usia!",
  "Gabriela paling spesial hari ini!",
  "Dear Gabriela, semoga harimu penuh senyum!",
  "Dari kejauhan, buat Gabriela tersayang!",
  "Dear Gabriela, met milad ya!",
  "Gabriela, semoga hari ini istimewa banget!",
  "Selamat ulang tahun buat GbYoung!",
  "Happy Birthday, GbYoung!",
  "Met ultah ya, GbYoung!",
  "GbYoung, hari ini harimu banget!",
  "Dear GbYoung, selamat bertambah usia!",
  "GbYoung paling spesial hari ini!",
  "Dear GbYoung, semoga harimu penuh senyum!",
  "Dari kejauhan, buat GbYoung tersayang!",
  "Dear GbYoung, met milad ya!",
  "GbYoung, semoga hari ini istimewa banget!",
];
const GREETER_WISHES = [
  "Semoga semua impianmu terwujud. 🌟",
  "Sehat selalu & bahagia terus ya! 💖",
  "Semoga rejekinya lancar terus. 🍀",
  "Tetap semangat & tersenyum ya! 😊",
  "Panjang umur, sehat, dan sukses! 🎉",
  "Semoga tahun ini penuh kejutan indah. 🎁",
  "Doa terbaik selalu menyertaimu. 🙏",
  "Semoga makin dikelilingi orang baik. 🥰",
  "Semoga harimu secerah senyummu. ☀️",
  "Cheers to another amazing year! 🥂",
];
function getUniqueGreeterMessage(index) {
  const openerIdx = index % GREETER_OPENERS.length;
  const wishIdx = Math.floor(index / GREETER_OPENERS.length) % GREETER_WISHES.length;
  return `${GREETER_OPENERS[openerIdx]} ${GREETER_WISHES[wishIdx]}`;
}

const GREETER_TRIGGER_RADIUS = 9; // jarak (unit dunia) mobil ke orang supaya balonnya muncul
let greeterMsgCounter = 0; // index urut 0..199 -> dipetakan getUniqueGreeterMessage() jadi kalimat unik, lihat penjelasan di atas
const greeterList = []; // { group, sprite, active } — dicek jaraknya ke mobil tiap frame oleh updateGreeters()

// Memecah `text` jadi baris-baris yang masing-masing tidak lebih lebar dari
// `maxWidth` (pemenggalan per kata, pakai ctx.font yang sedang aktif). Satu
// kata yang sendirinya lebih lebar dari maxWidth tetap ditaruh utuh di
// barisnya sendiri (tidak dipotong per huruf) — pemanggil yang menangani
// dengan mengecilkan font.
function wrapTextToLines(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? current + " " + word : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

// Menggambar bentuk balon percakapan (rounded-rect + ekor runcing ke
// bawah, gaya komik) berisi satu kalimat ucapan, sebagai canvas texture.
// Satu texture unik per orang (SEMUA 200 orang kota sekarang punya
// balonnya sendiri, lihat buildCityPeople) — tetap ringan karena tiap
// canvas cukup kecil (512x288) dan cuma dipakai sekali saat dibangun,
// bukan digambar ulang tiap frame.
function makeSpeechBubbleTexture(text) {
  const W = 512, H = 288;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const pad = 16, bodyH = H - 64, r = 36;
  const x0 = pad, y0 = pad, w0 = W - pad * 2, h0 = bodyH - pad;

  ctx.fillStyle = "#fffdf7";
  ctx.strokeStyle = "#ff8fb8";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x0 + w0 - r, y0);
  ctx.quadraticCurveTo(x0 + w0, y0, x0 + w0, y0 + r);
  ctx.lineTo(x0 + w0, y0 + h0 - r);
  ctx.quadraticCurveTo(x0 + w0, y0 + h0, x0 + w0 - r, y0 + h0);
  ctx.lineTo(x0 + r, y0 + h0);
  ctx.quadraticCurveTo(x0, y0 + h0, x0, y0 + h0 - r);
  ctx.lineTo(x0, y0 + r);
  ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ekor runcing menunjuk ke bawah, ke arah kepala orangnya
  const midX = W / 2;
  ctx.beginPath();
  ctx.moveTo(midX - 24, y0 + h0 - 6);
  ctx.lineTo(midX, H - 8);
  ctx.lineTo(midX + 24, y0 + h0 - 6);
  ctx.closePath();
  ctx.fillStyle = "#fffdf7";
  ctx.fill();

  // teks — DIBUNGKUS jadi beberapa baris (word-wrap) lalu dicari ukuran font
  // terbesar yang muat di lebar DAN tinggi gelembung. Sebelumnya teks
  // digambar 1 baris + shrinkFontToFit (min 22px) yang tidak mengecek
  // apakah sudah muat, sehingga kalimat panjang (opener + harapan, ~75
  // karakter) meluber & terpotong di tepi gelembung. Lihat Log Keputusan
  // Desain "Teks balon dialog terpotong".
  ctx.fillStyle = "#8a3b63";
  const fontSpec = (sz) => `700 ${sz}px 'Baloo 2', sans-serif`;
  const innerW = w0 - 64;  // sisa 32px kiri-kanan: melewati garis tepi (9px) + lengkung sudut (r=36)
  const innerH = h0 - 48;  // sisa 24px atas-bawah
  const LINE_HEIGHT = 1.2;
  const MAX_FONT = 46, MIN_FONT = 16;
  let fontSize = MAX_FONT;
  let lines = [text];
  for (; fontSize >= MIN_FONT; fontSize -= 2) {
    ctx.font = fontSpec(fontSize);
    lines = wrapTextToLines(ctx, text, innerW);
    const widest = Math.max.apply(null, lines.map((l) => ctx.measureText(l).width));
    if (widest <= innerW && lines.length * fontSize * LINE_HEIGHT <= innerH) break;
  }
  if (fontSize < MIN_FONT) { // tidak ada yang muat -> pakai ukuran terkecil (kasus ekstrem, kalimat sangat panjang)
    fontSize = MIN_FONT;
    ctx.font = fontSpec(fontSize);
    lines = wrapTextToLines(ctx, text, innerW);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineH = fontSize * LINE_HEIGHT;
  const firstY = y0 + h0 / 2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => ctx.fillText(line, midX, firstY + i * lineH));
  return new THREE.CanvasTexture(canvas);
}

// Menempelkan satu balon dialog (Sprite, otomatis selalu menghadap kamera)
// sebagai child dari group orangnya sendiri — supaya posisinya otomatis
// ikut kalau suatu saat orangnya digerakkan, tanpa perlu sinkronisasi
// manual. Disembunyikan (`visible = false`) sejak awal; baru dimunculkan
// oleh updateGreeters() berdasarkan jarak ke mobil.
function attachGreeterBubble(personGroup) {
  const message = getUniqueGreeterMessage(greeterMsgCounter);
  greeterMsgCounter++;
  const tex = makeSpeechBubbleTexture(message);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, fog: false });
  const sprite = new THREE.Sprite(mat);
  // Diperbesar (2.6x1.46 -> 4.4x2.48, permintaan user) supaya lebih jelas
  // terbaca dari kejauhan/saat berkendara. Posisi vertikal ikut dinaikkan
  // (2.55 -> 3.15) supaya ekor balon yang sekarang lebih besar tetap
  // menggantung rapi di atas kepala, tidak menembus/menimpa kepala orangnya.
  sprite.scale.set(4.4, 2.48, 1);
  sprite.position.set(0, 3.15, 0); // di atas kepala (kepala orangnya ada di lokal y~1.5-1.8)
  sprite.visible = false;
  personGroup.add(sprite);
  greeterList.push({ group: personGroup, sprite, active: false });
}

// Dipanggil tiap frame (animate()): cek jarak 2D mobil ke tiap penyapa —
// dalam radius, tampilkan balonnya; di luar radius, sembunyikan lagi.
// Pengecekan `near !== g.active` supaya `sprite.visible` cuma di-set saat
// benar-benar berubah status (masuk/keluar radius), bukan tiap frame.
function updateGreeters() {
  greeterList.forEach((g) => {
    const dx = g.group.position.x - carState.x;
    const dz = g.group.position.z - carState.z;
    const near = (dx * dx + dz * dz) < GREETER_TRIGGER_RADIUS * GREETER_TRIGGER_RADIUS;
    if (near !== g.active) {
      g.active = near;
      g.sprite.visible = near;
    }
  });
}

function buildCityClowns() {
  const COUNT = 30; // dinaikkan dari 10 — permintaan user memperbanyak badut juga
  for (let i = 0; i < COUNT; i++) {
    const spot = findClearRandomSpot(4);
    if (!spot) continue;
    buildClown(spot.x, spot.z);
  }
}

// =====================================================================
// SECTION 8C — PETASAN / KEMBANG API (dipicu saat mobil sampai FINISH)
// =====================================================================

const fireworkSystems = [];

function spawnFirework(x, y, z) {
  const count = 46;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  const color = new THREE.Color().setHSL(Math.random(), 0.75, 0.7);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const speed = 5 + Math.random() * 4;
    velocities.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.abs(Math.cos(phi)) * speed + 3,
      Math.sin(phi) * Math.sin(theta) * speed
    ));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.7, transparent: true, opacity: 1, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  fireworkSystems.push({ points, velocities, age: 0, life: 1.7 });
}

function triggerFireworksShow() {
  const a = FINISH_POINT;
  const bursts = 6;
  for (let i = 0; i < bursts; i++) {
    setTimeout(() => {
      spawnFirework(
        a.x + (Math.random() - 0.5) * 16,
        11 + Math.random() * 6,
        a.z + (Math.random() - 0.5) * 16
      );
    }, i * 260);
  }
}

function updateFireworks(dt) {
  for (let i = fireworkSystems.length - 1; i >= 0; i--) {
    const fw = fireworkSystems[i];
    fw.age += dt;
    const positions = fw.points.geometry.attributes.position.array;
    for (let p = 0; p < fw.velocities.length; p++) {
      const v = fw.velocities[p];
      v.y -= 9 * dt; // gravitasi ringan
      positions[p * 3] += v.x * dt;
      positions[p * 3 + 1] += v.y * dt;
      positions[p * 3 + 2] += v.z * dt;
    }
    fw.points.geometry.attributes.position.needsUpdate = true;
    fw.points.material.opacity = Math.max(0, 1 - fw.age / fw.life);
    if (fw.age >= fw.life) {
      scene.remove(fw.points);
      fw.points.geometry.dispose();
      fw.points.material.dispose();
      fireworkSystems.splice(i, 1);
    }
  }
}

// =====================================================================
// SECTION 8D — BILLBOARD TIANG BERISI FOTO, MELINTANG DI ATAS JALAN
// =====================================================================
// Permintaan user: hapus Monumen Foto (pedestal di luar lintasan), ganti
// gapura tiang seperti gerbang START/FINISH tapi bannernya JAUH LEBIH
// BESAR dan menampilkan FOTO (bukan teks) — satu gapura foto per file di
// assets/photos/, melintang di atas jalan sepanjang lintasan supaya mobil
// lewat DI BAWAHNYA. Jumlahnya mengikuti TOTAL_PHOTO_COUNT — ganti angka
// itu kalau menambah/mengurangi foto (lihat assets/photos/README.txt).

const TOTAL_PHOTO_COUNT = 10;
const PHOTO_FILENAMES = Array.from({ length: TOTAL_PHOTO_COUNT }, (_, i) => `foto-${i + 1}.jpg`);
const PHOTO_ASSET_PATH = "assets/photos/";
// PENTING: percobaan sebelumnya memakai THREE.TextureLoader dengan
// crossOrigin di-unset manual — ternyata di sebagian browser/kondisi itu
// masih belum cukup untuk memuat gambar lokal lewat file:// (dobel-klik,
// tanpa server). Sekarang dipakai pemuatan manual yang SEPENUHNYA
// melewati mekanisme crossOrigin bawaan Three.js: bikin elemen <img> milik
// sendiri, TIDAK PERNAH menyentuh properti .crossOrigin sama sekali (biar
// browser memperlakukannya persis seperti <img src="..."> biasa di HTML),
// baru dibungkus jadi THREE.Texture begitu gambarnya selesai dimuat. Lihat
// Log Keputusan Desain.
function makePlaceholderTexture(label) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 360;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 512, 360);
  grad.addColorStop(0, "#ffd4e6");
  grad.addColorStop(1, "#d9c9ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 360);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(20, 20, 472, 320);
  ctx.fillStyle = "#c97ea3";
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("📷", 256, 175);
  ctx.font = "600 22px sans-serif";
  ctx.fillStyle = "#7a6580";
  ctx.fillText(label, 256, 235);
  return new THREE.CanvasTexture(canvas);
}

// --- Jarak titik (x,z) ke segmen TERDEKAT di seluruh lintasan — masih
// dipakai findClearRandomSpot() untuk gedung/tugu/patung supaya tidak
// nyangkut di aspal. ---
function distanceToTrack(x, z) {
  let best = Infinity;
  for (let i = 0; i < TRACK_WAYPOINTS.length - 1; i++) {
    const p1 = TRACK_WAYPOINTS[i], p2 = TRACK_WAYPOINTS[i + 1];
    const dx = p2.x - p1.x, dz = p2.z - p1.z;
    const lenSq = dx * dx + dz * dz;
    let t = lenSq > 0 ? ((x - p1.x) * dx + (z - p1.z) * dz) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = p1.x + dx * t, cz = p1.z + dz * t;
    const d = Math.hypot(x - cx, z - cz);
    if (d < best) best = d;
  }
  return best;
}

// --- Satu gapura foto: dua tiang + bingkai foto besar melintang di jalan,
// foto dipasang di KEDUA sisi (mesh terpisah, bukan cuma DoubleSide) supaya
// tidak ada foto yang tampil tercermin dari arah manapun mobil datang.
// Material fotonya SENGAJA MeshBasicMaterial (bukan Standard) — supaya
// selalu terlihat terang & jelas apa adanya, tidak bergantung arah cahaya
// matahari sama sekali (mencegah banner terlihat gelap/hitam kalau posisi
// gapura kebetulan membelakangi matahari). ---
function buildPhotoGate(x, z, angle, filename) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const poleGeo = new THREE.CylinderGeometry(0.34, 0.4, 8.4, 10);
  const pole1 = new THREE.Mesh(poleGeo, poleMat);
  pole1.position.set(-9.2, 4.2, 0);
  const pole2 = new THREE.Mesh(poleGeo, poleMat);
  pole2.position.set(9.2, 4.2, 0);

  // Sumber foto: data URI yang sudah di-embed (assets/photos-embedded.js),
  // DIJAMIN tampil karena data: URI tidak pernah kena masalah tainted-
  // canvas/CORS sama sekali di WebGL — beda dengan file eksternal biasa
  // yang ternyata di banyak kombinasi browser tetap gagal dipakai sebagai
  // tekstur WebGL walau gambarnya sendiri berhasil dimuat (itu akar
  // masalah "banner hitam" yang sesungguhnya — lihat Log Keputusan
  // Desain). Placeholder abu-abu tetap jadi cadangan paling akhir kalau
  // data embed-nya sendiri entah kenapa tidak ada.
  const dataUri = (typeof EMBEDDED_PHOTOS !== "undefined") ? EMBEDDED_PHOTOS[filename] : null;
  const initialTexture = dataUri
    ? new THREE.TextureLoader().load(dataUri)
    : makePlaceholderTexture(filename.replace(/\.[a-z]+$/i, ""));
  initialTexture.encoding = THREE.sRGBEncoding;
  const photoMatFront = new THREE.MeshBasicMaterial({ map: initialTexture, toneMapped: false });
  const photoMatBack = new THREE.MeshBasicMaterial({ map: initialTexture, toneMapped: false });

  const bannerW = 17, bannerH = 5.4; // jauh lebih besar dari banner START/FINISH (12.8x3.2)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(bannerW + 0.4, bannerH + 0.4, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }));
  frame.position.set(0, 7.3, 0);
  const photoFront = new THREE.Mesh(new THREE.PlaneGeometry(bannerW, bannerH), photoMatFront);
  photoFront.position.set(0, 7.3, 0.14);
  const photoBack = new THREE.Mesh(new THREE.PlaneGeometry(bannerW, bannerH), photoMatBack);
  photoBack.position.set(0, 7.3, -0.14);
  photoBack.rotation.y = Math.PI;

  group.add(pole1, pole2, frame, photoFront, photoBack);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.position.set(x, 0, z);
  group.rotation.y = angle;
  scene.add(group);
}

function buildPhotoGates() {
  const segLengths = [];
  let totalLen = 0;
  for (let i = 0; i < TRACK_WAYPOINTS.length - 1; i++) {
    const p1 = TRACK_WAYPOINTS[i], p2 = TRACK_WAYPOINTS[i + 1];
    const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    segLengths.push(len);
    totalLen += len;
  }

  function pointAlongTrack(targetDist) {
    let remaining = targetDist;
    for (let i = 0; i < TRACK_WAYPOINTS.length - 1; i++) {
      const len = segLengths[i];
      if (remaining <= len || i === TRACK_WAYPOINTS.length - 2) {
        const p1 = TRACK_WAYPOINTS[i], p2 = TRACK_WAYPOINTS[i + 1];
        const t = len > 0 ? Math.max(0, Math.min(1, remaining / len)) : 0;
        const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);
        return {
          x: p1.x + (p2.x - p1.x) * t,
          z: p1.z + (p2.z - p1.z) * t,
          angle,
        };
      }
      remaining -= len;
    }
    const last = TRACK_WAYPOINTS[TRACK_WAYPOINTS.length - 1];
    return { x: last.x, z: last.z, angle: 0 };
  }

  const spacing = totalLen / (PHOTO_FILENAMES.length + 1);
  PHOTO_FILENAMES.forEach((file, i) => {
    const { x, z, angle } = pointAlongTrack(spacing * (i + 1));
    buildPhotoGate(x, z, angle, file);
  });
}

// =====================================================================
// SECTION 8E — BANGUNAN, TUGU & PATUNG LUCU DI LUAR LINTASAN + OBJEK LANGIT
// =====================================================================
// Permintaan user: dekorasi "alam" sebelumnya (jamur, semak permen, hati/
// bintang melayang, pelangi) DIHAPUS, diganti rumah-rumah kecil, tugu
// (obelisk bertingkat), dan patung lucu — semua dari geometry primitif,
// disebar lewat findClearRandomSpot() (otomatis menghindari lintasan).
// Awan & burung di langit dari iterasi sebelumnya tetap dipertahankan.

const cloudList = []; // { group, speed } — awan melayang pelan
const birdList = [];  // { group, phase, radius, centerX, centerZ, baseY }

// --- Gedung besar & estetik (menggantikan rumah kecil sebelumnya) ---
function buildBigBuilding(x, z, rotY) {
  const group = new THREE.Group();
  const palette = [0xff4fa0, 0x8a4fe0, 0x1fbf8f, 0x2f9fe0, 0xff8a1f, 0xff3d7f, 0xffb700, 0x2fd9c9];
  const color = palette[Math.floor(Math.random() * palette.length)];
  const accentColor = palette[Math.floor(Math.random() * palette.length)];
  const w = 15 + Math.random() * 11; // LEBAR (bukan tinggi) — sesuai permintaan user
  const d = 15 + Math.random() * 11;
  const h = 9 + Math.random() * 13; // jauh lebih pendek dari versi sebelumnya (20-50 -> 9-22)

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  tower.position.y = h / 2;
  group.add(tower);

  // Aksen jendela — panel kaca besar berwarna (bukan putih polos), lebih hidup
  const winTintColors = [0xbfe8ff, 0xffe6c2, 0xd9c2ff, 0xc2ffe0];
  const winMat = new THREE.MeshStandardMaterial({
    color: winTintColors[Math.floor(Math.random() * winTintColors.length)],
    roughness: 0.2, metalness: 0.4,
  });
  const winGeo = new THREE.PlaneGeometry(w * 0.8, h * 0.72);
  const winFront = new THREE.Mesh(winGeo, winMat);
  winFront.position.set(0, h / 2, d / 2 + 0.03);
  const winBack = winFront.clone();
  winBack.position.z = -d / 2 - 0.03;
  winBack.rotation.y = Math.PI;
  group.add(winFront, winBack);

  // garis-garis lantai horizontal warna aksen, biar terasa "gedung" berlantai & tetap warna-warni
  const stripeMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, transparent: true, opacity: 0.6 });
  const floors = 3 + Math.floor(Math.random() * 3);
  for (let f = 1; f < floors; f++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.16, d * 1.01), stripeMat);
    stripe.position.y = (h / floors) * f;
    group.add(stripe);
  }

  // atap/topi warna aksen kontras (bukan putih polos lagi)
  const capMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.45 });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, h * 0.08, d * 1.06), capMat);
  cap.position.y = h + h * 0.04;
  group.add(cap);

  // aksen puncak (antena/spire) di sebagian gedung, buat variasi siluet
  if (Math.random() < 0.55) {
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, h * 0.22, 8), capMat);
    spire.position.y = h + h * 0.08 + h * 0.11;
    group.add(spire);
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  scene.add(group);
  addRectCollider(x, z, w + 0.8, d + 0.8, rotY);
}

function buildBigBuildings() {
  for (let i = 0; i < 30; i++) {
    const spot = findClearRandomSpot(7);
    if (!spot) continue;
    buildBigBuilding(spot.x, spot.z, Math.random() * Math.PI * 2);
  }
}

// --- Tugu (obelisk bertingkat) ---
function buildTugu(x, z) {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xe8d9f0, roughness: 0.8 });
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 3.6), baseMat);
  tier1.position.y = 0.35;
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 2.6), baseMat);
  tier2.position.y = 1.05;
  const tier3 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xfff6ee, roughness: 0.7 }));
  tier3.position.y = 1.7;
  const obeliskH = 6 + Math.random() * 2;
  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, obeliskH, 4),
    new THREE.MeshStandardMaterial({ color: 0xfffdf6, roughness: 0.55 }));
  obelisk.rotation.y = Math.PI / 4;
  obelisk.position.y = 2 + obeliskH / 2;
  const capColors = [0xff8fb8, 0xfff2a8, 0xb6e3f2, 0xd9c9ff];
  const capColor = capColors[Math.floor(Math.random() * capColors.length)];
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12),
    new THREE.MeshStandardMaterial({ color: capColor, emissive: capColor, emissiveIntensity: 0.4, roughness: 0.4 }));
  cap.position.y = 2 + obeliskH + 0.35;
  group.add(tier1, tier2, tier3, obelisk, cap);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  addRectCollider(x, z, 3.8, 3.8, group.rotation.y);
}

function buildTugus() {
  for (let i = 0; i < 5; i++) {
    const spot = findClearRandomSpot(10);
    if (!spot) continue;
    buildTugu(spot.x, spot.z);
  }
}

// --- Patung binatang lucu (kucing duduk) di atas pedestal ---
function buildCuteStatue(x, z) {
  const group = new THREE.Group();
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xd9c9ff, roughness: 0.75 });
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 1.1, 14), pedestalMat);
  pedestal.position.y = 0.55;

  const statueColors = [0xc9789e, 0xa8938f, 0xffffff, 0xe8c9a0];
  const statueColor = statueColors[Math.floor(Math.random() * statueColors.length)];
  const statueMat = new THREE.MeshStandardMaterial({ color: statueColor, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 14), statueMat);
  body.position.y = 1.1 + 0.85;
  body.scale.set(1, 1.15, 1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 14), statueMat);
  head.position.y = 1.1 + 1.9;
  const earGeo = new THREE.ConeGeometry(0.22, 0.4, 6);
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(earGeo, statueMat);
    ear.position.set(0.32 * s, 1.1 + 2.35, 0.05);
    ear.rotation.z = s * 0.3;
    group.add(ear);
  });
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 8), statueMat);
  tail.position.set(-0.65, 1.1 + 1.15, -0.45);
  tail.rotation.z = 0.9;
  tail.rotation.x = -0.3;
  group.add(pedestal, body, head, tail);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  addRectCollider(x, z, 3.4, 3.4, 0);
}

function buildCuteStatues() {
  for (let i = 0; i < 8; i++) {
    const spot = findClearRandomSpot(6);
    if (!spot) continue;
    buildCuteStatue(spot.x, spot.z);
  }
}

// --- Awan melayang pelan di langit ---
function buildCloudPuff(scale) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xfff8ee, emissiveIntensity: 0.08 });
  const puffCount = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < puffCount; i++) {
    const r = (0.6 + Math.random() * 0.6) * scale;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), mat);
    puff.position.set(
      (i - puffCount / 2) * 1.1 * scale + (Math.random() - 0.5) * 0.4,
      Math.random() * 0.4 * scale,
      (Math.random() - 0.5) * 0.8 * scale
    );
    group.add(puff);
  }
  return group;
}

function buildClouds() {
  const CLOUD_COUNT = 30;
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const scale = 1.6 + Math.random() * 2.6;
    const cloud = buildCloudPuff(scale);
    const x = (Math.random() * 2 - 1) * (WORLD_HALF + 80);
    const z = (Math.random() * 2 - 1) * (WORLD_HALF + 80);
    const y = 48 + Math.random() * 44;
    cloud.position.set(x, y, z);
    scene.add(cloud);
    cloudList.push({ group: cloud, speed: 1.2 + Math.random() * 2.4 });
  }
}

function updateClouds(dt) {
  const limit = WORLD_HALF + 90;
  cloudList.forEach((c) => {
    c.group.position.x += c.speed * dt;
    if (c.group.position.x > limit) c.group.position.x = -limit;
  });
}

// --- Burung-burung kecil terbang melingkar tinggi di langit ---
function buildBird(centerX, centerZ, baseY) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a5570, roughness: 0.6 });
  const wingGeo = new THREE.ConeGeometry(0.5, 1.4, 4);
  const wingL = new THREE.Mesh(wingGeo, mat);
  wingL.rotation.z = Math.PI / 2.4;
  wingL.position.x = -0.5;
  const wingR = new THREE.Mesh(wingGeo, mat);
  wingR.rotation.z = -Math.PI / 2.4;
  wingR.position.x = 0.5;
  group.add(wingL, wingR);
  scene.add(group);
  birdList.push({
    group, phase: Math.random() * Math.PI * 2,
    radius: 20 + Math.random() * 30, centerX, centerZ, baseY,
    speed: 0.25 + Math.random() * 0.2,
  });
}

function buildBirds() {
  const spots = 5;
  for (let i = 0; i < spots; i++) {
    const spot = findClearRandomSpot(6) || { x: (Math.random() - 0.5) * 300, z: (Math.random() - 0.5) * 300 };
    const flockSize = 2 + Math.floor(Math.random() * 3);
    for (let f = 0; f < flockSize; f++) {
      buildBird(spot.x, spot.z, 40 + Math.random() * 25);
    }
  }
}

function updateBirds(elapsed) {
  birdList.forEach((b) => {
    const t = elapsed * b.speed + b.phase;
    b.group.position.set(
      b.centerX + Math.cos(t) * b.radius,
      b.baseY + Math.sin(elapsed * 2 + b.phase) * 1.2,
      b.centerZ + Math.sin(t) * b.radius
    );
    b.group.rotation.y = -t + Math.PI / 2;
    const flap = Math.sin(elapsed * 8 + b.phase) * 0.5;
    b.group.children[0].rotation.z = Math.PI / 2.4 + flap;
    b.group.children[1].rotation.z = -Math.PI / 2.4 - flap;
  });
}

// =====================================================================
// SECTION 8F — HAMPARAN BUNGA MEMBENTUK TULISAN "SELAMAT ULANG TAHUN SAYANG"
// =====================================================================
// Awalnya (lihat Log Keputusan Desain 2026-09-21 versi pertama) bunga
// disebar acak dalam beberapa "petak" bundar. Permintaan user berikutnya:
// susunan bunganya sendiri harus MEMBENTUK tulisan "SELAMAT ULANG TAHUN
// SAYANG" (bukan cuma tersebar acak). Lihat Log Keputusan Desain untuk
// alasan desain lengkapnya.
//
// Pendekatan: font bitmap 5x7 piksel sederhana (`FLOWER_FONT_5X7`, tanpa
// font/model eksternal — konsisten dgn batasan proyek, prinsip yang sama
// dipakai tanda huruf 3D di landmark) dipakai utk menghasilkan grid sel
// "menyala/mati" per huruf lewat `layoutFlowerTextGrid()`. Tiap sel yang
// menyala jadi satu titik bunga (`buildFlowerTextPositions()`); teks
// disusun 3 baris ("SELAMAT" / "ULANG TAHUN" / "SAYANG") supaya lebar
// totalnya tetap wajar dibanding radius aman yang dicari lewat
// `findClearRandomSpot()`. Sisa bunga (di luar tulisan) tetap disebar
// sebagai beberapa petak aksen acak kecil, memakai pendekatan lama,
// supaya dunia tidak terasa kosong di sekitar tulisan.
//
// Render tetap lewat 3 InstancedMesh (batang, kepala bulat, kepala
// bintang) — bukan THREE.Group per bunga seperti NPC/hewan di atas —
// supaya ratusan bunga (termasuk seluruh tulisan) tetap sangat murah
// di-render (1 draw call per jenis bagian, persis pendekatan yang sudah
// dipakai buildBoundaryWalls() utk ratusan batu). Bunga SENGAJA tidak
// diberi collider sama sekali (bunga rumput kecil, bukan penghalang
// solid) — mobil bebas melintasi hamparan maupun tulisannya, alasannya
// sama dengan kenapa pohon latar massal dulu tidak diberi collider
// individual.

const FLOWER_HEAD_COLORS = [0xff8fb8, 0xffe066, 0xc9a8ff, 0xffffff, 0xff6f9f, 0x8fd0f7, 0xffb366];
const FLOWER_TEXT_HEAD_COLORS = [0xff6f9f, 0xff8fb8, 0xffffff, 0xffe066]; // palet lebih dominan pink/putih di tulisan supaya lebih kebaca jelas
const FLOWER_ACCENT_PATCH_COUNT = 3; // petak bunga acak tambahan di luar tulisan (sebelumnya 6 petak, dulu semuanya acak — lihat Log Keputusan Desain)
const FLOWERS_PER_PATCH_MIN = 70;
const FLOWERS_PER_PATCH_MAX = 110;
const FLOWER_PATCH_RADIUS = 8; // tetap di dalam jarak aman findClearRandomSpot terhadap lintasan (lihat komentar di dalam buildFlowerFields)

// --- Font bitmap 5x7 piksel (cuma huruf yang dipakai di teks ucapan) ---
const FLOWER_FONT_5X7 = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
};
const FLOWER_GLYPH_W = 5;
const FLOWER_GLYPH_H = 7;
const FLOWER_CHAR_GAP = 1;   // jarak antar huruf (kolom)
const FLOWER_SPACE_W = 3;    // lebar spasi antar kata (kolom)
const FLOWER_LINE_GAP = 2;   // jarak antar baris (baris)
const FLOWER_TEXT_LINES = ["SELAMAT", "ULANG TAHUN", "SAYANG"];
const FLOWER_TEXT_CELL_SIZE = 1.6; // unit dunia per sel grid font — menentukan ukuran akhir tulisan

// Menyusun FLOWER_TEXT_LINES jadi daftar sel grid {gx, gy} (gy=0 di baris
// paling atas) yang "menyala", plus lebar & tinggi total grid (dalam
// satuan sel) supaya pemanggil bisa menghitung radius pencarian titik
// jangkar yang aman.
function layoutFlowerTextGrid() {
  const lineLayouts = FLOWER_TEXT_LINES.map((line) => {
    let col = 0;
    const chars = [];
    for (const ch of line) {
      if (ch === " ") {
        col += FLOWER_SPACE_W + FLOWER_CHAR_GAP;
        continue;
      }
      const glyph = FLOWER_FONT_5X7[ch];
      if (!glyph) { col += FLOWER_GLYPH_W + FLOWER_CHAR_GAP; continue; } // huruf tak dikenal di font: lewati sbg spasi kosong, tetap aman
      chars.push({ x0: col, glyph });
      col += FLOWER_GLYPH_W + FLOWER_CHAR_GAP;
    }
    return { chars, width: Math.max(0, col - FLOWER_CHAR_GAP) };
  });

  const gridWidth = Math.max(...lineLayouts.map((l) => l.width));
  const gridHeight = lineLayouts.length * FLOWER_GLYPH_H + (lineLayouts.length - 1) * FLOWER_LINE_GAP;

  const cells = [];
  lineLayouts.forEach((lineLayout, li) => {
    const rowOffset = li * (FLOWER_GLYPH_H + FLOWER_LINE_GAP);
    const xOffset = (gridWidth - lineLayout.width) / 2; // pusatkan baris yang lebih pendek dari baris terlebar
    lineLayout.chars.forEach((c) => {
      for (let r = 0; r < FLOWER_GLYPH_H; r++) {
        const rowBits = c.glyph[r];
        for (let col = 0; col < FLOWER_GLYPH_W; col++) {
          if (rowBits[col] === "1") cells.push({ gx: c.x0 + col + xOffset, gy: rowOffset + r });
        }
      }
    });
  });

  return { cells, gridWidth, gridHeight };
}

// Mengubah grid huruf jadi daftar bunga individual di koordinat dunia
// (x/z, rata di tanah — sama seperti petak bunga acak lama), lengkap
// dengan jitter kecil per-bunga supaya tulisan tetap terasa "kebun bunga
// asli", bukan grid piksel yang kaku.
function buildFlowerTextPositions() {
  const grid = layoutFlowerTextGrid();
  if (grid.cells.length === 0) return [];

  const halfW = (grid.gridWidth * FLOWER_TEXT_CELL_SIZE) / 2;
  const halfH = (grid.gridHeight * FLOWER_TEXT_CELL_SIZE) / 2;
  // Radius pencarian = setengah diagonal kotak tulisan + sedikit margin,
  // supaya findClearRandomSpot menjamin SELURUH kotak tulisan (bukan cuma
  // titik tengahnya saja) bebas dari lintasan/air/bangunan lain.
  const searchRadius = Math.ceil(Math.hypot(halfW, halfH)) + 6;
  const anchor = findClearRandomSpot(searchRadius, 100) || findClearRandomSpot(Math.round(searchRadius * 0.7), 150);
  if (!anchor) return []; // dunia kebetulan terlalu padat di semua sisi — lewati tulisan, petak aksen di bawah tetap jalan seperti biasa

  const jitter = FLOWER_TEXT_CELL_SIZE * 0.28;
  return grid.cells.map((cell) => ({
    x: anchor.x + cell.gx * FLOWER_TEXT_CELL_SIZE - halfW + (Math.random() - 0.5) * jitter,
    z: anchor.z + cell.gy * FLOWER_TEXT_CELL_SIZE - halfH + (Math.random() - 0.5) * jitter,
    stemH: 0.26 + Math.random() * 0.2,
    scale: 0.8 + Math.random() * 0.5,
    rotY: Math.random() * Math.PI * 2,
    tilt: (Math.random() - 0.5) * 0.18,
    colorHex: FLOWER_TEXT_HEAD_COLORS[Math.floor(Math.random() * FLOWER_TEXT_HEAD_COLORS.length)],
    isStar: Math.random() < 0.35,
  }));
}

function buildFlowerFields() {
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4caa6e, roughness: 0.85 });
  // Material kepala sengaja putih polos (0xffffff) — warna asli tiap
  // instance datang dari setColorAt() di bawah, dan mengalikan warna
  // instance dengan putih (1,1,1) membiarkannya tampil apa adanya.
  const roundHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const starHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

  const stemGeo = new THREE.CylinderGeometry(0.035, 0.05, 1, 5); // tinggi dasar 1 unit, diskalakan per-instance lewat matrix
  const roundHeadGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const starHeadGeo = new THREE.OctahedronGeometry(0.19, 0);

  // Bunga tulisan dulu, baru petak aksen acak ditambahkan ke array yang sama.
  const allFlowers = buildFlowerTextPositions(); // { x, z, stemH, scale, rotY, tilt, colorHex, isStar }

  for (let p = 0; p < FLOWER_ACCENT_PATCH_COUNT; p++) {
    // Margin (radius+3) menjaga petak tidak tumpang tindih bangunan/air —
    // jarak aman ke LINTASAN sendiri sudah dijamin tetap (>=16 unit dari
    // titik tengah ke as jalan) oleh findClearRandomSpot terlepas dari
    // margin ini, jadi FLOWER_PATCH_RADIUS (8) sengaja dijaga lebih kecil
    // dari jarak amannya supaya bunga di tepi petak tidak pernah nyampai
    // ke aspal (TRACK_HALF_WIDTH=7).
    const center = findClearRandomSpot(FLOWER_PATCH_RADIUS + 3);
    if (!center) continue;
    const count = FLOWERS_PER_PATCH_MIN + Math.floor(Math.random() * (FLOWERS_PER_PATCH_MAX - FLOWERS_PER_PATCH_MIN));
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * FLOWER_PATCH_RADIUS; // sqrt supaya sebaran rata per luas (bukan menumpuk di tengah)
      allFlowers.push({
        x: center.x + Math.cos(ang) * rad,
        z: center.z + Math.sin(ang) * rad,
        stemH: 0.28 + Math.random() * 0.22,
        scale: 0.75 + Math.random() * 0.6,
        rotY: Math.random() * Math.PI * 2,
        tilt: (Math.random() - 0.5) * 0.22,
        colorHex: FLOWER_HEAD_COLORS[Math.floor(Math.random() * FLOWER_HEAD_COLORS.length)],
        isStar: Math.random() < 0.4,
      });
    }
  }
  if (allFlowers.length === 0) return;

  const roundFlowers = allFlowers.filter((f) => !f.isStar);
  const starFlowers = allFlowers.filter((f) => f.isStar);

  const stems = new THREE.InstancedMesh(stemGeo, stemMat, allFlowers.length);
  const roundHeads = new THREE.InstancedMesh(roundHeadGeo, roundHeadMat, roundFlowers.length);
  const starHeads = new THREE.InstancedMesh(starHeadGeo, starHeadMat, starFlowers.length);
  [stems, roundHeads, starHeads].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  allFlowers.forEach((f, i) => {
    dummy.position.set(f.x, (f.stemH * f.scale) / 2, f.z);
    dummy.rotation.set(f.tilt, f.rotY, f.tilt);
    dummy.scale.set(f.scale, f.stemH * f.scale, f.scale);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
  });

  function placeHeads(mesh, list) {
    list.forEach((f, i) => {
      dummy.position.set(f.x, f.stemH * f.scale, f.z);
      dummy.rotation.set(f.tilt, f.rotY, f.tilt);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHex(f.colorHex);
      mesh.setColorAt(i, color);
    });
    // instanceColor baru dibuat THREE.js begitu setColorAt pertama kali
    // dipanggil — kalau list kosong (kasus ekstrem: semua bunga kebetulan
    // jenis lain), instanceColor tetap null, jadi dijaga di sini supaya
    // tidak pernah melempar error saat load.
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  placeHeads(roundHeads, roundFlowers);
  placeHeads(starHeads, starFlowers);

  stems.instanceMatrix.needsUpdate = true;
  roundHeads.instanceMatrix.needsUpdate = true;
  starHeads.instanceMatrix.needsUpdate = true;

  scene.add(stems, roundHeads, starHeads);
}

// =====================================================================
// SECTION 7B — SUARA (Web Audio API, disintesis — tanpa file audio eksternal)
// =====================================================================

let audioCtx = null;

function ensureAudioContext() {
  // Harus dipanggil dari dalam event yang dipicu gesture pengguna asli
  // (klik/tap/keydown) supaya kebijakan autoplay browser mengizinkannya.
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    } else if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch (e) { /* audio tidak tersedia, biarkan game tetap jalan tanpa suara */ }
}

function playTone(freq, startTime, duration, type, peakGain) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain || 0.2, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

// Jingle ceria (arpeggio naik, bukan lagu tertentu) — dibunyikan saat kue
// perayaan "terbuka" ketika mobil mendekati landmark.
function playPartyJingle() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
  notes.forEach((freq, i) => playTone(freq, now + i * 0.13, 0.3, "triangle", 0.16));
}

// Bunyi "pop" kertas terbuka — dibunyikan saat surat ulang tahun muncul.
function playPaperPopSound() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  playTone(880, now, 0.09, "square", 0.1);
  playTone(1320, now + 0.06, 0.12, "sine", 0.12);
}

function checkCakeTrigger() {
  if (cakeTriggered || !landmarkCenter) return;
  const dist = Math.hypot(carState.x - landmarkCenter.x, carState.z - landmarkCenter.z);
  if (dist < CAKE_TRIGGER_RADIUS) {
    cakeTriggered = true;
    triggerCakeIntro();
  }
}

function triggerCakeIntro() {
  const overlay = document.getElementById("cake-intro");
  const confettiWrap = document.getElementById("cake-intro-confetti");
  overlay.classList.add("active");
  playPartyJingle();
  triggerFireworksShow();
  const emojis = ["🎉", "💕", "✨", "🎈", "💖"];
  for (let i = 0; i < 26; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    piece.style.left = Math.random() * 100 + "%";
    piece.style.animationDelay = (Math.random() * 0.5) + "s";
    confettiWrap.appendChild(piece);
  }
  setTimeout(() => {
    overlay.classList.remove("active");
    confettiWrap.innerHTML = "";
    document.getElementById("birthday-screen").classList.add("active");
    playPaperPopSound();
  }, 1500);
}

// =====================================================================
// SECTION 9 — MOBIL (gaya Mini Cooper, geometry primitif)
// =====================================================================

function buildCar() {
  const group = new THREE.Group();

  // --- Warna & material utama: hijau mint/teal ala mobil retro mungil di
  // foto referensi, bodi mengkilap dengan aksen krom di mana-mana. ---
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3fcdb6, roughness: 0.3, metalness: 0.35, envMapIntensity: 0.6 });
  if (carEnvMap) bodyMat.envMap = carEnvMap; // refleksi lembut, HANYA di bodi mobil (lihat Log Keputusan Desain)
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, roughness: 0.2, metalness: 0.85 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 4.2), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // spatbor bulat menonjol di keempat roda — kesan mobil retro yang
  // gembul/membulat, bukan kotak lurus
  const fenderGeo = new THREE.SphereGeometry(0.58, 12, 10);
  [[-1.25, -1.3], [1.25, -1.3], [-1.25, 1.3], [1.25, 1.3]].forEach(([fx, fz]) => {
    const fender = new THREE.Mesh(fenderGeo, bodyMat);
    fender.position.set(fx, 0.62, fz);
    fender.scale.set(0.62, 0.85, 0.95);
    fender.castShadow = true;
    group.add(fender);
  });

  // rocker panel krom tipis di bawah bodi (bukan lagi warna gelap solid)
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.14, 4.22), chromeMat);
  rocker.position.set(0, 0.24, 0);
  rocker.castShadow = true;
  group.add(rocker);

  // garis sambungan pintu tipis + gagang pintu krom kecil
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x2f9f8c, roughness: 0.5 });
  [-1, 1].forEach((side) => {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.65, 0.03), seamMat);
    seam.position.set(1.31 * side, 0.85, 0.35);
    group.add(seam);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.3), chromeMat);
    handle.position.set(1.32 * side, 1.02, -0.35);
    group.add(handle);
  });

  // --- Ventilasi/louver samping di spatbor depan, ala mobil retro di foto ---
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 3; i++) {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.6, metalness: 0.3 }));
      louver.position.set(1.31 * side, 0.85, -1.55 + i * 0.14);
      group.add(louver);
    }
  });

  // plat nomor depan & belakang
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xfdfdf6, roughness: 0.5 });
  [-2.1, 2.1].forEach((z) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.03), plateMat);
    plate.position.set(0, 0.42, z);
    group.add(plate);
  });

  // pipa knalpot kecil di belakang
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10), chromeMat);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(0.7, 0.32, 2.2);
  group.add(exhaust);

  // bumper depan & belakang KROM (bukan warna bodi lagi) — melengkung
  // tipis membungkus ujung mobil, khas mobil retro di foto referensi
  const bumperGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.55, 12);
  const frontBumper = new THREE.Mesh(bumperGeo, chromeMat);
  frontBumper.rotation.z = Math.PI / 2;
  frontBumper.position.set(0, 0.4, -2.08);
  frontBumper.castShadow = true;
  group.add(frontBumper);
  const rearBumper = frontBumper.clone();
  rearBumper.position.z = 2.08;
  group.add(rearBumper);
  // sirip kecil ujung bumper menekuk ke belakang (ciri khas bumper retro)
  [-1, 1].forEach((side) => {
    [-2.08, 2.08].forEach((bz) => {
      const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.4), chromeMat);
      wrap.position.set(1.28 * side, 0.4, bz + (bz < 0 ? 0.18 : -0.18));
      group.add(wrap);
    });
  });

  // atap membulat tinggi (kaca besar di sekeliling, kesan "bubble car")
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 2.5, 16, 1, false, 0, Math.PI), bodyMat);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.scale.set(1, 0.8, 1);
  roof.position.set(0, 1.18, -0.05);
  roof.castShadow = true;
  group.add(roof);
  // list krom tipis sepanjang tepi bawah atap
  const roofTrim = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.03, 6, 16, Math.PI), chromeMat);
  roofTrim.rotation.z = Math.PI / 2;
  roofTrim.rotation.y = Math.PI / 2;
  roofTrim.scale.set(1, 0.8, 1);
  roofTrim.position.set(0, 1.18, -0.05);
  group.add(roofTrim);

  // jendela kaca besar (depan, belakang, samping) — bening kebiruan pucat,
  // dibingkai list krom tipis
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe4ea, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.75 });
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.68), glassMat);
  windshield.position.set(0, 1.48, -1.18);
  windshield.rotation.x = -0.32;
  group.add(windshield);
  const rearWindow = windshield.clone();
  rearWindow.position.z = 0.92;
  rearWindow.rotation.x = 0.32;
  group.add(rearWindow);
  [-1, 1].forEach((side) => {
    const sideWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.6), glassMat);
    sideWindow.position.set(1.07 * side, 1.48, -0.13);
    sideWindow.rotation.y = Math.PI / 2;
    group.add(sideWindow);
  });

  // --- Jok/interior coklat tan terlihat sekilas dari balik kaca ---
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x9a6a42, roughness: 0.7 });
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 0.14), seatMat);
  seatBack.position.set(0, 1.15, -0.55);
  group.add(seatBack);
  const seatBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.7), seatMat);
  seatBase.position.set(0, 0.92, -0.2);
  group.add(seatBase);
  // setir kecil
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.6 }));
  wheelRing.position.set(-0.5, 1.1, -0.95);
  wheelRing.rotation.x = Math.PI / 2.3;
  group.add(wheelRing);

  // spion bulat krom di tiang tipis, ala foto referensi
  [-1, 1].forEach((side) => {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), chromeMat);
    stalk.position.set(1.32 * side, 1.32, 0.75);
    stalk.rotation.z = side * 0.5;
    group.add(stalk);
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), chromeMat);
    mirror.position.set(1.42 * side, 1.4, 0.75);
    mirror.scale.set(1, 1, 0.55);
    group.add(mirror);
  });

  // lampu belakang bulat merah, dibingkai krom
  [-1, 1].forEach((side) => {
    const tailRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 14), chromeMat);
    tailRing.position.set(0.92 * side, 0.85, 2.08);
    group.add(tailRing);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0xff4d4d, emissiveIntensity: 0.6 }));
    tail.position.set(0.92 * side, 0.85, 2.1);
    group.add(tail);
  });

  // --- Lampu depan bulat besar menonjol dibingkai krom, khas mobil retro ---
  [-1, 1].forEach((side) => {
    const headRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 16), chromeMat);
    headRing.position.set(0.85 * side, 0.9, -2.1);
    group.add(headRing);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfffbe8, emissive: 0xfff2a8, emissiveIntensity: 0.5 }));
    head.position.set(0.85 * side, 0.9, -2.12);
    group.add(head);
    // lampu sein bulat kecil oranye di bawah lampu utama
    const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff9d3d, emissive: 0xff8a1f, emissiveIntensity: 0.5 }));
    indicator.position.set(0.85 * side, 0.6, -2.1);
    group.add(indicator);
  });

  // roda — ban hitam + hubcap krom bundar, spatbor sudah menaungi dari atas
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f1b1f, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 14);
  const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12);
  [[-1.25, -1.3], [1.25, -1.3], [-1.25, 1.3], [1.25, 1.3]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.46, z);
    wheel.castShadow = true;
    group.add(wheel);
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x + (x > 0 ? 0.01 : -0.01), 0.46, z);
    group.add(hub);
  });

  scene.add(group);
  return group;
}

// =====================================================================
// SECTION 10 — FISIKA & COLLISION
// =====================================================================

function initCarState() {
  const p0 = TRACK_WAYPOINTS[0], p1 = TRACK_WAYPOINTS[1];
  const startAngle = Math.atan2(p1.x - p0.x, p1.z - p0.z);
  carState = {
    x: p0.x,
    z: p0.z,
    heading: startAngle,
    speed: 0,
    maxSpeed: 22,
    maxReverse: -9,
    accel: 16,
    decel: 20,
    turnRate: 2.4,
  };
}

function resolveCollisions(nx, nz) {
  const CAR_R = 1.5;
  let x = nx, z = nz;

  for (const c of CIRCLE_COLLIDERS) {
    const dx = x - c.x, dz = z - c.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = c.r + CAR_R;
    if (dist < minDist && dist > 0.0001) {
      const push = (minDist - dist);
      x += (dx / dist) * push;
      z += (dz / dist) * push;
    }
  }

  for (const r of RECT_COLLIDERS) {
    const cos = Math.cos(-r.rotY), sin = Math.sin(-r.rotY);
    const lx = (x - r.x) * cos - (z - r.z) * sin;
    const lz = (x - r.x) * sin + (z - r.z) * cos;
    const hw = r.w / 2, hd = r.d / 2;
    const cx = Math.max(-hw, Math.min(hw, lx));
    const cz = Math.max(-hd, Math.min(hd, lz));
    const dx = lx - cx, dz = lz - cz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < CAR_R && dist > 0.0001) {
      const push = (CAR_R - dist);
      const wx = (dx / dist) * push, wz = (dz / dist) * push;
      const cosB = Math.cos(r.rotY), sinB = Math.sin(r.rotY);
      x += wx * cosB - wz * sinB;
      z += wx * sinB + wz * cosB;
    } else if (dist <= 0.0001) {
      // titik di dalam kotak: dorong keluar via sisi terdekat
      const distLeft = lx + hw, distRight = hw - lx, distTop = lz + hd, distBottom = hd - lz;
      const minEdge = Math.min(distLeft, distRight, distTop, distBottom);
      let wx = 0, wz = 0;
      if (minEdge === distLeft) wx = -(distLeft + CAR_R);
      else if (minEdge === distRight) wx = (distRight + CAR_R);
      else if (minEdge === distTop) wz = -(distTop + CAR_R);
      else wz = (distBottom + CAR_R);
      const cosB = Math.cos(r.rotY), sinB = Math.sin(r.rotY);
      x += wx * cosB - wz * sinB;
      z += wx * sinB + wz * cosB;
    }
  }

  // batas dunia (clamp, tebing hanya dekoratif)
  const margin = WORLD_HALF - 4;
  x = Math.max(-margin, Math.min(margin, x));
  z = Math.max(-margin, Math.min(margin, z));

  return { x, z };
}

function updatePhysics(dt) {
  if (!unlocked) return;

  // throttleAxis/turnDir: -1..1. Dari keyboard nilainya selalu -1/0/1
  // (persis perilaku lama, tidak berubah). Dari joystick analog mobile
  // nilainya kontinu (lihat getThrottleAxis()/getSteerAxis(), SECTION 13)
  // — makanya dikalikan langsung (bukan if/else on-off) supaya gas &
  // belokan analog beneran terasa proporsional saat disentuh.
  const throttleAxis = getThrottleAxis();
  if (throttleAxis > 0.04) carState.speed += carState.accel * dt * throttleAxis;
  else if (throttleAxis < -0.04) carState.speed += carState.accel * dt * throttleAxis; // throttleAxis negatif -> speed otomatis berkurang, sebanding besarnya
  else {
    if (carState.speed > 0) carState.speed = Math.max(0, carState.speed - carState.decel * dt);
    else carState.speed = Math.min(0, carState.speed + carState.decel * dt);
  }
  carState.speed = Math.max(carState.maxReverse, Math.min(carState.maxSpeed, carState.speed));

  const speedRatio = Math.max(0.2, Math.abs(carState.speed) / carState.maxSpeed);
  const turnDir = getSteerAxis();
  const turnSign = carState.speed >= 0 ? 1 : -1;
  if (Math.abs(carState.speed) > 0.05) {
    carState.heading += turnDir * carState.turnRate * speedRatio * turnSign * dt;
  }

  const dx = Math.sin(carState.heading) * carState.speed * dt;
  const dz = Math.cos(carState.heading) * carState.speed * dt;
  const resolved = resolveCollisions(carState.x + dx, carState.z + dz);
  const guided = applyRouteLock(resolved.x, resolved.z);
  carState.x = guided.x;
  carState.z = guided.z;

  carGroup.position.set(carState.x, 0, carState.z);
  carGroup.rotation.y = carState.heading;
}

// --- Lintasan balap: mobil TIDAK BOLEH keluar dari jalur ini sama sekali
// selama `freeRoam` masih false. Memakai TRACK_WAYPOINTS yang sama dengan
// yang dipakai buildRaceTrack() untuk menggambar aspalnya (satu sumber
// data), supaya koridor collision selalu presis mengikuti jalan yang
// terlihat. `freeRoam` baru diset true saat surat ulang tahun ditutup. ---
let freeRoam = false;
const TRACK_HALF_WIDTH = 7; // dijaga dekat lebar aspal (jalan lebar 14 unit) supaya mobil terasa benar-benar "di jalur"

function applyRouteLock(x, z) {
  if (freeRoam) return { x, z };

  // Cari segmen terdekat di sepanjang seluruh lintasan (bukan cuma satu
  // garis), lalu jepit posisi mobil supaya tetap dalam TRACK_HALF_WIDTH
  // dari segmen terdekat itu.
  let bestDist = Infinity, bestCx = x, bestCz = z;
  for (let i = 0; i < TRACK_WAYPOINTS.length - 1; i++) {
    const p1 = TRACK_WAYPOINTS[i], p2 = TRACK_WAYPOINTS[i + 1];
    const dx = p2.x - p1.x, dz = p2.z - p1.z;
    const lenSq = dx * dx + dz * dz;
    let t = lenSq > 0 ? ((x - p1.x) * dx + (z - p1.z) * dz) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = p1.x + dx * t, cz = p1.z + dz * t;
    const d = Math.hypot(x - cx, z - cz);
    if (d < bestDist) { bestDist = d; bestCx = cx; bestCz = cz; }
  }

  if (bestDist > TRACK_HALF_WIDTH) {
    const dx = x - bestCx, dz = z - bestCz;
    const scale = TRACK_HALF_WIDTH / bestDist;
    return { x: bestCx + dx * scale, z: bestCz + dz * scale };
  }
  return { x, z };
}

// =====================================================================
// SECTION 11 — KAMERA CHASE CAM
// =====================================================================

function initChaseCam() {
  camCurrent.set(carState.x, 6, carState.z + 10);
  camTargetCurrent.set(carState.x, 1.2, carState.z);
  // Sinkronkan label tombol kamera dengan camPresetIndex sesungguhnya
  // (bisa "Jauh" di perangkat sentuh, bukan selalu "Sedang" seperti teks
  // statis bawaan di index.html) — lihat komentar di deklarasi
  // `camPresetIndex` (SECTION 1).
  document.getElementById("cam-btn-label").textContent = CAM_PRESETS[camPresetIndex].name;
}

function updateChaseCam(dt) {
  const preset = CAM_PRESETS[camPresetIndex];
  const dirX = Math.sin(carState.heading), dirZ = Math.cos(carState.heading);

  const desired = new THREE.Vector3(
    carState.x - dirX * preset.dist,
    preset.height,
    carState.z - dirZ * preset.dist
  );
  const desiredTarget = new THREE.Vector3(
    carState.x + dirX * preset.look,
    1.2,
    carState.z + dirZ * preset.look
  );

  const smoothing = 1 - Math.exp(-6 * dt);
  camCurrent.lerp(desired, smoothing);
  camTargetCurrent.lerp(desiredTarget, smoothing);

  camera.position.copy(camCurrent);
  camera.lookAt(camTargetCurrent);
}

function cycleCamPreset() {
  camPresetIndex = (camPresetIndex + 1) % CAM_PRESETS.length;
  document.getElementById("cam-btn-label").textContent = CAM_PRESETS[camPresetIndex].name;
}

// =====================================================================
// SECTION 12 — HUD
// =====================================================================

function updateRouteHUD() {
  const el = document.getElementById("route-status");
  if (freeRoam) {
    el.textContent = "🎉 FINISH! Sekarang bebas jelajah ke mana saja!";
    el.classList.add("free");
    setTimeout(() => { el.style.opacity = "0"; }, 3500);
  } else {
    el.textContent = "🏁 Ikuti lintasan menuju FINISH...";
  }
}

function updateHUD() {
  const needle = document.getElementById("compass-needle");
  const label = document.getElementById("compass-label");
  const degrees = ((carState.heading * 180) / Math.PI) % 360;
  needle.style.transform = `rotate(${-carState.heading}rad)`;
  const dirs = ["U", "TL", "T", "TG", "S", "SD", "B", "BL"];
  const idx = Math.round(((degrees + 360) % 360) / 45) % 8;
  label.textContent = dirs[idx];

  const speedPct = Math.max(0, (carState.speed / carState.maxSpeed) * 100);
  document.getElementById("speed-bar-fill").style.width = speedPct + "%";
}

// =====================================================================
// SECTION 13 — INPUT (KEYBOARD + JOYSTICK ANALOG TOUCH)
// =====================================================================
// Kontrol mobile (perangkat sentuh tanpa keyboard fisik, dideteksi lewat
// media query `pointer: coarse`) sebelumnya berupa D-pad 4 tombol —
// kemudinya digital, cuma kiri/kanan penuh atau tidak sama sekali.
// Diganti jadi satu joystick analog virtual (`#joystick`, lihat
// style.css & index.html): sumbu X knob = kemudi (besar-kecilnya
// belokan sebanding seberapa jauh knob ditarik dari tengah, bukan cuma
// on/off), sumbu Y knob = gas/mundur (analog juga sekalian, konsisten).
// Keyboard (panah/WASD) SENGAJA tidak diubah sama sekali — tetap digital
// lewat `keys` seperti semula, supaya tidak ada risiko regresi di
// kontrol desktop. `updatePhysics()` (SECTION 10) membaca axis lewat
// `getThrottleAxis()`/`getSteerAxis()` di bawah, yang mengutamakan
// joystick kalau sedang aktif disentuh, else jatuh balik ke `keys` —
// jadi dua sumber input (analog & digital) hidup berdampingan tanpa
// saling konflik. Lihat Log Keputusan Desain di README.md.

// steerRaw/throttleRaw: -1..1, nol lagi begitu knob dilepas.
const joystick = { active: false, steerRaw: 0, throttleRaw: 0 };

function getThrottleAxis() {
  return joystick.active ? joystick.throttleRaw : ((keys.forward ? 1 : 0) - (keys.backward ? 1 : 0));
}
function getSteerAxis() {
  // Tanda dibalik: menarik knob ke KANAN (steerRaw positif) harus
  // membelokkan mobil ke KANAN — sama seperti dulu dpad-right
  // menghasilkan turnDir negatif di updatePhysics (lihat konvensi
  // `keys.left ? 1 : 0) - (keys.right ? 1 : 0)` di bawah).
  return joystick.active ? -joystick.steerRaw : ((keys.left ? 1 : 0) - (keys.right ? 1 : 0));
}

function initJoystick() {
  const base = document.getElementById("joystick-base");
  const knob = document.getElementById("joystick-knob");
  if (!base || !knob) return; // markup cuma ada utk mobile; dijaga aman kalau suatu saat dihapus

  const MAX_RADIUS = 44; // px, radius geser maksimum knob dari pusat base (base 130px di CSS, jadi ada sisa margin visual di tepi)
  let activePointerId = null;
  let baseRect = null;

  function setKnobVisual(dx, dy) {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function updateFromPointer(clientX, clientY) {
    const cx = baseRect.left + baseRect.width / 2;
    const cy = baseRect.top + baseRect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_RADIUS) {
      const scale = MAX_RADIUS / dist;
      dx *= scale;
      dy *= scale;
    }
    setKnobVisual(dx, dy);
    joystick.steerRaw = dx / MAX_RADIUS;      // -1 (mentok kiri) .. +1 (mentok kanan)
    joystick.throttleRaw = -dy / MAX_RADIUS;  // sumbu Y layar positif ke bawah, dibalik: geser ke ATAS = maju (+1)
  }

  function resetJoystick() {
    joystick.active = false;
    joystick.steerRaw = 0;
    joystick.throttleRaw = 0;
    setKnobVisual(0, 0);
  }

  // Pointer Events (bukan touch/mouse terpisah spt D-pad lama) dipilih
  // sengaja: satu set listener otomatis menangani sentuhan di HP MAUPUN
  // drag mouse (misal saat dites lewat device-toolbar desktop browser),
  // dan `setPointerCapture` menjamin drag tetap terlacak walau jari
  // meleset keluar dari lingkaran base — penting utk kontrol joystick,
  // beda dgn tombol dpad lama yang cukup event per-tombol saja.
  base.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    activePointerId = e.pointerId;
    baseRect = base.getBoundingClientRect();
    joystick.active = true;
    base.setPointerCapture(activePointerId);
    updateFromPointer(e.clientX, e.clientY);
  });
  base.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    updateFromPointer(e.clientX, e.clientY);
  });
  const endHandler = (e) => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    resetJoystick();
  };
  base.addEventListener("pointerup", endHandler);
  base.addEventListener("pointercancel", endHandler);
}

function initInput() {
  window.addEventListener("keydown", (e) => {
    switch (e.key.toLowerCase()) {
      case "arrowup": case "w": keys.forward = true; break;
      case "arrowdown": case "s": keys.backward = true; break;
      case "arrowleft": case "a": keys.left = true; break;
      case "arrowright": case "d": keys.right = true; break;
      case "c": cycleCamPreset(); break;
    }
  });
  window.addEventListener("keyup", (e) => {
    switch (e.key.toLowerCase()) {
      case "arrowup": case "w": keys.forward = false; break;
      case "arrowdown": case "s": keys.backward = false; break;
      case "arrowleft": case "a": keys.left = false; break;
      case "arrowright": case "d": keys.right = false; break;
    }
  });

  initJoystick();

  document.getElementById("cam-btn").addEventListener("click", cycleCamPreset);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// =====================================================================
// SECTION 14 — LAYAR KUNCI PASSWORD
// =====================================================================

function initLockScreen() {
  document.getElementById("lock-hint").textContent = LOCK_HINT;
  const input = document.getElementById("lock-input");
  const card = document.getElementById("lock-card");
  const errorEl = document.getElementById("lock-error");

  function attemptUnlock() {
    ensureAudioContext(); // gesture pengguna asli — aman untuk membuka AudioContext
    if (input.value === LOCK_PASSWORD) {
      unlockSuccess();
    } else {
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
      errorEl.classList.add("show");
    }
  }

  document.getElementById("lock-submit").addEventListener("click", attemptUnlock);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") attemptUnlock(); });

  initDodgeButton();
}

// --- Tombol Malas: dekorasi jahil yang menghindar tiap kali kursor/jari
// mendekat, jadi sengaja tidak pernah bisa diklik. Murni hiburan, tidak
// terhubung ke logic unlock apa pun. ---
function initDodgeButton() {
  const btn = document.getElementById("dodge-btn");
  const DODGE_RADIUS = 110;
  const MARGIN = 20;
  let escaped = false; // belum lepas dari flex row normal

  function randomPosition(avoidX, avoidY) {
    const w = btn.offsetWidth || 150;
    const h = btn.offsetHeight || 44;
    const maxX = Math.max(MARGIN, window.innerWidth - w - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - h - MARGIN);
    let x, y, tries = 0;
    do {
      x = MARGIN + Math.random() * (maxX - MARGIN);
      y = MARGIN + Math.random() * (maxY - MARGIN);
      tries++;
    } while (avoidX != null && Math.hypot(x - avoidX, y - avoidY) < DODGE_RADIUS * 1.4 && tries < 20);
    return { x, y };
  }

  function placeAt(x, y) {
    btn.style.left = x + "px";
    btn.style.top = y + "px";
  }

  // --- Kenapa didesain begini (setelah dua kali salah desain sebelumnya) ---
  // Percobaan sebelumnya SELALU mengonversi tombol malas ke position:fixed
  // tepat saat halaman dimuat, dengan koordinat awal diambil lewat
  // getBoundingClientRect() pada #dodge-btn dan/atau #lock-submit. Ternyata
  // ini rapuh: kalau font custom (Baloo 2, di-@import dari Google Fonts)
  // belum selesai dimuat tepat saat initDodgeButton() jalan, ukuran/posisi
  // yang "difoto" lewat getBoundingClientRect() bisa beda dari tampilan
  // akhir setelah font-nya benar-benar aktif — hasilnya kedua tombol
  // terlihat tidak sejajar/tidak rapi (persis seperti di screenshot).
  //
  // Solusinya: JANGAN sentuh posisi kedua tombol sama sekali di awal.
  // Biarkan KEDUANYA murni mengikuti CSS flexbox normal (.lock-btn-row)
  // sampai kursor/jari BENAR-BENAR mendekat untuk pertama kali — baru pada
  // saat itu (`escapeToFixed()`) tombol malas dikonversi ke position:fixed,
  // memakai ukuran/posisi yang sudah pasti akurat karena halaman sudah
  // sempat dilihat & di-interaksi (font sudah pasti termuat). Tombol
  // "Buka Gerbang" TIDAK PERNAH disentuh JS sama sekali — dia tetap 100%
  // dikendalikan CSS, jadi tidak mungkin lagi ikut bergeser/salah posisi.
  function escapeToFixed() {
    if (escaped) return;
    escaped = true;
    // Kedua tombol diukur DULU selagi masih di flex row normal, LALU
    // KEDUANYA SEKALIGUS dikunci jadi position:fixed di koordinat persis
    // itu. Percobaan sebelumnya cuma mengunci LEBAR "Buka Gerbang" (flex:
    // none + width) tapi tetap membiarkannya di dalam flex row — ternyata
    // itu TIDAK CUKUP: begitu tombol malas (satu-satunya sibling) keluar
    // dari flow, "Buka Gerbang" yang tersisa sendirian tetap ikut BERGESER
    // ke posisi flex-start (kiri) walau ukurannya sudah tidak berubah.
    // Menjadikannya position:fixed juga (bukan cuma menguncinya di flex
    // row) adalah satu-satunya cara supaya posisinya benar-benar tidak
    // tersentuh apa pun yang terjadi pada tombol malas.
    const submitBtn = document.getElementById("lock-submit");
    const row = document.querySelector(".lock-btn-row");
    const submitRect = submitBtn.getBoundingClientRect();
    const dodgeRect = btn.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();

    // PENTING: begitu KEDUA tombol jadi position:fixed, .lock-btn-row jadi
    // kosong (tidak ada child yang masih ikut flow) dan tingginya kolaps
    // ke 0 — ini yang membuat kartu jadi lebih pendek & elemen di atasnya
    // (input password) ikut bergeser turun mendekati tombol yang sudah
    // fixed, persis keluhan user ("jarak kembali mendekat"). Dikunci
    // dengan memberi tinggi eksplisit pada .lock-btn-row sebesar tinggi
    // aslinya, supaya sisa layout kartu (termasuk jarak ke input password)
    // tidak ikut berubah sama sekali.
    row.style.height = rowRect.height + "px";

    submitBtn.style.position = "fixed";
    submitBtn.style.left = submitRect.left + "px";
    submitBtn.style.top = submitRect.top + "px";
    submitBtn.style.width = submitRect.width + "px";
    submitBtn.style.height = submitRect.height + "px";
    submitBtn.style.margin = "0";

    btn.style.width = dodgeRect.width + "px";
    btn.style.height = dodgeRect.height + "px";
    btn.style.position = "fixed";
    btn.style.margin = "0";
    placeAt(dodgeRect.left, dodgeRect.top);
  }

  function maybeDodge(clientX, clientY) {
    if (document.getElementById("lock-screen").classList.contains("hidden")) return;
    if (!escaped) {
      // Belum lepas dari flow — cek dulu apakah kursor sudah cukup dekat
      // untuk memicu pelarian pertama.
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (Math.hypot(clientX - cx, clientY - cy) < DODGE_RADIUS) {
        escapeToFixed();
        const next = randomPosition(clientX, clientY);
        placeAt(next.x, next.y);
      }
      return;
    }
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(clientX - cx, clientY - cy);
    if (dist < DODGE_RADIUS) {
      const next = randomPosition(clientX, clientY);
      placeAt(next.x, next.y);
    }
  }

  window.addEventListener("mousemove", (e) => maybeDodge(e.clientX, e.clientY));
  window.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (t) maybeDodge(t.clientX, t.clientY);
  }, { passive: true });

  // kalau berhasil "tersentuh" (mis. via Tab+Enter keyboard), tetap kabur
  btn.addEventListener("click", () => {
    escapeToFixed();
    const next = randomPosition(null, null);
    placeAt(next.x, next.y);
  });

  window.addEventListener("resize", () => {
    if (!escaped) return; // masih di flow normal — CSS yang urus otomatis
    if (document.getElementById("lock-screen").classList.contains("hidden")) return;
    const rect = btn.getBoundingClientRect();
    const maxX = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - rect.height - MARGIN);
    placeAt(Math.min(rect.left, maxX), Math.min(rect.top, maxY));
  });
}

function unlockSuccess() {
  unlocked = true;
  const burstWrap = document.getElementById("lock-success-burst");
  const emojis = ["💕", "🎉", "✨"];
  for (let i = 0; i < 24; i++) {
    const el = document.createElement("div");
    el.className = "burst-emoji";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = "50%";
    el.style.top = "50%";
    const angle = Math.random() * Math.PI * 2;
    const dist = 150 + Math.random() * 250;
    el.style.setProperty("--bx", Math.cos(angle) * dist + "px");
    el.style.setProperty("--by", Math.sin(angle) * dist + "px");
    burstWrap.appendChild(el);
  }
  setTimeout(() => {
    document.getElementById("lock-screen").classList.add("hidden");
    burstWrap.innerHTML = "";
  }, 900);

  document.getElementById("birthday-close").addEventListener("click", () => {
    document.getElementById("birthday-screen").classList.remove("active");
    freeRoam = true; // surat sudah dibaca — mobil sekarang bebas jelajah ke mana saja
    updateRouteHUD();
  });
}

// =====================================================================
// SECTION 15 — LOOP UTAMA
// =====================================================================

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  updatePhysics(dt);
  updateChaseCam(dt);
  updateHUD();
  updateLandmarkAnimations(elapsed);
  updateFireworks(dt);
  updateClouds(dt);
  updateBirds(elapsed);
  updateClowns(elapsed);
  updateAnimals(elapsed);
  updateAirplanes(elapsed, dt);
  updateGreeters();
  checkCakeTrigger();

  renderer.render(scene, camera);
}

// =====================================================================
// SECTION 16 — BOOTSTRAP
// =====================================================================

function populateBirthdayLetter() {
  // Judul surat diisi dari BIRTHDAY_PERSON_NAME (bukan hardcode di HTML)
  // supaya konten tetap terpusat di satu tempat (SECTION 0), konsisten
  // dgn kenapa BIRTHDAY_LETTER_LINES sendiri sudah dipisah dari markup.
  const title = document.getElementById("birthday-title");
  if (title) title.textContent = `Selamat Ulang Tahun, ${BIRTHDAY_PERSON_NAME}! 💕`;

  const body = document.getElementById("birthday-letter-body");
  body.innerHTML = "";
  BIRTHDAY_LETTER_LINES.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    body.appendChild(p);
  });
}

function init() {
  clock = new THREE.Clock();
  initRenderer();
  initScene();
  initProceduralEnvMap();
  initLights();
  buildGround();

  buildWater();
  buildBoundaryWalls();
  buildRaceTrack();
  buildLandmark();
  buildClowns();
  buildAirplanes();
  buildPhotoGates();
  buildBigBuildings();
  buildTugus();
  buildCuteStatues();
  buildCityPeople();
  buildCityClowns();
  buildCityAnimals();
  buildFlowerFields();
  buildClouds();
  buildBirds();

  carGroup = buildCar();
  initCarState();
  carGroup.position.set(carState.x, 0, carState.z);
  carGroup.rotation.y = carState.heading;
  initChaseCam();

  initInput();
  initLockScreen();
  populateBirthdayLetter();

  document.getElementById("loading-screen").classList.add("hidden");

  animate();
}

window.addEventListener("DOMContentLoaded", init);
