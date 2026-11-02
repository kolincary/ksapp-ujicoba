-- ==============================================================================
-- OPTIMASI INDEX BATCH_ID UNTUK MEMPERCEPAT DELETE DAN MENCEGAH TIMEOUT (HTTP 500)
-- ==============================================================================
-- Jalankan query ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/nufvlqrtpzfiqghsxsze/sql
-- ==============================================================================

-- 1. Index batch_id pada tabel batch_items
-- Tanpa index ini, setiap kali menghapus batch/batch_items, Postgres melakukan full sequential scan
-- pada seluruh 466.000+ baris data sehingga melebihi statement_timeout (muncul error 500).
-- Dengan index ini, proses delete selesai dalam waktu < 5 milidetik!

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_items_batch_id 
ON public.batch_items (batch_id);

-- 2. Index batch_no pada batches jika belum ada
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batches_batch_no 
ON public.batches (batch_no);

-- 3. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
