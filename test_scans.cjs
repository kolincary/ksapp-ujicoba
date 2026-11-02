const { createClient } = require('@supabase/supabase-js');

const url = 'https://qfqmvdhnngvlsjnkoexm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmcW12ZGhubmd2bHNqbmtvZXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjkxODQsImV4cCI6MjEwODYwNTE4NH0.Szsjl533fjymy6VXdRlf0YOxoPM4kGsjGQeEGImwW6Y';

const supabase = createClient(url, key);

async function testBarcodeScans() {
  const batchDateFilter = '2026-10-31';
  const startOfDay = new Date(batchDateFilter + 'T00:00:00');
  const endOfDay = new Date(batchDateFilter + 'T23:59:59');

  console.log('Testing scanned_items queries for 2026-10-31...');

  // Get batches
  const { data: batchesData } = await supabase
    .from('batches')
    .select('id, batch_no, excel_filename, created_at')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString())
    .limit(500);

  const batchIds = batchesData.map(b => b.id);
  const CHUNK_SIZE = 50;
  const batchChunks = [];
  for (let i = 0; i < batchIds.length; i += CHUNK_SIZE) {
    batchChunks.push(batchIds.slice(i, i + CHUNK_SIZE));
  }
  const itemResults = await Promise.all(
    batchChunks.map(chunk =>
      supabase.from('batch_items').select('barcode').in('batch_id', chunk)
    )
  );

  let allBarcodes = [];
  itemResults.forEach(r => {
    if (r.data) allBarcodes.push(...r.data.map(i => i.barcode));
  });
  allBarcodes = Array.from(new Set(allBarcodes.filter(Boolean)));
  console.log(`Found ${allBarcodes.length} distinct barcodes.`);

  const t0 = Date.now();
  const sampleChunk = allBarcodes.slice(0, 200);
  const { data: scanData, error: scanErr } = await supabase
    .from('scanned_items')
    .select('barcode, user_email, employee_name, role')
    .in('role', ['PICKER', 'PICKER_2', 'OJOL'])
    .in('barcode', sampleChunk);

  console.log(`Query 1 chunk of 200 barcodes took ${Date.now() - t0}ms, error:`, scanErr, 'found:', scanData ? scanData.length : 0);

  // Now test all chunks
  const barcodeChunks = [];
  for (let i = 0; i < allBarcodes.length; i += 200) {
    barcodeChunks.push(allBarcodes.slice(i, i + 200));
  }
  console.log(`Total chunks to query: ${barcodeChunks.length}`);
  const tTotal = Date.now();
  for (let i = 0; i < barcodeChunks.length; i += 3) {
    const slice = barcodeChunks.slice(i, i + 3);
    await Promise.all(
      slice.map(c =>
        supabase.from('scanned_items').select('barcode, user_email, employee_name, role').in('role', ['PICKER', 'PICKER_2', 'OJOL']).in('barcode', c)
      )
    );
  }
  console.log(`All ${barcodeChunks.length} chunks took ${Date.now() - tTotal}ms`);
}

testBarcodeScans();
