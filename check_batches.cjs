const { createClient } = require('@supabase/supabase-js');

const url = 'https://qfqmvdhnngvlsjnkoexm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmcW12ZGhubmd2bHNqbmtvZXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjkxODQsImV4cCI6MjEwODYwNTE4NH0.Szsjl533fjymy6VXdRlf0YOxoPM4kGsjGQeEGImwW6Y';

const supabase = createClient(url, key);

async function check() {
  console.log("Checking Active Supabase:", url);

  // 1. Check connection & tables
  const { data: batches, error: bErr } = await supabase
    .from('batches')
    .select('id, batch_no, excel_filename, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('Batches query error:', bErr);
  console.log('Batches count returned:', batches ? batches.length : 0);
  if (batches && batches.length > 0) {
    console.log('Sample batches:', batches.slice(0, 5));
  }

  // 2. Total count of batches
  const { count: totalBatches, error: cErr } = await supabase
    .from('batches')
    .select('id', { count: 'exact', head: true });
  console.log('Total batches in DB:', totalBatches, 'Error:', cErr);

  // 3. Batch items
  const { count: totalBatchItems, error: biErr } = await supabase
    .from('batch_items')
    .select('id', { count: 'exact', head: true });
  console.log('Total batch_items in DB:', totalBatchItems, 'Error:', biErr);

  // 4. Scanned items
  const { count: totalScanned, error: sErr } = await supabase
    .from('scanned_items')
    .select('id', { count: 'exact', head: true });
  console.log('Total scanned_items in DB:', totalScanned, 'Error:', sErr);

  // 5. Scanned items yesterday (2026-10-31)
  const { count: yestScanned } = await supabase
    .from('scanned_items')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', '2026-10-30T17:00:00Z')
    .lte('created_at', '2026-10-31T23:59:59Z');
  console.log('Scanned items on 2026-10-31 (WIB range):', yestScanned);

  // 6. Admin imports
  const { data: adminImports, error: aiErr } = await supabase
    .from('admin_batch_imports')
    .select('*')
    .limit(5);
  console.log('admin_batch_imports error:', aiErr, 'count:', adminImports ? adminImports.length : 0);
}

check();
