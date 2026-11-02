const { createClient } = require('@supabase/supabase-js');

const ACTIVE_URL = 'https://iwvbrigjydmhbwbnbbbk.supabase.co';
const ACTIVE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3dmJyaWdqeWRtaGJ3Ym5iYmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzQ5MzksImV4cCI6MjA4NTU1MDkzOX0.RkdZ2vZDWGvY6VTQLE3JYfpMEvIBOrO7b6xyGFoRf1k';

const supabase = createClient(ACTIVE_URL, ACTIVE_KEY);

async function run() {
  const barcode = 'JT12607971529';
  console.log(`=== DELETING ORPHANED BARCODE ${barcode} FROM SUPABASE batch_items ===`);

  const { data, error } = await supabase
    .from('batch_items')
    .delete()
    .eq('barcode', barcode)
    .select();

  if (error) console.error('Delete error:', error);
  console.log('Deleted items:', data);
}

run().catch(console.error);
