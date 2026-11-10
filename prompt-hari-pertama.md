# Prompt Hari 1: Aplikasi Manajemen Vendor Wedding

Kamu adalah agen coding yang membantu saya membangun aplikasi web manajemen vendor wedding Indonesia (MUA, fotografer, WO, mahar & seserahan) untuk dipakai dari HP.

## Konteks proyek

- Stack: Next.js (App Router, TypeScript), Tailwind CSS, Supabase (Postgres + Auth), deploy ke Vercel.
- UI berbahasa Indonesia, mobile-first.
- Data antar vendor dipisah dengan Row-Level Security (RLS) di PostgreSQL.
- MVP: login + peran, klien, paket, booking + kalender, pembayaran DP.

## Aturan kerja (berlaku untuk semua tahap)

1. Kerjakan tahap secara berurutan: Tahap 1 sampai Tahap 5. Jangan lompat.
2. Sebelum mengubah banyak file, tampilkan rencana singkat dan tunggu persetujuan saya.
3. Jangan menulis secret (URL/key Supabase, service_role key) ke file yang di-commit. Gunakan `.env.local`, dan pastikan masuk `.gitignore`.
4. Setelah setiap tahap selesai: jalankan dan uji hasilnya, laporkan apa yang lulus dan apa yang gagal, lalu berhenti dan tunggu saya sebelum lanjut ke tahap berikutnya.
5. Jika ada error, cari akar masalahnya. Jangan hanya menambal gejala.
6. Jangan menjalankan SQL ke database sebelum saya menyetujui isinya.
7. Beri tahu saya jika ada keputusan yang belum jelas, jangan menebak untuk hal yang menyangkut data atau uang.

---

## Tahap 1: Setup proyek

1. Inisialisasi Next.js (App Router) + TypeScript + Tailwind CSS di folder ini.
2. Pasang `@supabase/supabase-js` dan `@supabase/ssr`, lalu buat helper klien Supabase untuk browser dan untuk server.
3. Buat `.env.local.example` berisi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Pastikan `.env.local` masuk `.gitignore`.
4. Buat struktur folder: `src/app`, `src/components`, `src/lib`, `supabase/migrations`.
5. Buat halaman awal yang mengecek koneksi ke Supabase dan menampilkan tulisan "Terhubung" bila berhasil.
6. Jalankan dev server, buka di browser, dan pastikan tidak ada error.

**Selesai bila:** `localhost:3000` menampilkan "Terhubung" dan commit pertama sudah dibuat.

---

## Tahap 2: Database dan RLS

Buat migrasi SQL di `supabase/migrations` untuk skema multi-tenant. Tampilkan rencana dan SQL dulu; jangan menjalankan apa pun sebelum saya setuju.

Tabel (semua punya `id` uuid dan `created_at`; semua kecuali `workspaces` punya `workspace_id`):

- `workspaces`: nama, jenis_usaha (mua/fotografer/wo/seserahan), slug unik
- `workspace_members`: workspace_id, user_id, role (owner/staff/crew)
- `clients`: nama, no_hp, email, catatan
- `packages`: nama, harga, deskripsi
- `bookings`: client_id, package_id, tanggal_acara, lokasi, status (baru/fitting/selesai/batal), total_harga, catatan
- `payments`: booking_id, jenis (dp/cicilan/pelunasan), jumlah, tanggal_bayar, catatan
- `booking_assignments`: booking_id, member_id, tugas

Row-Level Security:

- Aktifkan RLS di semua tabel.
- Buat fungsi helper `is_member(workspace_id)` dan `has_role(workspace_id, roles)`.
- Owner dan staff: baca/tulis semua data di workspace-nya.
- Crew: hanya baca booking yang ditugaskan kepadanya.
- Tidak boleh ada akses lintas workspace.

Tambahkan index pada `workspace_id` dan `tanggal_acara`. Buat juga skrip tes SQL yang membuktikan user di workspace A tidak bisa melihat atau mengubah data workspace B.

**Selesai bila:** semua tabel ada, RLS aktif, dan tes isolasi antar workspace lulus.

---

## Tahap 3: Login dan peran

Implementasikan autentikasi dengan Supabase Auth (email + password).

1. Halaman `/masuk` dan `/daftar` dalam bahasa Indonesia, dengan validasi form dan pesan error yang jelas.
2. Saat mendaftar: buat workspace baru (pilih jenis usaha) dan jadikan pengguna sebagai owner, lewat fungsi database atau server action yang aman.
3. Middleware Next.js yang melindungi semua rute `/app/*` dan mengarahkan yang belum login ke `/masuk`.
4. Halaman `/app/pengaturan/tim`: owner bisa mengundang staff atau crew (cukup pakai kode undangan dulu) dan mengubah peran.
5. Helper server `getCurrentWorkspace()` dan `getCurrentRole()`.

Uji alur daftar, masuk, dan keluar lewat browser, lalu laporkan hasilnya.

**Selesai bila:** daftar, masuk, keluar berjalan, dan rute `/app` tidak bisa dibuka tanpa login.

---

## Tahap 4: Layout dan dashboard

Buat layout aplikasi di `/app`.

- Sidebar untuk desktop dan bottom navigation untuk HP: Dashboard, Booking, Klien, Tagihan, Tim, Pengaturan.
- Menu mengikuti peran: crew hanya melihat "Jadwal saya".
- Dashboard berisi kartu ringkasan (booking baru, acara 7 hari ke depan, total yang belum lunas) dari data Supabase, plus daftar jadwal hari ini.
- Gaya bersih dan hangat ala aplikasi wedding, font mudah dibaca, tombol besar untuk layar HP.
- Komponen yang bisa dipakai ulang: Button, Card, Input, Modal, EmptyState.

Cek tampilan di lebar 375px dan 1280px lewat browser, lalu tunjukkan screenshot-nya.

**Selesai bila:** menu berpindah halaman dengan benar dan tampilan rapi di layar HP maupun laptop.

---

## Tahap 5: Klien, paket, dan booking

Buat modul Klien, Paket, dan Booking dengan CRUD lengkap. Semua query lewat Supabase dan harus mematuhi RLS.

- Klien: daftar dengan pencarian, tambah, ubah, hapus, dan halaman detail berisi riwayat booking.
- Paket: kelola nama dan harga paket layanan.
- Booking: form (klien, paket, tanggal acara, lokasi, total harga, status), tampilan daftar dan kalender bulanan, serta ubah status.
- Aturan: beri peringatan bila tanggal acara melebihi kapasitas harian (default 1 booking per hari, bisa diubah di pengaturan).
- Tambahkan data contoh (seed) untuk demo.

Uji alur: tambah klien, buat booking, ubah status, lihat di kalender. Perbaiki semua error yang muncul dan laporkan hasilnya.

**Selesai bila:** satu alur lengkap (klien, booking, kalender, ubah status) jalan tanpa error.

---

## Penutup hari 1

Setelah Tahap 5, berikan ringkasan singkat:

- Apa saja yang sudah jadi dan sudah diuji.
- Apa yang belum selesai atau masih bermasalah.
- Langkah deploy ke Vercel (import repo, isi environment variable Supabase).
