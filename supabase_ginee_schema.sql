-- ========================================================================
-- SKEMA SUPABASE KHUSUS: GINEE OMS & OUTBOUND (81 FIELD + RETENSI 5 HARI)
-- DATABASE: https://plltdvaxzxwsdtxlwnkf.supabase.co
-- AMAN DIJALANKAN BERULANG KALI (IDEMPOTENT & BEBAS ERROR 42710)
-- Jalankan seluruh script ini di SQL Editor Dashboard Supabase Ginee Anda
-- ========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pg_cron";
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not available or permission denied (skipped): %', SQLERRM;
END $$;


-- 2. TABEL: cancelled_orders (Data Pembatalan Pesanan / Proteksi Resi Batal)
CREATE TABLE IF NOT EXISTS public.cancelled_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode VARCHAR(100) NOT NULL UNIQUE,
    tracking_no VARCHAR(100),
    order_sn VARCHAR(100),
    channel_order_sn VARCHAR(100),
    cancelled_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_by VARCHAR(100) DEFAULT 'admin',
    reason TEXT DEFAULT 'Dibatalkan di Marketplace / Ginee OMS',
    shop_name VARCHAR(150),
    channel VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan seluruh kolom cancelled_orders selalu ada jika tabel sudah dibuat sebelumnya
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS tracking_no VARCHAR(100);
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS order_sn VARCHAR(100);
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS channel_order_sn VARCHAR(100);
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS shop_name VARCHAR(150);
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS channel VARCHAR(50);
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.cancelled_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_cancelled_orders_barcode ON public.cancelled_orders(barcode);
CREATE INDEX IF NOT EXISTS idx_cancelled_orders_tracking ON public.cancelled_orders(tracking_no);
CREATE INDEX IF NOT EXISTS idx_cancelled_orders_channel ON public.cancelled_orders(channel_order_sn);
CREATE INDEX IF NOT EXISTS idx_cancelled_orders_active ON public.cancelled_orders(is_active);
CREATE INDEX IF NOT EXISTS idx_cancelled_orders_time ON public.cancelled_orders(cancelled_at);


