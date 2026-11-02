-- =============================================
-- STEP 1: Pastikan kolom order_id ada di semua tabel
-- =============================================

-- Tambahkan ke tabel scanned_items
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Tambahkan ke tabel batch_items
ALTER TABLE public.batch_items ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_scanned_items_order_id ON public.scanned_items (order_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_order_id ON public.batch_items (order_id);

-- =============================================
-- STEP 2: Backfill - Isi order_id di scanned_items
--         berdasarkan matching barcode dari batch_items
-- =============================================

-- Update scanned_items yang order_id-nya masih NULL
-- dengan order_id dari batch_items berdasarkan barcode yang sama
UPDATE public.scanned_items si
SET order_id = bi.order_id
FROM (
  SELECT DISTINCT ON (barcode) barcode, order_id
  FROM public.batch_items
  WHERE order_id IS NOT NULL
  ORDER BY barcode, created_at DESC
) bi
WHERE si.barcode = bi.barcode
  AND (si.order_id IS NULL OR si.order_id = '');

-- =============================================
-- STEP 2b: Backfill dari scanned_items sendiri
--          (batch_items mungkin sudah dihapus setelah auto-batch)
-- =============================================

-- Self-join: jika barcode yang sama sudah punya order_id di row lain,
-- propagasi ke row yang masih kosong
UPDATE public.scanned_items si
SET order_id = src.order_id
FROM (
  SELECT DISTINCT ON (barcode) barcode, order_id
  FROM public.scanned_items
  WHERE order_id IS NOT NULL AND order_id != ''
  ORDER BY barcode, timestamp DESC
) src
WHERE si.barcode = src.barcode
  AND (si.order_id IS NULL OR si.order_id = '');

-- =============================================
-- STEP 3: Verifikasi - Cek hasil backfill
-- =============================================

-- Hitung berapa scanned_items yang sudah terisi order_id
SELECT 
  COUNT(*) FILTER (WHERE order_id IS NOT NULL AND order_id != '') as filled,
  COUNT(*) FILTER (WHERE order_id IS NULL OR order_id = '') as still_empty,
  COUNT(*) as total
FROM public.scanned_items;
