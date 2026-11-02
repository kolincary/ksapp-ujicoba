const { createClient } = require('@supabase/supabase-js');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, updateDoc, doc } = require('firebase/firestore');

const ACTIVE_URL = 'https://iwvbrigjydmhbwbnbbbk.supabase.co';
const ACTIVE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3dmJyaWdqeWRtaGJ3Ym5iYmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzQ5MzksImV4cCI6MjA4NTU1MDkzOX0.RkdZ2vZDWGvY6VTQLE3JYfpMEvIBOrO7b6xyGFoRf1k';

const firebaseConfig = {
  apiKey: "AIzaSyCyt5XTwrSIK0aWlZXkUw4wdaMrMZsfbP4",
  authDomain: "pro-pulsar-476713-s9.firebaseapp.com",
  projectId: "pro-pulsar-476713-s9",
  storageBucket: "pro-pulsar-476713-s9.firebasestorage.app",
  messagingSenderId: "1087859743191",
  appId: "1:1087859743191:web:aec1c24af3ad0b40d61392"
};

const supabase = createClient(ACTIVE_URL, ACTIVE_KEY);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "project-ks");

async function run() {
  console.log('=== SYNCING FIRESTORE admin_batch_imports WITH SUPABASE batches ===');
  
  // 1. Get all 2026-08-20 batches in Firestore
  const start20 = '2026-08-20T00:00:00.000Z';
  const end20 = '2026-08-20T23:59:59.999Z';

  const q20 = query(
    collection(db, 'admin_batch_imports'),
    where('timestamp', '>=', start20),
    where('timestamp', '<=', end20)
  );

  const snap20 = await getDocs(q20);
  console.log('Found Firestore docs on 2026-08-20:', snap20.size);

  const targetDate19Iso = '2026-08-19T12:00:00.000Z'; // Set to 19 August 2026

  for (const docSnap of snap20.docs) {
    const data = docSnap.data();
    console.log(`Updating Firestore doc ${docSnap.id} (${data.excelFilename}) to timestamp ${targetDate19Iso}...`);
    await updateDoc(doc(db, 'admin_batch_imports', docSnap.id), {
      timestamp: targetDate19Iso
    });
  }

  // 2. Also update Supabase batches and batch_items for 2026-08-20
  const { data: sbBatches } = await supabase
    .from('batches')
    .select('id, batch_no, created_at')
    .gte('created_at', start20)
    .lte('created_at', end20);

  console.log('Found Supabase batches on 2026-08-20:', sbBatches?.length);

  if (sbBatches && sbBatches.length > 0) {
    const sbIds = sbBatches.map(b => b.id);
    const { error: bErr } = await supabase.from('batches').update({ created_at: targetDate19Iso }).in('id', sbIds);
    if (bErr) console.error('Supabase batch update error:', bErr);
    
    const { error: biErr } = await supabase.from('batch_items').update({ created_at: targetDate19Iso }).in('batch_id', sbIds);
    if (biErr) console.error('Supabase batch_items update error:', biErr);
    console.log('Supabase batches & batch_items updated successfully to 2026-08-19!');
  }

  console.log('=== SYNC COMPLETED SUCCESSFULLY ===');
}

run().catch(console.error);
