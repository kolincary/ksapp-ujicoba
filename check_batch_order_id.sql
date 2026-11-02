-- Cek apakah batch_items yang ada sekarang punya order_id
SELECT batch_id, barcode, order_id, created_at 
FROM public.batch_items 
ORDER BY created_at DESC 
LIMIT 20;
