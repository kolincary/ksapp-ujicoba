-- ==============================================================================
-- Migration: Create ginee_credentials table for secure storage of Ginee API keys
-- Jalankan skrip ini di SQL Editor Supabase Dashboard Anda
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ginee_credentials (
    id SERIAL PRIMARY KEY,
    app_key TEXT NOT NULL DEFAULT '',
    app_secret TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'ID',
    proxy_mode TEXT NOT NULL DEFAULT 'auto',
    custom_proxy_url TEXT DEFAULT '',
    description TEXT DEFAULT 'Kredensial API Ginee Open Platform',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_ginee_credentials_active ON public.ginee_credentials (is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ginee_credentials ENABLE ROW LEVEL SECURITY;

-- Policy: Izinkan baca untuk aplikasi web (anon & authenticated)
DROP POLICY IF EXISTS "Allow read ginee_credentials" ON public.ginee_credentials;
CREATE POLICY "Allow read ginee_credentials" ON public.ginee_credentials
    FOR SELECT TO anon, authenticated
    USING (true);

-- Policy: Izinkan ubah data (INSERT / UPDATE)
DROP POLICY IF EXISTS "Allow modify ginee_credentials" ON public.ginee_credentials;
CREATE POLICY "Allow modify ginee_credentials" ON public.ginee_credentials
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Berikan izin akses role Postgres
GRANT ALL ON public.ginee_credentials TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.ginee_credentials_id_seq TO anon, authenticated, service_role;

-- Masukkan kredensial awal (ID: 1)
INSERT INTO public.ginee_credentials (id, app_key, app_secret, country, proxy_mode, description, is_active)
VALUES (1, '74f4f05bb016485b', '46218d81e39ad490', 'ID', 'auto', 'Kunci API Utama Ginee Joyko Official', true)
ON CONFLICT (id) DO UPDATE 
SET app_key = EXCLUDED.app_key, 
    app_secret = EXCLUDED.app_secret,
    country = EXCLUDED.country,
    proxy_mode = EXCLUDED.proxy_mode,
    is_active = true,
    updated_at = now();
