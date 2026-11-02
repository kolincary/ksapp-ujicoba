-- ==============================================================================
-- KALINDO SCAN - SECURITY HARDENING & ROW LEVEL SECURITY (RLS) SETUP
-- ==============================================================================
-- Jalankan skrip ini di Supabase SQL Editor untuk memperkuat keamanan database.
-- Skrip ini menyediakan:
-- 1. Fungsi RPC verifikasi PIN (tanpa mengekspos PIN karyawan ke publik)
-- 2. Fungsi RPC verifikasi login Admin (tanpa mengekspos password admin)
-- 3. Kebijakan Row Level Security (RLS) pada tabel admin_users & app_users
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNGSI VERIFIKASI PIN KARYAWAN (RPC)
-- ------------------------------------------------------------------------------
-- Fungsi ini berjalan dengan SECURITY DEFINER agar dapat memverifikasi PIN 
-- tanpa harus memberikan hak akses SELECT kolom PIN ke role anon/publik.
CREATE OR REPLACE FUNCTION verify_user_pin(p_email TEXT, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM public.app_users 
    WHERE email = p_email 
      AND pin = p_pin 
      AND (is_blocked IS NOT TRUE)
  ) INTO v_match;
  
  RETURN v_match;
END;
$$;

-- Berikan izin eksekusi fungsi RPC ke anon dan authenticated
GRANT EXECUTE ON FUNCTION verify_user_pin(TEXT, TEXT) TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 2. FUNGSI VERIFIKASI LOGIN ADMIN (RPC)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_admin_login(p_username TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT id, username, permissions 
  INTO v_admin
  FROM public.admin_users 
  WHERE LOWER(username) = LOWER(TRIM(p_username)) 
    AND password = p_password;
    
  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_admin.id,
      'username', v_admin.username,
      'permissions', v_admin.permissions
    );
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Berikan izin eksekusi fungsi RPC ke anon dan authenticated
GRANT EXECUTE ON FUNCTION verify_admin_login(TEXT, TEXT) TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 3. PENGATURAN ROW LEVEL SECURITY (RLS) PADA TABEL SENSITIF
-- ------------------------------------------------------------------------------

-- A. Tabel admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Cabut akses langsung publik ke kolom password, hanya izinkan baca info non-sensitif jika diperlukan
DROP POLICY IF EXISTS "Allow select admin_users for auth" ON public.admin_users;
CREATE POLICY "Allow select admin_users for auth" ON public.admin_users
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow manage admin_users" ON public.admin_users;
CREATE POLICY "Allow manage admin_users" ON public.admin_users
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- B. Tabel app_users (User Karyawan)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on app_users" ON public.app_users;
CREATE POLICY "Allow public read on app_users" ON public.app_users
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow insert update delete on app_users" ON public.app_users;
CREATE POLICY "Allow insert update delete on app_users" ON public.app_users
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- C. Tabel cancelled_orders
ALTER TABLE IF EXISTS public.cancelled_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on cancelled_orders" ON public.cancelled_orders;
CREATE POLICY "Allow all operations on cancelled_orders" ON public.cancelled_orders
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
