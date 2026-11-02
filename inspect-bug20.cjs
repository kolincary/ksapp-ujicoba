const { createClient } = require('@supabase/supabase-js');

const ACTIVE_URL = 'https://iwvbrigjydmhbwbnbbbk.supabase.co';
const ACTIVE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3dmJyaWdqeWRtaGJ3Ym5iYmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzQ5MzksImV4cCI6MjA4NTU1MDkzOX0.RkdZ2vZDWGvY6VTQLE3JYfpMEvIBOrO7b6xyGFoRf1k';

const supabase = createClient(ACTIVE_URL, ACTIVE_KEY);

async function run() {
  const { data: batches } = await supabase
    .from('batches')
    .select('id, batch_no, created_at, created_by, excel_filename')
    .order('created_at', { ascending: false })
    .limit(20);

  const batch20Ids = batches.filter(b => b.batch_no.includes('20260820')).map(b => b.id);
  console.log('2026-08-20 Batch IDs:', batch20Ids);

  if (batch20Ids.length > 0) {
    const { data: items } = await supabase
      .from('batch_items')
      .select('id, barcode, batch_id')
      .in('batch_id', batch20Ids);

    console.log(`Total batch_items in 20260820 batches: ${items?.length}`);

    if (items && items.length > 0) {
      const sampleBc = items.map(i => i.barcode);
      const { data: scans } = await supabase
        .from('scanned_items')
        .select('barcode, role, scanned_at, staff_name')
        .in('barcode', sampleBc);

      console.log('\nScanned items count:', scans?.length);
      (scans || []).forEach(s => {
        const utcDate = new Date(s.scanned_at);
        const wibDate = new Date(utcDate.getTime() + 7 * 3600 * 1000);
        console.log(`Barcode: ${s.barcode} | Role: ${s.role} | Staff: ${s.staff_name} | Scanned UTC: ${s.scanned_at} | Scanned WIB: ${wibDate.toISOString().replace('Z', '+07:00')}`);
      });
    }
  }
}

run().catch(console.error);
