/**
 * Master PostgreSQL Schema DDL Generator for Kalindo Scan
 * 
 * Copy and execute this SQL script in the Supabase SQL Editor of any new or existing project.
 * It creates/updates all 18 tables with exact matching schemas, adds all missing columns,
 * unlocks schema permissions, disables RLS, grants full permissions, and reloads the API schema cache.
 */

export const MASTER_SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- MASTER SUPABASE SQL SCHEMA FOR KALINDO SCAN APPLICATION
-- ==============================================================================
-- Buka Supabase Dashboard > SQL Editor > New Query > Paste & Run
-- ==============================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Grant USAGE and Full Access to public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role, postgres;

-- ==============================================================================
-- 3. TABLE: scanned_items (Data Scan Barcode Lapangan)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.scanned_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    barcode TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'PICKER',
    user_email TEXT DEFAULT '',
    destination TEXT DEFAULT '',
    description TEXT DEFAULT '',
    priority TEXT DEFAULT 'NORMAL',
    status TEXT DEFAULT 'COMPLETED',
    employee_name TEXT DEFAULT '',
    scan_date TEXT DEFAULT '',
    menu_context TEXT DEFAULT 'DEFAULT',
    scan_mode TEXT DEFAULT 'INDIVIDU',
    team_members TEXT[] DEFAULT '{}',
    excel_filename TEXT DEFAULT '',
    report_keterangan TEXT DEFAULT '',
    report_msku TEXT DEFAULT '',
    report_qty TEXT DEFAULT '',
    order_id TEXT DEFAULT '',
    brand_type TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS timestamp BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint;
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'PICKER';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS employee_name TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS scan_date TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS menu_context TEXT DEFAULT 'DEFAULT';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS scan_mode TEXT DEFAULT 'INDIVIDU';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS team_members TEXT[] DEFAULT '{}';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS excel_filename TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS report_keterangan TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS report_msku TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS report_qty TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS order_id TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS brand_type TEXT DEFAULT '';
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_scanned_items_timestamp ON public.scanned_items (timestamp);
CREATE INDEX IF NOT EXISTS idx_scanned_items_barcode ON public.scanned_items (barcode);
CREATE INDEX IF NOT EXISTS idx_scanned_items_role ON public.scanned_items (role);
CREATE INDEX IF NOT EXISTS idx_scanned_items_destination ON public.scanned_items (destination);
CREATE INDEX IF NOT EXISTS idx_scanned_items_order_id ON public.scanned_items (order_id);
CREATE INDEX IF NOT EXISTS idx_scanned_items_barcode_order ON public.scanned_items (barcode, order_id);
CREATE INDEX IF NOT EXISTS idx_scanned_items_role_ts ON public.scanned_items (role, timestamp);
CREATE INDEX IF NOT EXISTS idx_scanned_items_menu_context ON public.scanned_items (menu_context);
CREATE INDEX IF NOT EXISTS idx_scanned_items_scan_date ON public.scanned_items (scan_date);

-- ==============================================================================
-- 4. TABLE: cancelled_orders (Data Resi Cancel Gudang & Import)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cancelled_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    barcode TEXT NOT NULL,
    cancelled_at TIMESTAMPTZ DEFAULT now(),
    cancelled_by TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS cancelled_by TEXT DEFAULT '';
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '';
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_cancelled_orders_barcode ON public.cancelled_orders (barcode);
CREATE INDEX IF NOT EXISTS idx_cancelled_orders_active ON public.cancelled_orders (is_active);

-- ==============================================================================
-- 5. TABLE: batches (Data Header Batch)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    batch_no TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT DEFAULT '',
    excel_filename TEXT DEFAULT '',
    picker_name TEXT DEFAULT ''
);

ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS batch_no TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS excel_filename TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS picker_name TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_batches_batch_no ON public.batches (batch_no);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON public.batches (created_at);

-- ==============================================================================
-- 6. TABLE: batch_items (Detail Barcode Per Batch)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.batch_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    batch_id TEXT,
    barcode TEXT NOT NULL,
    msku TEXT DEFAULT '',
    qty INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    order_id TEXT DEFAULT ''
);

