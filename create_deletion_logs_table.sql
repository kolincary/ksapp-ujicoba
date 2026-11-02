-- ==============================================================================
-- TABLE: deletion_logs (Audit Riwayat Penghapusan Data)
-- ==============================================================================
-- Buka Supabase Dashboard > SQL Editor > New Query > Paste & Run
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

-- Jika tabel sudah ada, pastikan kolom-kolom baru tersedia
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

-- Indices untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_at ON public.deletion_logs (deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_by ON public.deletion_logs (deleted_by);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_menu_tab ON public.deletion_logs (menu_name, tab_name);

-- Grant akses penuh untuk anon, authenticated, service_role, postgres
GRANT ALL ON TABLE public.deletion_logs TO anon, authenticated, service_role, postgres;

-- Disable RLS agar seluruh role/aplikasi bisa menyimpan riwayat log tanpa hambatan
ALTER TABLE public.deletion_logs DISABLE ROW LEVEL SECURITY;
