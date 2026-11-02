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

  const { data: b } = await supabase.from('batches').select('*').eq('id', '8c619c25-4441-431c-a5e6-a1088a3635d5').single();
  console.log('Batch:', b);
  
  const { data: bItem } = await supabase.from('batch_items').select('*').eq('batch_id', '8c619c25-4441-431c-a5e6-a1088a3635d5');
  console.log('Batch Items:', bItem);

  process.exit(0);
});