ALTER TABLE public.batch_items ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE public.batch_items ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.batch_items ADD COLUMN IF NOT EXISTS msku TEXT DEFAULT '';
ALTER TABLE public.batch_items ADD COLUMN IF NOT EXISTS qty INTEGER DEFAULT 1;
ALTER TABLE public.batch_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.batch_items ADD COLUMN IF NOT EXISTS order_id TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON public.batch_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_barcode ON public.batch_items (barcode);
CREATE INDEX IF NOT EXISTS idx_batch_items_order_id ON public.batch_items (order_id);

-- ==============================================================================
-- 7. TABLE: leader_scan_2 (Data Rekap Leader)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leader_scan_2 (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    barcode TEXT NOT NULL,
    assignment_mode TEXT DEFAULT 'INDIVIDU',
    assignees TEXT[] DEFAULT '{}',
    leader_name TEXT DEFAULT '',
    status TEXT DEFAULT 'ASSIGNED',
    scan_type TEXT DEFAULT 'PRETELAN',
    leader_profile TEXT DEFAULT '',
    date TEXT DEFAULT ''
);

ALTER TABLE public.leader_scan_2 ADD COLUMN IF NOT EXISTS timestamp BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint;
ALTER TABLE public.leader_scan_2 ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.leader_scan_2 ADD COLUMN IF NOT EXISTS assignment_mode TEXT DEFAULT 'INDIVIDU';
ALTER TABLE public.leader_scan_2 ADD COLUMN IF NOT EXISTS assignees TEXT[] DEFAULT '{}';
ALTER TABLE public.leader_scan_2 ADD COLUMN IF NOT EXISTS leader_name TEXT DEFAULT '';
ALTER TABLE public.leader_scan_2 ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ASSIGNED';
ALTER TABLE public.leader_scan_2 ADD COLUMN IF NOT EXISTS scan_type TEXT DEFAULT 'PRETELAN';
ALTER TABLE public.leader_scan_2 ADD COLUMN IF NOT EXISTS leader_profile TEXT DEFAULT '';
ALTER TABLE public.leader_scan_2 ADD COLUMN IF NOT EXISTS date TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_leader_scan_2_ts ON public.leader_scan_2 (timestamp);
CREATE INDEX IF NOT EXISTS idx_leader_scan_2_barcode ON public.leader_scan_2 (barcode);

-- ==============================================================================
-- 7B. TABLE: leader_pending_scans (Pending Scan Leader LT3)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leader_pending_scans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    barcode TEXT NOT NULL,
    leader_name TEXT DEFAULT '',
    leader_profile TEXT DEFAULT '',
    status TEXT DEFAULT 'PENDING',
    scan_type TEXT DEFAULT 'PRETELAN',
    description TEXT DEFAULT '[PENDING LEADER]',
    date TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leader_pending_scans ADD COLUMN IF NOT EXISTS timestamp BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint;
ALTER TABLE public.leader_pending_scans ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.leader_pending_scans ADD COLUMN IF NOT EXISTS leader_name TEXT DEFAULT '';
ALTER TABLE public.leader_pending_scans ADD COLUMN IF NOT EXISTS leader_profile TEXT DEFAULT '';
ALTER TABLE public.leader_pending_scans ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE public.leader_pending_scans ADD COLUMN IF NOT EXISTS scan_type TEXT DEFAULT 'PRETELAN';
ALTER TABLE public.leader_pending_scans ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '[PENDING LEADER]';
ALTER TABLE public.leader_pending_scans ADD COLUMN IF NOT EXISTS date TEXT DEFAULT '';
ALTER TABLE public.leader_pending_scans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_leader_pending_scans_ts ON public.leader_pending_scans (timestamp);
CREATE INDEX IF NOT EXISTS idx_leader_pending_scans_barcode ON public.leader_pending_scans (barcode);
CREATE INDEX IF NOT EXISTS idx_leader_pending_scans_profile ON public.leader_pending_scans (leader_profile);

