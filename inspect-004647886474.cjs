const { createClient } = require('@supabase/supabase-js');

const ACTIVE_URL = 'https://iwvbrigjydmhbwbnbbbk.supabase.co';
const ACTIVE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3dmJyaWdqeWRtaGJ3Ym5iYmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzQ5MzksImV4cCI6MjA4NTU1MDkzOX0.RkdZ2vZDWGvY6VTQLE3JYfpMEvIBOrO7b6xyGFoRf1k';

const supabase = createClient(ACTIVE_URL, ACTIVE_KEY);

async function run() {
  const barcode = '004647886474';
  
  console.log('=== CHECKING leader_scan_2 ===');
  const { data: leader, error: lErr } = await supabase
    .from('leader_scan_2')
    .select('*')
    .eq('barcode', barcode);
  console.log('leader_scan_2:', leader);

  console.log('=== CHECKING ALL scanned_items FOR THIS BARCODE ===');
  const { data: scans } = await supabase
    .from('scanned_items')
    .select('*')
    .eq('barcode', barcode);
  console.log('scanned_items:', scans);
}

run().catch(console.error);
