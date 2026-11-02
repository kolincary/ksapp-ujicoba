const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key.trim()] = val.join('=').trim().replace(/[\'\"]/g, '');
  return acc;
}, {});

import('@supabase/supabase-js').then(async ({ createClient }) => {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Fetch ALL batches without date filter
  const { data: batches } = await supabase
    .from('batches')
    .select('id, batch_no, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
    
  console.log('--- LATEST 50 BATCHES ---');
  batches.forEach(b => {
    console.log(`ID: ${b.id} | BatchNo: ${b.batch_no} | CreatedAt: ${b.created_at}`);
  });

  // 2. Fetch ALL batch_items without date filter
  const { data: items } = await supabase
     .from('batch_items')
     .select('id, barcode, created_at, batch_id')
     .order('created_at', { ascending: false })
     .limit(50);

  console.log('\n--- LATEST 50 BATCH_ITEMS ---');
  items.forEach(i => {
    console.log(`ID: ${i.id} | Barcode: ${i.barcode} | CreatedAt: ${i.created_at} | BatchID: ${i.batch_id}`);
  });

  process.exit(0);
});