-- ==============================================================================
-- 8. TABLE: failed_scans (Riwayat Gagal Scan)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.failed_scans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    barcode TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'SORTIR',
    user_email TEXT DEFAULT '',
    employee_name TEXT DEFAULT '',
    destination TEXT DEFAULT '',
    description TEXT DEFAULT '',
    priority TEXT DEFAULT 'NORMAL',
    fail_reason TEXT DEFAULT '',
    fail_message TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS timestamp BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint;
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'SORTIR';
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT '';
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS employee_name TEXT DEFAULT '';
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT '';
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS fail_reason TEXT DEFAULT '';
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS fail_message TEXT DEFAULT '';
ALTER TABLE public.failed_scans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_failed_scans_ts ON public.failed_scans (timestamp);
CREATE INDEX IF NOT EXISTS idx_failed_scans_barcode ON public.failed_scans (barcode);

-- ==============================================================================
-- 9. TABLE: admin_shift_notes (Catatan Shift & Pengumuman Admin)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_shift_notes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'SHIFT_HANDOVER',
    created_by TEXT DEFAULT 'Admin',
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    is_active BOOLEAN DEFAULT true,
    target_role TEXT DEFAULT 'ALL',
    read_by JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE public.admin_shift_notes ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.admin_shift_notes ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.admin_shift_notes ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'SHIFT_HANDOVER';
ALTER TABLE public.admin_shift_notes ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'Admin';
ALTER TABLE public.admin_shift_notes ADD COLUMN IF NOT EXISTS created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint;
ALTER TABLE public.admin_shift_notes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.admin_shift_notes ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'ALL';
ALTER TABLE public.admin_shift_notes ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_admin_shift_notes_active ON public.admin_shift_notes (is_active);

-- ==============================================================================
-- 10. TABLE: employees (Data Karyawan, Target & PIN)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    shift TEXT DEFAULT '',
    allowed_roles TEXT[] DEFAULT '{}',
    daily_target INTEGER DEFAULT 0,
    pin TEXT DEFAULT ''
);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] DEFAULT '{}';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS daily_target INTEGER DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '';

-- ==============================================================================
-- 11. TABLE: user_permissions (Hak Akses User & Role)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT DEFAULT '',
    role TEXT DEFAULT 'STAFF',
    manual_input_access BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Fix old constraint if exists
DO $$
BEGIN
    ALTER TABLE public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_pkey;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS id TEXT DEFAULT gen_random_uuid()::text;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'STAFF';
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS manual_input_access BOOLEAN DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
    ALTER TABLE public.user_permissions ADD PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ==============================================================================
-- 12. TABLE: admin_users (Akun Admin)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    permissions TEXT[] DEFAULT '{}'
);

ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';

-- ==============================================================================
-- 13. TABLE: app_settings (Global Settings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    id BIGSERIAL PRIMARY KEY,
    is_maintenance BOOLEAN DEFAULT false,
    maintenance_end TIMESTAMPTZ,
    setting_key TEXT DEFAULT '',
    setting_value TEXT DEFAULT '',
    last_force_refresh_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    skip_duplicate_batch BOOLEAN DEFAULT false,
    skip_duplicate_checker BOOLEAN DEFAULT false,
    strict_resi_mode BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS is_maintenance BOOLEAN DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS maintenance_end TIMESTAMPTZ;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS setting_key TEXT DEFAULT '';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS setting_value TEXT DEFAULT '';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS last_force_refresh_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS skip_duplicate_batch BOOLEAN DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS skip_duplicate_checker BOOLEAN DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS strict_resi_mode BOOLEAN DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- ==============================================================================
-- 14. TABLE: app_profiles_config (Konfigurasi Profil)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_profiles_config (
    id BIGSERIAL PRIMARY KEY,
    role TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    use_page_modal BOOLEAN DEFAULT false
);

ALTER TABLE public.app_profiles_config ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.app_profiles_config ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.app_profiles_config ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.app_profiles_config ADD COLUMN IF NOT EXISTS use_page_modal BOOLEAN DEFAULT false;

-- ==============================================================================
-- 15. TABLE: running_texts (Running Text Banner)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.running_texts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    text TEXT NOT NULL,
    roles TEXT[] DEFAULT '{ALL}',
    is_active BOOLEAN DEFAULT true,
    interval_minutes INTEGER DEFAULT 10,
    duration_seconds INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT now(),
    scroll_speed INTEGER DEFAULT 10
);

