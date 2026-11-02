const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key.trim()] = val.join('=').trim().replace(/[\'\"]/g, '');
  return acc;
}, {});

import('@supabase/supabase-js').then(({ createClient }) => {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  async function check() {
    const startOfDay = new Date('2026-08-17T00:00:00');
    let endOfDay = new Date('2026-08-17T23:59:59');
    
    console.log('Querying from', startOfDay.toISOString(), 'to', endOfDay.toISOString());
    const { data, error } = await supabase
      .from('batches')
      .select('id, batch_no, created_at')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());
    
    if (error) {
      console.error(error);
    } else {
      console.log('Found batches:', data.length);
      console.log(data);
    }
  }
  check();
});
