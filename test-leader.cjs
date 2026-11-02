const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, value] = line.split('=');
  if (key && value) acc[key.trim()] = value.trim();
  return acc;
}, {});

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
   console.log("Missing credentials");
   process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
   const barcode = '260814AQDSCM33';
   const { data: previousScans, error } = await supabase
      .from('scanned_items')
      .select('id, timestamp, scan_date, description, role')
      .eq('barcode', barcode);

   if (error) {
      console.error("Error:", error);
   } else {
      console.log("Found:", previousScans);
   }
}

test();