-- 3. TABEL UTAMA: ginee_orders (81 KOLOM LENGKAP GINEE OMS & OUTBOUND)
CREATE TABLE IF NOT EXISTS public.ginee_orders (
    -- Primary Key Internal
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Kolom Identitas & Pelacakan Utama (Index Cepat)
    order_id VARCHAR(100) NOT NULL,                           -- ID Pesanan Ginee (Contoh: SO6ADC6AE346E0FB00015F0D78 / 586763338453780287)
    channel_order_sn VARCHAR(100),                            -- No Pesanan Toko/Marketplace (Shopee/TikTok/Lazada)
    tracking_no VARCHAR(100),                                 -- AWB / No. Tracking Kurir (Contoh: JY2000130816, SPXID...)
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',            -- Status Pesanan (Siap Dikirim, Dibatalkan, Selesai, dll)
    order_type VARCHAR(50),                                   -- Jenis Pesanan (Normal, Pre-order, B2B)
    channel VARCHAR(50),                                      -- Channel (Shopee, TikTok, Lazada, Tokopedia)
    shop_name VARCHAR(150),                                   -- Nama Toko

    -- Waktu & Tanggal
    created_at_ginee TIMESTAMPTZ,                             -- Tanggal Pembuatan di Ginee / Marketplace
    payment_time TIMESTAMPTZ,                                 -- Waktu Pembayaran
    shipping_time TIMESTAMPTZ,                                -- Waktu Pengiriman
    completion_time TIMESTAMPTZ,                              -- Waktu Penyelesaian
    last_sync_time TIMESTAMPTZ DEFAULT NOW(),                 -- Sinkronisasi Terakhir
    updated_time_ginee TIMESTAMPTZ,                           -- Waktu Pembaruan
    ship_by_date TIMESTAMPTZ,                                 -- Kirim Sebelum
    cancel_time TIMESTAMPTZ,                                  -- Waktu Pembatalan

    -- Data Pembeli
    buyer_name VARCHAR(200),                                  -- Nama Pembeli
    buyer_phone VARCHAR(50),                                  -- Telepon Pembeli
    buyer_email VARCHAR(150),                                 -- Email Pembeli
    buyer_note TEXT,                                          -- Catatan Pembeli

    -- Data Penerima & Pengiriman
    recipient_name VARCHAR(200),                              -- Nama Penerima
    recipient_phone VARCHAR(50),                              -- No. Telepon Penerima
    recipient_address TEXT,                                   -- Alamat Penerima
    courier VARCHAR(100),                                     -- Kurir / Ekspedisi (J&T, SPX, JNE, SiCepat)
    province VARCHAR(100),                                    -- Provinsi
    city VARCHAR(100),                                        -- Kota
    district VARCHAR(100),                                    -- Kecamatan
    postal_code VARCHAR(20),                                  -- Kode Pos
    shipping_method VARCHAR(100),                             -- Metode Pengiriman (Standard, Instant, Cargo)
    billing_address TEXT,                                     -- Alamat Tagihan

    -- Ringkasan Produk & Gudang (Item pertama / aggregasi)
    product_name TEXT,                                        -- Nama Produk
    product_variant VARCHAR(255),                             -- Variant Produk
    sku VARCHAR(100),                                         -- SKU
    msku VARCHAR(100),                                        -- MSKU
    warehouse_name VARCHAR(100),                              -- Nama Gudang
    product_status VARCHAR(50),                               -- Status Produk
    quantity INT DEFAULT 1,                                   -- Jumlah
    total_weight_g NUMERIC(12, 2) DEFAULT 0,                  -- Total Berat(g)
    is_gift BOOLEAN DEFAULT FALSE,                            -- Adalah Hadiah
    is_fake_order BOOLEAN DEFAULT FALSE,                      -- Adalah Pesanan Palsu

    -- Dropshipper
    dropshipper_name VARCHAR(150),                            -- Dropshipper
    dropshipper_phone VARCHAR(50),                            -- No. Telepon Dropshipper

    -- Nilai Finansial & Harga
    currency VARCHAR(10) DEFAULT 'IDR',                       -- Mata Uang
    initial_price NUMERIC(15, 2) DEFAULT 0,                   -- Harga Awal Produk
    promotion_price NUMERIC(15, 2) DEFAULT 0,                 -- Harga Promosi
    total_promotion_price NUMERIC(15, 2) DEFAULT 0,           -- Harga Total Promosi
    subtotal NUMERIC(15, 2) DEFAULT 0,                        -- Subtotal
    total_amount NUMERIC(15, 2) DEFAULT 0,                    -- Total
    buyer_payment_amount NUMERIC(15, 2) DEFAULT 0,            -- Jumlah Pembayaran Pembeli
    shipping_fee NUMERIC(15, 2) DEFAULT 0,                    -- Biaya Pengiriman
    shipping_fee_paid_by_buyer NUMERIC(15, 2) DEFAULT 0,      -- Biaya Kirim Ditanggung Pembeli
    shipping_fee_paid_by_system NUMERIC(15, 2) DEFAULT 0,     -- Ongkir Dibayar Sistem
    tax_amount NUMERIC(15, 2) DEFAULT 0,                      -- Pajak
    tax_deduction NUMERIC(15, 2) DEFAULT 0,                   -- Pemotongan Pajak
    insurance_fee NUMERIC(15, 2) DEFAULT 0,                   -- Asuransi
    total_discount NUMERIC(15, 2) DEFAULT 0,                  -- Total Diskon
    marketplace_subsidy NUMERIC(15, 2) DEFAULT 0,             -- Subsidi Marketplace
    commission_fee NUMERIC(15, 2) DEFAULT 0,                  -- Biaya Komisi
    service_fee NUMERIC(15, 2) DEFAULT 0,                     -- Biaya Layanan
    seller_discount NUMERIC(15, 2) DEFAULT 0,                 -- Potongan Harga
    shipping_fee_discount NUMERIC(15, 2) DEFAULT 0,           -- Potongan Biaya Pengiriman
    coins_used NUMERIC(15, 2) DEFAULT 0,                      -- Koin
    credit_card_fee NUMERIC(15, 2) DEFAULT 0,                 -- Biaya Kartu Kredit
    seller_cashback_coins NUMERIC(15, 2) DEFAULT 0,           -- Koin Cashback Penjual
    refund_amount NUMERIC(15, 2) DEFAULT 0,                   -- Jumlah Pengembalian Dana
    channel_voucher NUMERIC(15, 2) DEFAULT 0,                 -- Voucher Channel
    seller_voucher_discount NUMERIC(15, 2) DEFAULT 0,         -- Diskon Penjual
    credit_card_service_fee NUMERIC(15, 2) DEFAULT 0,         -- Biaya Layanan Kartu Kredit
    payment_fee NUMERIC(15, 2) DEFAULT 0,                     -- Biaya Pembayaran
    other_fee NUMERIC(15, 2) DEFAULT 0,                       -- Biaya Lainnya
    lazpick_laztop_commission NUMERIC(15, 2) DEFAULT 0,       -- Komisi Lazpick/LazTop
    free_shipping_promo_fee NUMERIC(15, 2) DEFAULT 0,         -- Biaya Promosi Gratis Ongkir
    credit_amount NUMERIC(15, 2) DEFAULT 0,                   -- Kredit
    shopee_product_protection NUMERIC(15, 2) DEFAULT 0,       -- Asuransi Perlindungan Produk Shopee
    order_processing_fee NUMERIC(15, 2) DEFAULT 0,            -- Biaya Proses Pesanan

    -- Dokumen & Catatan Operasional
    invoice_no VARCHAR(100),                                  -- Invoice
    payment_method VARCHAR(100),                              -- Pembayaran (COD, Transfer, ShopeePay, dll)
    seller_note TEXT,                                         -- Catatan Penjual
    shipping_label_status VARCHAR(50),                        -- Status Label Pengiriman
    invoice_status VARCHAR(50),                               -- Status Invoice
    packing_list_status VARCHAR(50),                          -- Status Packing List
    cancel_reason TEXT,                                       -- Alasan Pembatalan
    ordered_via VARCHAR(100),                                 -- Dipesan di (Hanya untuk Tokopedia & Shop)

    -- DATA OUTBOUND GINEE
    outbound_no VARCHAR(100),                                 -- Nomor Outbound (Contoh: So-2113158973567209472)
    outbound_type VARCHAR(50),                                -- Jenis Outbound
    outbound_status VARCHAR(50),                              -- Status Outbound
    outbound_created_at TIMESTAMPTZ,                          -- Waktu Dibuat Outbound
    outbound_shipped_at TIMESTAMPTZ,                          -- Waktu Dikirim Outbound

    -- Items detail & Raw Payload
    items JSONB,                                              -- Daftar multi-item produk (SKU, Qty, Varian, Gambar)
    raw_payload JSONB,                                        -- Payload mentah JSON dari Ginee V3
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_ginee_orders_order_id UNIQUE (order_id)
);

