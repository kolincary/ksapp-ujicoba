-- 1. Add new column for Menu Context (Gudang Scoped Validation)
ALTER TABLE scanned_items 
ADD COLUMN IF NOT EXISTS menu_context TEXT;

-- 2. Drop existing unique constraint (to replace it with newer logic)
-- Note: Replace 'scanned_items_barcode_role_timestamp_key' with actual constraint name if different.
-- You can find constraint name by running: 
-- SELECT conname FROM pg_constraint WHERE conrelid = 'scanned_items'::regclass AND contype = 'u';

ALTER TABLE scanned_items 
    DROP CONSTRAINT IF EXISTS scanned_items_barcode_role_timestamp_key;

-- Also drop index if it exists separately
DROP INDEX IF EXISTS unique_scan_per_day_role;

-- 3. Create NEW Unique Index that includes menu_context
-- 
-- PENJELASAN (SAFETY CHECK):
-- Logika ini AMAN untuk role lain (Packing, Sortir, dll) dan TIDAK merubah perilaku mereka.
--
-- ALASAN:
-- 1. Untuk Role GUDANG: Index ini mengecek (Barcode + Role + Date + MenuContext).
--    Karena Gudang punya konteks 'PENDING' dan 'REPORT', maka ABC bisa masuk 2x asal konteks beda.
--
-- 2. Untuk Role LAIN (Packing, dll):
--    Sistem otomatis mengisi menu_context = 'DEFAULT'.
--    Maka validasi menjadi: (Barcode + Role + Date + 'DEFAULT').
--    Ini SAMA PERSIS dengan logika lama (Barcode + Role + Date).
--    Jadi tidak ada perubahan perilaku untuk role selain Gudang.
--

CREATE UNIQUE INDEX unique_scan_per_day_role_menu 
ON scanned_items (
    barcode, 
    role, 
    -- FIX: Gunakan AT TIME ZONE 'Asia/Jakarta' agar expression menjadi IMMUTABLE (Tidak tergan tunga setting timezone session/server)
    ((to_timestamp(timestamp / 1000) AT TIME ZONE 'Asia/Jakarta')::date), 
    COALESCE(menu_context, 'DEFAULT') 
);
