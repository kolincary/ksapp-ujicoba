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

  // 1. Delete the duplicate row
  await supabase.from('scanned_items').delete().eq('id', '1786970654075-cnbbhueic');
  
  // 2. Update the original pending row to COMPLETED & READY
  await supabase.from('scanned_items').update({
    status: 'COMPLETED',
    menu_context: 'READY',
    description: '[READY] Manual Entry'
  }).eq('id', '1786970521344-j4evzjxk2');

  console.log('Successfully cleaned up duplicate and updated pending row!');

  process.exit(0);
});
