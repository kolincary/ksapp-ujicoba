const { createClient } = require('@supabase/supabase-js');

const url = 'https://qfqmvdhnngvlsjnkoexm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmcW12ZGhubmd2bHNqbmtvZXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjkxODQsImV4cCI6MjEwODYwNTE4NH0.Szsjl533fjymy6VXdRlf0YOxoPM4kGsjGQeEGImwW6Y';

const supabase = createClient(url, key);

async function testTabs() {
  const batchDateFilter = '2026-10-31';
  const startOfDay = new Date(batchDateFilter + 'T00:00:00');
  let endOfDay = new Date(batchDateFilter + 'T23:59:59');

  console.log('Date range UTC:', startOfDay.toISOString(), 'to', endOfDay.toISOString());

  // TAB 1: SUMMARY (fetchBatchSummaryData)
  console.log('\n--- TESTING SUMMARY TAB ---');
  const t0 = Date.now();
  let summaryQuery = supabase.from('batches').select('*', { count: 'exact' });
  summaryQuery = summaryQuery.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());
  const { data: summaryData, count: summaryCount, error: summaryErr } = await summaryQuery;
  console.log(`SUMMARY query took ${Date.now() - t0}ms`);
  console.log('SUMMARY count:', summaryCount, 'error:', summaryErr);
  console.log('SUMMARY rows:', summaryData ? summaryData.length : 0);

  // TAB 2: ITEMS (fetchBatchData)
  console.log('\n--- TESTING ITEMS TAB ---');
  const t1 = Date.now();
  let batchesQuery = supabase
    .from('batches')
    .select('id, batch_no, excel_filename, created_at')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString())
    .order('created_at', { ascending: false })
    .limit(500);

  const { data: batchesData, error: batchesErr } = await batchesQuery;
  console.log(`Batches query took ${Date.now() - t1}ms`);
  console.log('Batches found:', batchesData ? batchesData.length : 0, 'error:', batchesErr);

  if (batchesData && batchesData.length > 0) {
    const batchIds = batchesData.map(b => b.id);
    const CHUNK_SIZE = 50;
    const batchChunks = [];
    for (let i = 0; i < batchIds.length; i += CHUNK_SIZE) {
      batchChunks.push(batchIds.slice(i, i + CHUNK_SIZE));
    }
    const t2 = Date.now();
    const itemPromises = batchChunks.map(chunk =>
      supabase
        .from('batch_items')
        .select('id, barcode, batch_id, created_at, msku, qty, order_id')
        .in('batch_id', chunk)
    );
    const itemResults = await Promise.all(itemPromises);
    let totalItems = 0;
    itemResults.forEach(r => { if (r.data) totalItems += r.data.length; });
    console.log(`Batch items query took ${Date.now() - t2}ms, total items: ${totalItems}`);
  }

  // TAB 3: AUDIT_KOMPARASI (fetchAuditData / fetchAdminImports)
  console.log('\n--- TESTING AUDIT_KOMPARASI / REKAP_ADMIN ---');
  // How does fetchAdminImports fetch?
}

testTabs();