-- ========================================================================
-- PASTIKAN SELURUH KOLOM GINEE_ORDERS SELALU ADA (MENCEGAH ERROR MISSING ITEMS)
-- Jika tabel ginee_orders sudah pernah dibuat sebelumnya, ALTER TABLE ini
-- akan menambahkan kolom yang kurang (termasuk items JSONB) tanpa merusak data!
-- ========================================================================
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS channel_order_sn VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS tracking_no VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS channel VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS shop_name VARCHAR(150);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS created_at_ginee TIMESTAMPTZ;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS payment_time TIMESTAMPTZ;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS shipping_time TIMESTAMPTZ;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS completion_time TIMESTAMPTZ;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS last_sync_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS updated_time_ginee TIMESTAMPTZ;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS ship_by_date TIMESTAMPTZ;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS cancel_time TIMESTAMPTZ;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(200);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS buyer_phone VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS buyer_email VARCHAR(150);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS buyer_note TEXT;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(200);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS recipient_address TEXT;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS courier VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS province VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS product_variant VARCHAR(255);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS msku VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS warehouse_name VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS product_status VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS total_weight_g NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT FALSE;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS is_fake_order BOOLEAN DEFAULT FALSE;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS dropshipper_name VARCHAR(150);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS dropshipper_phone VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'IDR';
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS initial_price NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS promotion_price NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS total_promotion_price NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS buyer_payment_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS shipping_fee_paid_by_buyer NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS shipping_fee_paid_by_system NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS tax_deduction NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS insurance_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS total_discount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS marketplace_subsidy NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS commission_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS service_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS seller_discount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS shipping_fee_discount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS coins_used NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS credit_card_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS seller_cashback_coins NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS channel_voucher NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS seller_voucher_discount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS credit_card_service_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS payment_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS other_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS lazpick_laztop_commission NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS free_shipping_promo_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS shopee_product_protection NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS order_processing_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS seller_note TEXT;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS shipping_label_status VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS packing_list_status VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS ordered_via VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS outbound_no VARCHAR(100);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS outbound_type VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS outbound_status VARCHAR(50);
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS outbound_created_at TIMESTAMPTZ;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS outbound_shipped_at TIMESTAMPTZ;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.ginee_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ginee_orders_tracking ON public.ginee_orders(tracking_no);
CREATE INDEX IF NOT EXISTS idx_ginee_orders_channel_sn ON public.ginee_orders(channel_order_sn);
CREATE INDEX IF NOT EXISTS idx_ginee_orders_outbound ON public.ginee_orders(outbound_no);
CREATE INDEX IF NOT EXISTS idx_ginee_orders_status ON public.ginee_orders(status);
CREATE INDEX IF NOT EXISTS idx_ginee_orders_created_at_ginee ON public.ginee_orders(created_at_ginee);


