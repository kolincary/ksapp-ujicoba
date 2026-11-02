-- ==============================================================================
-- OPTIMASI INDEX PENCARIAN BARCODE (Supabase PostgreSQL)
-- ==============================================================================
-- Menambahkan index khusus text pattern ops pada kolom barcode
-- agar pencarian PREFIX (seperti JNAP%, LXAD%, JNEB%) berjalan super cepat (< 5ms)
-- meskipun data tabel scanned_items sudah mencapai jutaan baris.
-- ==============================================================================

-- 1. Index Pattern Ops pada scanned_items (Pencarian Prefix LIKE)
CREATE INDEX IF NOT EXISTS idx_scanned_items_barcode_pattern 
ON public.scanned_items (barcode text_pattern_ops);

-- 2. Index Pattern Ops pada batch_items (Pencarian Prefix LIKE)
CREATE INDEX IF NOT EXISTS idx_batch_items_barcode_pattern 
ON public.batch_items (barcode text_pattern_ops);

-- 3. Standard B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_scanned_items_barcode 
ON public.scanned_items (barcode);

CREATE INDEX IF NOT EXISTS idx_batch_items_barcode 
ON public.batch_items (barcode);
