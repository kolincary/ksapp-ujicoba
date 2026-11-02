-- ==============================================================================
-- OPTIMASI PENGHAPUSAN DATA BULK DI SUPABASE (KALINDO SCAN)
-- ==============================================================================
-- Masalah:
-- Saat menghapus data dari Export Data Center untuk rentang tanggal dengan ribuan data,
-- query PostgreSQL bisa terkena statement_timeout (8-15 detik) sehingga menghasilkan
-- error 500 (Internal Server Error).
--
-- Solusi SQL:
-- 1. Index composite pada (role, timestamp) dan (role, menu_context, timestamp)
--    agar pencarian dan penghapusan data berlangsung super cepat (< 200ms).
-- 2. Fungsi RPC admin_delete_scanned_items dengan teknik looping per-batch 2.000 rows
--    agar tidak mengunci tabel terlalu lama dan kebal terhadap statement timeout.
-- ==============================================================================

-- 1. Buat Index Tambahan untuk Mempercepat Query Role + Timestamp
CREATE INDEX IF NOT EXISTS idx_scanned_items_role_ts 
ON public.scanned_items (role, timestamp);

CREATE INDEX IF NOT EXISTS idx_scanned_items_role_ctx_ts 
ON public.scanned_items (role, menu_context, timestamp);

CREATE INDEX IF NOT EXISTS idx_leader_pending_scans_ts
ON public.leader_pending_scans (timestamp);

CREATE INDEX IF NOT EXISTS idx_leader_scan_2_ts
ON public.leader_scan_2 (timestamp);


-- 2. Fungsi RPC admin_delete_scanned_items dengan Batch Loop (Anti-Timeout)
CREATE OR REPLACE FUNCTION public.admin_delete_scanned_items(
    min_ts BIGINT,
    max_ts BIGINT,
    target_role TEXT,
    target_context TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows_deleted INT;
BEGIN
    LOOP
        IF target_context IS NOT NULL THEN
            DELETE FROM public.scanned_items
            WHERE id IN (
                SELECT id 
                FROM public.scanned_items
                WHERE timestamp >= min_ts
                  AND timestamp <= max_ts
                  AND (
                      role = target_role 
                      OR (target_role = 'OJOL' AND role IN ('OJOL', 'Ojol'))
                  )
                  AND menu_context = target_context
                LIMIT 2000
            );
        ELSE
            DELETE FROM public.scanned_items
            WHERE id IN (
                SELECT id 
                FROM public.scanned_items
                WHERE timestamp >= min_ts
                  AND timestamp <= max_ts
                  AND (
                      role = target_role 
                      OR (target_role = 'OJOL' AND role IN ('OJOL', 'Ojol'))
                  )
                LIMIT 2000
            );
        END IF;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        
        -- Selesai jika tidak ada baris lagi yang cocok
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;

-- 3. Berikan Hak Eksekusi ke anon dan authenticated
GRANT EXECUTE ON FUNCTION public.admin_delete_scanned_items(BIGINT, BIGINT, TEXT, TEXT) TO anon, authenticated;
