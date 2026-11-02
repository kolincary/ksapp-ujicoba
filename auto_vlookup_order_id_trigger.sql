-- ==============================================================================
-- DATABASE TRIGGER & VLOOKUP OTOMATIS: SINKRONISASI ID PESANAN (order_id)
-- ==============================================================================
-- Fitur ini membuat Supabase bertindak seperti "VLOOKUP Otomatis":
-- 1. Setiap ada scan baru masuk ke `scanned_items` (baik Picker, Checker, Gudang, Packing, Ojol),
--    jika `order_id` masih kosong/null, PostgreSQL otomatis mencari dari `batch_items` atau `scanned_items`.
-- 2. Setiap ada batch baru diimport ke `batch_items` dengan `order_id`,
--    PostgreSQL otomatis meng-update scan lama di `scanned_items` yang barcode-nya cocok!
-- 3. Setiap ada `order_id` baru yang terisi di `scanned_items`,
--    PostgreSQL otomatis menyebarkan (propagasi) `order_id` tersebut ke semua role lain dengan barcode sama!
-- ==============================================================================

-- 1. Pastikan kolom & index sudah siap
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.batch_items ADD COLUMN IF NOT EXISTS order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_scanned_items_barcode_order ON public.scanned_items (barcode, order_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_barcode_order ON public.batch_items (barcode, order_id);

-- ------------------------------------------------------------------------------
-- 2. TRIGGER FUNCTION 1: Auto-VLOOKUP SEBELUM INSERT/UPDATE di `scanned_items`
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auto_lookup_scanned_order_id()
RETURNS TRIGGER AS $$
DECLARE
    found_order_id TEXT;
BEGIN
    -- Jika order_id belum terisi di data yang discan
    IF NEW.order_id IS NULL OR TRIM(NEW.order_id) = '' THEN
        -- Cari di batch_items (Prioritas 1)
        SELECT order_id INTO found_order_id
        FROM public.batch_items
        WHERE barcode = NEW.barcode
          AND order_id IS NOT NULL
          AND TRIM(order_id) <> ''
        LIMIT 1;

        -- Jika belum ketemu di batch_items, cari di scanned_items yang sudah ada sebelumnya (Prioritas 2)
        IF found_order_id IS NULL OR TRIM(found_order_id) = '' THEN
            SELECT order_id INTO found_order_id
            FROM public.scanned_items
            WHERE barcode = NEW.barcode
              AND order_id IS NOT NULL
              AND TRIM(order_id) <> ''
            ORDER BY timestamp DESC
            LIMIT 1;
        END IF;

        -- Pasang jika ditemukan
        IF found_order_id IS NOT NULL AND TRIM(found_order_id) <> '' THEN
            NEW.order_id := TRIM(found_order_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_lookup_scanned_order_id ON public.scanned_items;
CREATE TRIGGER trg_auto_lookup_scanned_order_id
BEFORE INSERT OR UPDATE OF order_id, barcode ON public.scanned_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_lookup_scanned_order_id();


-- ------------------------------------------------------------------------------
-- 3. TRIGGER FUNCTION 2: Auto-Update scanned_items saat batch baru masuk
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_order_id_from_batch()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_id IS NOT NULL AND TRIM(NEW.order_id) <> '' THEN
        UPDATE public.scanned_items
        SET order_id = TRIM(NEW.order_id)
        WHERE barcode = NEW.barcode
          AND (order_id IS NULL OR TRIM(order_id) = '');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_order_id_from_batch ON public.batch_items;
CREATE TRIGGER trg_sync_order_id_from_batch
AFTER INSERT OR UPDATE OF order_id ON public.batch_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_order_id_from_batch();


-- ------------------------------------------------------------------------------
-- 4. TRIGGER FUNCTION 3: Propagasi order_id ke role lain saat satu role punya order_id
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_propagate_order_id_to_same_barcodes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_id IS NOT NULL AND TRIM(NEW.order_id) <> '' THEN
        UPDATE public.scanned_items
        SET order_id = TRIM(NEW.order_id)
        WHERE barcode = NEW.barcode
          AND (order_id IS NULL OR TRIM(order_id) = '')
          AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_order_id ON public.scanned_items;
CREATE TRIGGER trg_propagate_order_id
AFTER INSERT OR UPDATE OF order_id ON public.scanned_items
FOR EACH ROW
WHEN (NEW.order_id IS NOT NULL AND TRIM(NEW.order_id) <> '')
EXECUTE FUNCTION public.fn_propagate_order_id_to_same_barcodes();
