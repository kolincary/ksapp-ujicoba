const { createClient } = require('@supabase/supabase-js');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, limit } = require('firebase/firestore');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const sbUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const sbKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(sbUrl, sbKey);

const firebaseConfig = {
  apiKey: "AIzaSyCyt5XTwrSIK0aWlZXkUw4wdaMrMZsfbP4",
  authDomain: "pro-pulsar-476713-s9.firebaseapp.com",
  projectId: "pro-pulsar-476713-s9",
  storageBucket: "pro-pulsar-476713-s9.firebasestorage.app",
  messagingSenderId: "1087859743191",
  appId: "1:1087859743191:web:aec1c24af3ad0b40d61392"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'project-ks');

async function restoreMissingBatchItems() {
  console.log('=== RESTORING MISSING BATCH ITEMS FROM FIRESTORE ===');
  
  // 1. Fetch all batches from recent days
  const { data: batches, error } = await supabase
    .from('batches')
    .select('id, batch_no, excel_filename, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching batches:', error);
    process.exit(1);
  }

  console.log(`Checking ${batches.length} batches...`);

  let restoredCount = 0;
  let totalItemsRestored = 0;

  for (const batch of batches) {
    // Check item count
    const { count } = await supabase
      .from('batch_items')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batch.id);

    if (count !== 0) {
      continue;
    }

    console.log(`\nBatch ${batch.batch_no} (${batch.excel_filename || 'No file'}) has 0 items. Searching in Firestore...`);

    // Try finding in Firestore by batchId
    let q = query(collection(db, 'admin_batch_imports'), where('batchId', '==', batch.batch_no), limit(1));
    let snap = await getDocs(q);

    // Fallback: try by excelFilename
    if (snap.empty && batch.excel_filename) {
      q = query(collection(db, 'admin_batch_imports'), where('excelFilename', '==', batch.excel_filename), limit(1));
      snap = await getDocs(q);
    }

    if (snap.empty) {
      console.log(`  -> Not found in Firestore admin_batch_imports.`);
      continue;
    }

    const fsDoc = snap.docs[0].data();
    const barcodes = fsDoc.barcodes;
    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      console.log(`  -> Firestore doc found but barcodes array is empty.`);
      continue;
    }

    console.log(`  -> Found in Firestore with ${barcodes.length} barcodes. Inserting into Supabase batch_items...`);

    const itemsToInsert = barcodes.map(bc => ({
      batch_id: batch.id,
      barcode: bc,
      created_at: batch.created_at || new Date().toISOString()
    }));

    // Insert in chunks of 500
    for (let i = 0; i < itemsToInsert.length; i += 500) {
      const chunk = itemsToInsert.slice(i, i + 500);
      const { error: insErr } = await supabase.from('batch_items').insert(chunk);
      if (insErr) {
        console.error(`  -> Insert chunk error:`, insErr.message);
      }
    }

    restoredCount++;
    totalItemsRestored += barcodes.length;
    console.log(`  -> Successfully restored ${barcodes.length} items for batch ${batch.batch_no}!`);
  }

  console.log(`\n=== RESTORATION COMPLETE ===`);
  console.log(`Batches restored: ${restoredCount}`);
  console.log(`Total items restored: ${totalItemsRestored}`);
  process.exit(0);
}

restoreMissingBatchItems().catch(err => {
  console.error('Fatal restoration error:', err);
  process.exit(1);
});
