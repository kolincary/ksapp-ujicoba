-- Script untuk menambahkan kolom order_id pada tabel-tabel utama
-- Silakan jalankan ini di Supabase SQL Editor

-- Tambahkan ke tabel batch_items
ALTER TABLE public.batch_items ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Tambahkan ke tabel scanned_items
ALTER TABLE public.scanned_items ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Tambahkan ke tabel admin_imports (jika masih digunakan untuk keperluan lain)
ALTER TABLE public.admin_imports ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Tambahkan indeks untuk mempercepat pencarian berdasarkan order_id
CREATE INDEX IF NOT EXISTS idx_batch_items_order_id ON public.batch_items (order_id);
CREATE INDEX IF NOT EXISTS idx_scanned_items_order_id ON public.scanned_items (order_id);
