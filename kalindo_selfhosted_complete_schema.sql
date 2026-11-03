-- ==============================================================================
-- KALINDO SCAN - SKEMA DATABASE RESMI LENGKAP UNTUK SUPABASE SELF-HOSTED (POSTGRESQL 15+)
-- ==============================================================================
-- Petunjuk:
-- 1. Buka Supabase Studio di VPS Anda (http://IP_VPS:8000 atau port 3000/dashboard)
-- 2. Masuk ke menu "SQL Editor" > klik "New Query"
-- 3. Copy-Paste seluruh isi skrip ini lalu klik "RUN"
-- ==============================================================================

-- 1. EKSTENSI POSTGRESQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABEL: scanned_items (Tabel Utama Operasional Scan Gudang)
CREATE TABLE IF NOT EXISTS public.scanned_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    barcode TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    employee_name TEXT DEFAULT '',
    destination TEXT DEFAULT '',
    priority TEXT DEFAULT 'NORMAL',
    description TEXT DEFAULT '',
    menu_context TEXT DEFAULT 'DEFAULT',
    scan_mode TEXT DEFAULT 'INDIVIDU',
    team_members JSONB DEFAULT '[]'::jsonb,
    excel_filename TEXT DEFAULT '',
    report_keterangan TEXT DEFAULT '',
    report_msku TEXT DEFAULT '',
    report_qty TEXT DEFAULT '',
    order_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pastikan kolom selalu ada jika tabel sudah dibuat sebelumnya
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS menu_context TEXT DEFAULT 'DEFAULT';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS order_id TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS scan_mode TEXT DEFAULT 'INDIVIDU';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS team_members JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS excel_filename TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS report_keterangan TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS report_msku TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS report_qty TEXT DEFAULT '';

-- Indeks Kecepatan Tinggi (B-Tree + Pattern Ops untuk Prefix AWB / JNE / J&T / SPX)
CREATE INDEX IF NOT EXISTS idx_scanned_items_barcode ON public.scanned_items (barcode);
CREATE INDEX IF NOT EXISTS idx_scanned_items_barcode_pattern ON public.scanned_items (barcode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_scanned_items_timestamp ON public.scanned_items (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scanned_items_role ON public.scanned_items (role);
CREATE INDEX IF NOT EXISTS idx_scanned_items_order_id ON public.scanned_items (order_id);
CREATE INDEX IF NOT EXISTS idx_scanned_items_employee ON public.scanned_items (employee_name);

-- Unique Index Harian Berdasarkan Konteks Menu (Mencegah Double Scan di Hari Sama Sesuai Aturan)
DROP INDEX IF EXISTS unique_scan_per_day_role;
DROP INDEX IF EXISTS unique_scan_per_day_role_menu;
CREATE UNIQUE INDEX unique_scan_per_day_role_menu 
ON public.scanned_items (
    barcode, 
    role, 
    ((to_timestamp(timestamp / 1000) AT TIME ZONE 'Asia/Jakarta')::date), 
    COALESCE(menu_context, 'DEFAULT') 
);


-- 3. TABEL: leader_scan_2 (Penugasan Pretelan & Leader Scan)
CREATE TABLE IF NOT EXISTS public.leader_scan_2 (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    barcode TEXT NOT NULL,
    assignment_mode TEXT DEFAULT 'INDIVIDU',
    assignees JSONB DEFAULT '[]'::jsonb,
    leader_name TEXT DEFAULT 'LEADER',
    leader_profile TEXT DEFAULT 'LEADER',
    status TEXT DEFAULT 'ASSIGNED',
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    scan_type TEXT DEFAULT 'PRETELAN',
    date TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leader_scan_barcode ON public.leader_scan_2 (barcode);
CREATE INDEX IF NOT EXISTS idx_leader_scan_timestamp ON public.leader_scan_2 (timestamp DESC);


-- 4. TABEL: admin_users (Data Akun & Hak Akses Admin)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ
);

-- Akun default admin (jika belum ada)
INSERT INTO public.admin_users (username, password, permissions)
VALUES ('admin', 'admin123', '["ALL", "DASHBOARD", "SETTINGS", "EMPLOYEES", "PINS"]')
ON CONFLICT (username) DO NOTHING;


-- 5. TABEL: app_users (Data Karyawan & Master PIN)
CREATE TABLE IF NOT EXISTS public.app_users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    pin TEXT,
    role TEXT DEFAULT 'PICKER',
    allowed_roles JSONB DEFAULT '[]'::jsonb,
    shift TEXT,
    daily_target INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users (email);
CREATE INDEX IF NOT EXISTS idx_app_users_name ON public.app_users (name);


-- 6. TABEL: batches & batch_items (Batch Import & Sortir Batch)
CREATE TABLE IF NOT EXISTS public.batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    batch_name TEXT NOT NULL,
    created_by TEXT DEFAULT '',
    total_items INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.batch_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    batch_id TEXT REFERENCES public.batches(id) ON DELETE CASCADE,
    barcode TEXT NOT NULL,
    order_id TEXT,
    status TEXT DEFAULT 'PENDING',
    scanned_at TIMESTAMPTZ,
    scanned_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON public.batch_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_barcode ON public.batch_items (barcode);
CREATE INDEX IF NOT EXISTS idx_batch_items_barcode_pattern ON public.batch_items (barcode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_batch_items_order_id ON public.batch_items (order_id);


-- 7. TABEL: cancelled_orders (Proteksi Resi Batal Marketplace / Ginee)
CREATE TABLE IF NOT EXISTS public.cancelled_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode VARCHAR(100) NOT NULL UNIQUE,
    tracking_no VARCHAR(100),
    order_sn VARCHAR(100),
    channel_order_sn VARCHAR(100),
    cancelled_at TIMESTAMPTZ DEFAULT now(),
    cancelled_by VARCHAR(100) DEFAULT 'admin',
    reason TEXT DEFAULT 'Dibatalkan di Marketplace / Ginee OMS',
    shop_name VARCHAR(150),
    channel VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancelled_orders_barcode ON public.cancelled_orders (barcode);
CREATE INDEX IF NOT EXISTS idx_cancelled_orders_active ON public.cancelled_orders (is_active);


-- 8. TABEL: deletion_logs (Audit Riwayat Penghapusan)
CREATE TABLE IF NOT EXISTS public.deletion_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_by TEXT NOT NULL DEFAULT 'Unknown',
    user_role TEXT DEFAULT '',
    menu_name TEXT NOT NULL,
    tab_name TEXT NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 1,
    target_summary TEXT DEFAULT '',
    deleted_data JSONB DEFAULT '[]'::jsonb,
    client_info TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_at ON public.deletion_logs (deleted_at DESC);


-- 9. TABEL: running_texts (Running Banner Text Pengumuman)
CREATE TABLE IF NOT EXISTS public.running_texts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT now()
);


-- 10. REALTIME PUBLICATION SETUP (Mendukung WebSockets Realtime untuk Multi-User Scan)
-- Di Supabase Self-Hosted, kita aktifkan Logical Replication pada tabel-tabel operasional
ALTER TABLE public.scanned_items REPLICA IDENTITY FULL;
ALTER TABLE public.leader_scan_2 REPLICA IDENTITY FULL;
ALTER TABLE public.cancelled_orders REPLICA IDENTITY FULL;
ALTER TABLE public.running_texts REPLICA IDENTITY FULL;
ALTER TABLE public.deletion_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scanned_items, public.leader_scan_2, public.cancelled_orders, public.running_texts, public.deletion_logs;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Publication table addition note: %', SQLERRM;
END $$;


-- 11. HAK AKSES API POSTGREST (Anon & Authenticated)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Nonaktifkan RLS pada tabel operasional agar akses scan dari aplikasi gudang sangat cepat tanpa bottleneck
ALTER TABLE public.scanned_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_scan_2 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.running_texts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancelled_orders DISABLE ROW LEVEL SECURITY;

-- Selesai!