-- 4. TABEL DATA OUTBOUND: ginee_outbounds
CREATE TABLE IF NOT EXISTS public.ginee_outbounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_no VARCHAR(100) NOT NULL,                        -- Nomor Outbound (So-...)
    order_id VARCHAR(100),                                    -- ID Pesanan Terkait
    channel_order_sn VARCHAR(100),                            -- No Pesanan Toko Terkait
    tracking_no VARCHAR(100),                                 -- Resi Kurir
    warehouse_name VARCHAR(100),                              -- Gudang
    outbound_type VARCHAR(50),                                -- Jenis Outbound
    status VARCHAR(50),                                       -- Status Outbound
    total_qty INT DEFAULT 1,                                  -- Total Kuantitas
    outbound_time TIMESTAMPTZ,                                -- Waktu Outbound
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_ginee_outbounds_no UNIQUE (outbound_no)
);

CREATE INDEX IF NOT EXISTS idx_ginee_outbounds_no ON public.ginee_outbounds(outbound_no);
CREATE INDEX IF NOT EXISTS idx_ginee_outbounds_tracking ON public.ginee_outbounds(tracking_no);


-- 5. TABEL KREDENSIAL API GINEE: ginee_credentials
CREATE TABLE IF NOT EXISTS public.ginee_credentials (
    id SERIAL PRIMARY KEY,
    app_key TEXT NOT NULL DEFAULT '',
    app_secret TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'ID',
    proxy_mode TEXT NOT NULL DEFAULT 'auto',
    custom_proxy_url TEXT DEFAULT '',
    description TEXT DEFAULT 'Kredensial API Ginee Open Platform',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ginee_credentials_active ON public.ginee_credentials (is_active);

-- Kredensial awal (ID: 1)
INSERT INTO public.ginee_credentials (id, app_key, app_secret, country, proxy_mode, description, is_active)
VALUES (1, '74f4f05bb016485b', '46218d81e39ad490', 'ID', 'auto', 'Kunci API Utama Ginee Joyko Official', true)
ON CONFLICT (id) DO UPDATE 
SET app_key = EXCLUDED.app_key, 
    app_secret = EXCLUDED.app_secret,
    country = EXCLUDED.country,
    proxy_mode = EXCLUDED.proxy_mode,
    is_active = true,
    updated_at = now();


-- 6. FUNCTION AUTO-PURGE RETENSI 5 HARI (Otomatis Hapus H-5 ke Bawah)
-- Menghapus data yang lebih lama dari 5 hari kalender untuk menghemat kapasitas database
CREATE OR REPLACE FUNCTION public.purge_expired_ginee_data(retention_days INT DEFAULT 5)
RETURNS JSONB AS $$
DECLARE
    cutoff_date DATE;
    deleted_orders INT := 0;
    deleted_cancels INT := 0;
    deleted_outbounds INT := 0;
BEGIN
    -- Hitung tanggal batas (contoh: 25 Oktober - 5 hari = 20 Oktober)
    cutoff_date := (CURRENT_DATE - (retention_days || ' days')::INTERVAL)::DATE;

    -- 1. Hapus pesanan di tabel ginee_orders yang tanggal buatnya sebelum cutoff_date
    DELETE FROM public.ginee_orders
    WHERE (created_at_ginee IS NOT NULL AND created_at_ginee::DATE < cutoff_date)
       OR (created_at_ginee IS NULL AND created_at::DATE < cutoff_date);
    GET DIAGNOSTICS deleted_orders = ROW_COUNT;

    -- 2. Hapus data pembatalan di tabel cancelled_orders yang lebih tua dari cutoff_date
    DELETE FROM public.cancelled_orders
    WHERE cancelled_at::DATE < cutoff_date;
    GET DIAGNOSTICS deleted_cancels = ROW_COUNT;

    -- 3. Hapus data outbound yang lebih tua dari cutoff_date
    DELETE FROM public.ginee_outbounds
    WHERE created_at::DATE < cutoff_date;
    GET DIAGNOSTICS deleted_outbounds = ROW_COUNT;

    RETURN jsonb_build_object(
        'status', 'success',
        'retention_days', retention_days,
        'cutoff_date', cutoff_date,
        'deleted_orders', deleted_orders,
        'deleted_cancellations', deleted_cancels,
        'deleted_outbounds', deleted_outbounds,
        'executed_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. JADWAL CRON OTOMATIS DI SUPABASE (Setiap Malam Jam 03:00 WIB / 20:00 UTC)
-- Otomatis mengeksekusi function purge 5 hari jika pg_cron aktif
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        BEGIN
            PERFORM cron.unschedule('ginee-auto-purge-5-days');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        PERFORM cron.schedule(
            'ginee-auto-purge-5-days',
            '0 20 * * *',
            'SELECT public.purge_expired_ginee_data(5);'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;


-- 8. AKTIFKAN SUPABASE REALTIME REPLICATION (AMAN DARI ERROR 42710 DUPLICATE)
DO $$
BEGIN
    -- 1. cancelled_orders
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cancelled_orders;
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Tabel cancelled_orders sudah terdaftar di publication supabase_realtime';
        WHEN OTHERS THEN
            RAISE NOTICE 'Info realtime cancelled_orders: %', SQLERRM;
    END;

    -- 2. ginee_orders
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ginee_orders;
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Tabel ginee_orders sudah terdaftar di publication supabase_realtime';
        WHEN OTHERS THEN
            RAISE NOTICE 'Info realtime ginee_orders: %', SQLERRM;
    END;
END $$;


-- 9. ROW LEVEL SECURITY (RLS) & POLICIES
ALTER TABLE public.cancelled_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ginee_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ginee_outbounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ginee_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all operations on cancelled_orders" ON public.cancelled_orders;
    DROP POLICY IF EXISTS "Allow all operations on ginee_orders" ON public.ginee_orders;
    DROP POLICY IF EXISTS "Allow all operations on ginee_outbounds" ON public.ginee_outbounds;
    DROP POLICY IF EXISTS "Allow all operations on ginee_credentials" ON public.ginee_credentials;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE POLICY "Allow all operations on cancelled_orders" ON public.cancelled_orders
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ginee_orders" ON public.ginee_orders
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ginee_outbounds" ON public.ginee_outbounds
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ginee_credentials" ON public.ginee_credentials
    FOR ALL USING (true) WITH CHECK (true);


-- 10. REFRESH SCHEMA CACHE POSTGREST
NOTIFY pgrst, 'reload schema';


-- TRIGGER AUTO-PURGE PEMBERSIH OTOMATIS SAAT ADA BATCH PESANAN BARU
CREATE OR REPLACE FUNCTION public.trigger_auto_purge_ginee()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.purge_expired_ginee_data(5);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_purge_ginee ON public.ginee_orders;
CREATE TRIGGER trg_auto_purge_ginee
AFTER INSERT ON public.ginee_orders
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_auto_purge_ginee();
