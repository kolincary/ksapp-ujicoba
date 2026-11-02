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

  const dates = ['2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18'];

  for (const dateStr of dates) {
     const startOfDay = new Date(dateStr + 'T00:00:00');
     let endOfDay = new Date(dateStr + 'T23:59:59');

     const { data: bRes } = await supabase
        .from('batches')
        .select('id')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

     const { data: iRes } = await supabase
        .from('batch_items')
        .select('*, batches!inner(batch_no, excel_filename, created_at)', { count: 'exact' })
        .gte('batches.created_at', startOfDay.toISOString())
        .lte('batches.created_at', endOfDay.toISOString());

     console.log(`Date: ${dateStr} | Batches count: ${bRes?.length || 0} | BatchItems count: ${iRes?.length || 0}`);
  }

  process.exit(0);
});
