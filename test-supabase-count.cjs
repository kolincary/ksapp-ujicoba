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

  const startOfDay = new Date('2026-08-17T00:00:00');
  let endOfDay = new Date('2026-08-17T23:59:59');
  
  const { data: batches } = await supabase
    .from('batches')
    .select('id, batch_no')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());
    
  if (batches && batches.length > 0) {
    const batchIds = batches.map(b => b.id);
    const { data: items, count } = await supabase
      .from('batch_items')
      .select('id, batch_id, barcode', { count: 'exact' })
      .in('batch_id', batchIds);
      
    console.log('Found total batch_items:', count);
    
    // Check if there's any batch with exactly 23 items
    const batchItemCounts = {};
    items.forEach(item => {
      batchItemCounts[item.batch_id] = (batchItemCounts[item.batch_id] || 0) + 1;
    });
    
    console.log('Items per batch:');
    for (const batch of batches) {
      console.log(batch.batch_no, ':', batchItemCounts[batch.id] || 0);
    }
  }
  process.exit(0);
});
