# PANDUAN DEPLOY SUPABASE SELF-HOSTED DI VPS (UNTUK KALINDO SCAN)

Panduan lengkap instalasi Supabase resmi di VPS sendiri (Docker) agar aplikasi Kalindo Scan dapat menangani ratusan scan paralel tanpa limit kuota dan biaya Rp 0.

---

## 🚀 Mengapa Trik Ini Solusi Terbaik untuk Kalindo Scan?

1. **Perbandingan dengan PocketBase (SQLite):**
   - PocketBase menggunakan SQLite file tunggal (`single-writer lock`). Jika 20-50 picker/packer scan bersamaan, seluruh file terkunci (`database is locked`) dan memicu antrean lag/freeze.
   - Supabase menggunakan **PostgreSQL 15+** dengan **Multi-Version Concurrency Control (MVCC)** dan **Row-Level Locking**. Ratusan scan per detik diproses secara paralel tanpa saling mengunci antrean!

2. **Perbandingan dengan Supabase Cloud Free:**
   - Supabase Cloud Free Tier memiliki limit 500 MB DB, auto-pause jika idle, dan kuota egress 5 GB (yang menyebabkan error 402 Payment Required).
   - Supabase Self-Hosted di VPS Anda:
     - **Ukuran DB:** Sesuai besar SSD VPS (50 GB - 200 GB+ = puluhan juta record resi).
     - **Egress Bandwidth:** Unlimited (sesuai kuota VPS).
     - **Biaya Tambahan:** **Rp 0** (numpang di VPS yang sudah Anda sewa).
     - **Zero Code Change:** Kode aplikasi di project ini tidak perlu diubah, hanya ganti URL & Key di `.env`.

---

## 🛠️ Langkah 1: Persiapan di VPS (SSH)

Login ke VPS Anda via terminal / PowerShell:
```bash
ssh root@IP_VPS_ANDA
```

Pastikan Docker & Docker Compose sudah terpasang:
```bash
docker --version
docker compose version
```
*(Jika belum terpasang di Ubuntu/Debian, install dengan: `curl -fsSL https://get.docker.com | sh`)*

---

## 📦 Langkah 2: Download Docker Supabase Resmi

Jalankan perintah berikut di VPS:
```bash
# 1. Buat folder supabase
mkdir -p /opt/supabase && cd /opt/supabase

# 2. Clone repositori resmi supabase
git clone --depth 1 https://github.com/supabase/supabase.git

# 3. Masuk ke direktori docker
cd supabase/docker

# 4. Salin file environment contoh
cp .env.example .env
```

---

## 🔑 Langkah 3: Konfigurasi Kunci Keamanan (.env)

Buka file `.env` di VPS:
```bash
nano .env
```

Pastikan nilai berikut diatur (atau biarkan default bawaan supabase docker untuk testing awal):
- `POSTGRES_PASSWORD`: Buat password database Anda (misal: `KalindoDb2026!Secret`)
- `JWT_SECRET`: Secret JWT (minimal 32 karakter acak)
- `ANON_KEY`: Kunci anonim untuk frontend aplikasi web
- `SERVICE_ROLE_KEY`: Kunci admin backend

> **Tips:** Template `.env.example` dari Supabase Docker sudah menyertakan pasangan `JWT_SECRET`, `ANON_KEY`, dan `SERVICE_ROLE_KEY` default yang langsung siap pakai jika Anda ingin uji coba cepat.

---

## ▶️ Langkah 4: Jalankan Supabase di VPS

Jalankan perintah berikut:
```bash
# Download semua image container Supabase (Postgres, Realtime, Kong, Studio, GoTrue Auth)
docker compose pull

# Jalankan semua container di background
docker compose up -d
```

Cek status container:
```bash
docker compose ps
```
Semua container (`supabase-db`, `supabase-kong`, `supabase-auth`, `supabase-realtime`, `supabase-studio`) akan berstatus **Up (healthy)**.

---

## 🖥️ Langkah 5: Buka Supabase Studio & Jalankan Skema Database Kalindo

1. Buka browser Anda dan akses:
   ```
   http://IP_VPS_ANDA:8000
   ```
   *(Atau port dashboard Studio yang tertera, biasanya login dengan user `supabase` dan password yang ada di `.env`)*
2. Di dashboard Supabase Studio, masuk ke menu **SQL Editor**.
3. Klik tombol **New Query**.
4. Buka file `kalindo_selfhosted_complete_schema.sql` yang sudah disediakan di project ini.
5. Copy seluruh isinya, paste ke SQL Editor di browser, lalu klik **RUN**.
6. Semua tabel (`scanned_items`, `leader_scan_2`, `admin_users`, `batches`, `deletion_logs`, dll.) serta realtime websocket langsung aktif!

---

## 🔌 Langkah 6: Hubungkan Project `kalindo scan server ujicoba`

Buka file `.env` di komputer Anda pada project ini:
```env
# Ganti dengan endpoint VPS Anda:
VITE_SUPABASE_URL=http://IP_VPS_ANDA:8000
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (salin ANON_KEY dari .env VPS)
```

Jalankan aplikasi di localhost:
```bash
npm run dev
```
Buka `http://localhost:3001/` — Aplikasi Kalindo Scan Anda sekarang terhubung langsung ke PostgreSQL VPS Anda dengan performa super cepat dan kapasitas database tanpa batas!

---

## 🌐 Rekomendasi Tambahan (HTTPS Domain & Cloudflare)

Jika ingin aplikasi diakses via HTTPS (diperlukan agar kamera barcode scanner di HP Android/iOS bisa aktif):
1. Pasang Nginx Reverse Proxy di VPS Anda atau gunakan **Cloudflare Tunnel** (gratis).
2. Arahkan subdomain (misal: `https://supabase.domainanda.com`) ke port `8000`.
3. Ganti `VITE_SUPABASE_URL=https://supabase.domainanda.com` di `.env`.
