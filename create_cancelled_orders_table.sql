-- Create cancelled_orders table for tracking cancelled order barcodes
CREATE TABLE IF NOT EXISTS cancelled_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL UNIQUE,
  cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_by TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Create index for faster barcode lookups
CREATE INDEX IF NOT EXISTS idx_cancelled_orders_barcode ON cancelled_orders(barcode);
CREATE INDEX IF NOT EXISTS idx_cancelled_orders_active ON cancelled_orders(is_active);

-- Enable RLS
ALTER TABLE cancelled_orders ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated operations (adjust as needed for your security model)
CREATE POLICY "Allow all operations on cancelled_orders" ON cancelled_orders
  FOR ALL USING (true) WITH CHECK (true);
