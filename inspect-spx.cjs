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

  const { data } = await supabase.from('scanned_items').select('*').ilike('barcode', '%SPXID73638420055%');
  console.log('Items for SPXID73638420055:', data);

  process.exit(0);
});
