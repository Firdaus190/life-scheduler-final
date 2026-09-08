# Life Scheduler — Personal OS (v3)

Redesign & bug-fix pass di atas project yang sama (bukan project baru).

## Apa yang diperbaiki di versi ini
- **Bug kritis (penyebab "Calendar kosong")**: fungsi konversi tanggal di server
  memanggil `iso()` dengan argumen yang salah tipe, sehingga setiap kali ada
  aktivitas satu-kali ("Sekali") — termasuk yang default dipilih saat menambah
  aktivitas baru — seluruh request Calendar/Dashboard gagal (500 error) dan
  tampilan jadi kosong. Sudah diperbaiki total (`toISO` vs `parseISO` dipisah).
- Jadwal mingguan (Senin–Minggu) ditulis ulang persis sesuai yang diminta,
  memakai tipe recurring **"custom" (daftar hari eksplisit)** sehingga tidak
  bergantung pada tanggal jangkar yang bisa salah hari.
- Bootcamp sekarang muncul Jumat 19:00–21:00 **dan** Sabtu **dan** Minggu
  09:00–11:00 (sebelumnya hanya Sabtu).
- Isya tidak lagi dobel di hari Jumat: Isya biasa (19:00–19:45) eksplisit
  mengecualikan Jumat, Isya Jumat terpisah (21:00–21:30) setelah Bootcamp.
- KP dipecah per hari sesuai jam kuliah (bukan blok 07:40–16:40 mentah), jadi
  tidak lagi konflik dengan Data Warehouse/Metodologi/English/Pemodelan
  Data/Manajemen Proyek.
- Versi seed dinaikkan (`seed_version`) — kalau kamu sudah pernah menjalankan
  versi lama dan `scheduler.db` sudah berisi data lama/rusak, database akan
  otomatis direset ke jadwal yang benar saat pertama kali dijalankan.

## Fitur
- Dashboard: progress hari ini, next activity, visual timeline, status
  Auto Scheduler & konflik.
- Calendar: tampilan mingguan **time-grid per jam**, highlight hari ini,
  klik event untuk detail/edit, navigasi minggu.
- My Schedule: aktivitas dikelompokkan **per hari** (bukan satu tabel panjang).
- Analytics: distribusi kategori, progress minggu ini, tren 7 hari.
- Dark mode penuh (sidebar, card, calendar, modal, dsb), tersimpan di
  `localStorage` sehingga tidak reset saat refresh.
- CRUD lengkap: Add / Edit / Delete / Complete, kategori, prioritas,
  recurring (termasuk pilih hari custom), flexible, catatan.
- **Subtugas**: setiap aktivitas bisa dipecah jadi checklist langkah kecil.
  Dikelola dari modal Detail (klik aktivitas) — tambah, centang, atau hapus
  subtugas. Progresnya (mis. "2/5") otomatis muncul sebagai badge di judul
  aktivitas pada Dashboard, Calendar, dan My Schedule. Untuk aktivitas
  berulang, checklist ini dibagikan ke semua kemunculannya (sama seperti
  catatan), bukan per tanggal.
- Auto Scheduler: P1 wajib (kuliah & ibadah), P2 tinggi, P3 sedang,
  P4–P5 fleksibel — otomatis menggeser aktivitas fleksibel saat bentrok.

## Jalankan
1. Install Node.js LTS.
2. Buka folder ini di terminal / VS Code.
3. `npm install`
4. `npm start`
5. Buka `http://localhost:3000`

## Data
File `scheduler.db` dibuat otomatis. Kalau ingin memaksa reset total ke
jadwal bawaan, hapus file `scheduler.db` lalu jalankan ulang `npm start`.

## Export / Import & Sinkronisasi Google Calendar
Widget **"Data & Sync"** di sidebar menyediakan:

- **Export JSON** — unduh semua aktivitas sebagai file `.json` (backup, atau
  untuk dipindah ke instalasi lain).
- **Import JSON** — pilih file `.json` hasil export di atas. Bisa memilih
  "Ganti semua" (hapus data lama, ganti total) atau "Tambahkan" (gabung
  dengan data yang sudah ada).
- **Export .ics** — unduh file kalender standar (`.ics`) yang bisa langsung
  di-*import* ke Google Calendar, Outlook, atau Apple Calendar
  (Google Calendar → Settings → Import & export → Import). Aktivitas
  berulang (harian/mingguan/hari tertentu) otomatis jadi *recurring event*
  di kalender tersebut. Ini **tidak butuh setup apa pun** — paling simpel
  kalau cuma mau jadwal muncul di Google Calendar sekali jalan.
- **Hubungkan Google Calendar** — sinkronisasi dua arah otomatis (setiap
  klik "Sync Sekarang" akan membuat/memperbarui event 14 hari ke depan di
  kalender utama akun Google kamu). Ini butuh setup OAuth sendiri (langkah
  di bawah), karena aplikasi ini jalan lokal dan tidak punya kredensial
  Google bawaan.

### Setup OAuth Google Calendar (sekali saja)
1. Buka [Google Cloud Console](https://console.cloud.google.com/), buat
   project baru (atau pakai yang sudah ada).
2. Aktifkan **Google Calendar API** (menu "APIs & Services" → "Library").
3. Buka "APIs & Services" → "OAuth consent screen" → pilih **External**,
   isi nama app & email, simpan (tidak perlu submit untuk verifikasi kalau
   cuma dipakai sendiri — tambahkan email Google kamu sebagai *test user*).
4. Buka "APIs & Services" → "Credentials" → **Create Credentials** →
   **OAuth client ID** → tipe **Web application**.
5. Di **Authorized redirect URIs**, tambahkan persis:
   `http://localhost:3000/auth/google/callback`
6. Simpan, lalu salin **Client ID** dan **Client Secret** yang muncul.
7. Set sebagai environment variable sebelum `npm start`, misalnya lewat
   file `.env` (butuh `npm install dotenv` lalu `require('dotenv').config()`
   di baris pertama `server.js`) atau langsung di terminal:
   ```bash
   # Windows PowerShell
   $env:GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
   $env:GOOGLE_CLIENT_SECRET="xxxx"
   npm start

   # macOS/Linux
   GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com" GOOGLE_CLIENT_SECRET="xxxx" npm start
   ```
8. Buka app, klik **"Hubungkan Google Calendar"** di sidebar, login &
   izinkan akses. Setelah itu tombol **"Sync Sekarang"** akan membuat/
   memperbarui event di kalender utama akun tersebut.

Token disimpan lokal di `scheduler.db` (tabel `settings`), bukan dikirim ke
mana pun selain langsung ke Google. Klik **"Putuskan"** kapan saja untuk
menghapus koneksi.

## Proteksi Streak
Widget **"Proteksi Streak"** di sidebar terpisah dari Reminder biasa.
Kalau aktif, Life Scheduler memantau kebiasaan (habit) yang punya streak
aktif (≥1 hari) dan ada kemunculan hari ini yang belum ditandai selesai:
- **Peringatan** dikirim X menit sebelum jam selesai (`end_time`) kebiasaan
  itu — sesuai pilihan di dropdown (15/30/60/90 menit).
- **Peringatan darurat** ("nyaris hilang") dikirim sekali lagi kalau jam
  selesai sudah lewat tapi belum ditandai selesai, sampai maksimal 3 jam
  setelahnya.
Butuh izin notifikasi browser yang sama dengan Reminder biasa.