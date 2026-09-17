PENTING — cara kerja foto di proyek ini SUDAH BERUBAH:

Foto yang tampil di gapura-gapura foto sekarang diambil dari file
assets/photos-embedded.js (data di-embed langsung sebagai base64), BUKAN
dibaca ulang dari file .jpg di folder ini setiap kali index.html dibuka.
Ini sengaja dilakukan supaya foto DIJAMIN tampil walau index.html dibuka
langsung lewat dobel-klik (file://) tanpa server — memuat file gambar
eksternal sebagai tekstur WebGL ternyata tidak selalu bisa diandalkan di
kondisi file:// (lihat README.md -> Log Keputusan Desain untuk detail
teknisnya).

File .jpg di folder ini (foto-1.jpg s/d foto-10.jpg) sekarang HANYA
arsip/referensi asal — mengganti isinya TIDAK akan otomatis mengubah apa
yang tampil di gapura foto lagi.

CARA PAKAI FOTO ASLI KAMU SENDIRI — pilih salah satu:

Opsi 1 — jalankan server lokal sederhana (paling gampang, real-time):
  1. Timpa file foto-1.jpg, foto-2.jpg, dst di folder ini dengan foto asli
     kamu (nama & urutan harus tetap sama).
  2. Buka terminal di folder utama proyek (yang ada index.html-nya),
     jalankan: python3 -m http.server
  3. Buka http://localhost:8000 di browser (BUKAN dobel-klik index.html).
     Lewat server lokal begini, pemuatan foto langsung dari file eksternal
     jadi jauh lebih andal.

Opsi 2 — generate ulang assets/photos-embedded.js (tetap bisa dobel-klik
langsung tanpa server):
  1. Timpa foto-1.jpg dst seperti Opsi 1.
  2. Jalankan script Python singkat ini dari folder utama proyek untuk
     membuat ulang assets/photos-embedded.js:

     python3 -c "
import base64, json
out = {}
for i in range(1, 11):
    fname = f'foto-{i}.jpg'
    with open(f'assets/photos/{fname}', 'rb') as f:
        out[fname] = 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode()
with open('assets/photos-embedded.js', 'w') as f:
    f.write('const EMBEDDED_PHOTOS = ' + json.dumps(out) + ';\n')
"

Mau nambah/mengurangi jumlah gapura foto? Ubah juga angka
TOTAL_PHOTO_COUNT di awal script.js, dan sesuaikan rentang angka (1-10)
di script Python Opsi 2 di atas.
