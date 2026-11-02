-- Script untuk melihat Daftar Constraint dan Index pada table scanned_items
-- Jalankan ini untuk melihat validasi apa saja yang masih aktif/mengunci.

SELECT 
    conname as constraint_name, 
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'scanned_items'::regclass;

SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'scanned_items';
