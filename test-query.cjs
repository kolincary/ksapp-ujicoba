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
  
  console.log('Querying batch_items from', startOfDay.toISOString(), 'to', endOfDay.toISOString());
  
  let query = supabase
     .from('batch_items')
     .select('*, batches!inner(batch_no, excel_filename, created_at)', { count: 'exact' })
     .gte('batches.created_at', startOfDay.toISOString())
     .lte('batches.created_at', endOfDay.toISOString());

  const { data: itemsData, error: itemsErr, count } = await query
     .order('created_at', { ascending: false })
     .limit(5000);
     
  if (itemsErr) console.error('Error:', itemsErr);
  console.log('Items returned:', itemsData ? itemsData.length : 0);
  console.log('Count:', count);
  
  process.exit(0);
});