ALTER TABLE public.running_texts ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE public.running_texts ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{ALL}';
ALTER TABLE public.running_texts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.running_texts ADD COLUMN IF NOT EXISTS interval_minutes INTEGER DEFAULT 10;
ALTER TABLE public.running_texts ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 100;
ALTER TABLE public.running_texts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.running_texts ADD COLUMN IF NOT EXISTS scroll_speed INTEGER DEFAULT 10;

-- ==============================================================================
-- 16. TABLE: app_roles & app_shifts
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_roles (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.app_shifts (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_shifts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.app_shifts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ==============================================================================
-- 17. TABLE: fake_invoice_reports
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fake_invoice_reports (
    id BIGSERIAL PRIMARY KEY,
    barcode TEXT NOT NULL,
    staff_name TEXT DEFAULT '',
    status TEXT DEFAULT 'PENDING',
    reported_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fake_invoice_reports ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.fake_invoice_reports ADD COLUMN IF NOT EXISTS staff_name TEXT DEFAULT '';
ALTER TABLE public.fake_invoice_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE public.fake_invoice_reports ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ DEFAULT now();

-- ==============================================================================
-- 18. TABLE: sortir_eliminations
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sortir_eliminations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    barcode TEXT NOT NULL,
    employee_name TEXT DEFAULT '',
    timestamp BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    move_type TEXT DEFAULT 'MANUAL',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sortir_eliminations ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.sortir_eliminations ADD COLUMN IF NOT EXISTS employee_name TEXT DEFAULT '';
ALTER TABLE public.sortir_eliminations ADD COLUMN IF NOT EXISTS timestamp BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint;
ALTER TABLE public.sortir_eliminations ADD COLUMN IF NOT EXISTS move_type TEXT DEFAULT 'MANUAL';
ALTER TABLE public.sortir_eliminations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ==============================================================================
-- 19. TABLE: user_activity
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_activity (
    id BIGSERIAL PRIMARY KEY,
    user_email TEXT DEFAULT '',
    employee_name TEXT DEFAULT '',
    role TEXT DEFAULT '',
    login_status TEXT DEFAULT 'LOGGED_IN',
    last_active TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ DEFAULT now(),
    last_logout TIMESTAMPTZ,
    force_logout BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT '';
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS employee_name TEXT DEFAULT '';
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS role TEXT DEFAULT '';
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS login_status TEXT DEFAULT 'LOGGED_IN';
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS last_logout TIMESTAMPTZ;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS force_logout BOOLEAN DEFAULT false;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ==============================================================================
-- 20. DISABLE ROW LEVEL SECURITY (RLS) FOR 100% SMOOTH ACCESS
-- ==============================================================================
ALTER TABLE public.scanned_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancelled_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_scan_2 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_pending_scans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_scans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_shift_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_profiles_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.running_texts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fake_invoice_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sortir_eliminations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_logs DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 20B. TABLE: deletion_logs (Riwayat Audit Penghapusan Data)
-- ==============================================================================
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

ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT 'Unknown';
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT '';
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS menu_name TEXT;
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS tab_name TEXT;
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 1;
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS target_summary TEXT DEFAULT '';
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS deleted_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS client_info TEXT DEFAULT '';
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_at ON public.deletion_logs (deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_by ON public.deletion_logs (deleted_by);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_menu_tab ON public.deletion_logs (menu_name, tab_name);

-- ==============================================================================
-- 21. GRANT FULL PRIVILEGES TO ALL ROLES (anon, authenticated, service_role)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role, postgres;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role, postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- SELESAI! SELURUH 18 TABEL, INDEKS & HAK AKSES SIAP 100%.
-- ==============================================================================
`;
