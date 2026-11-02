const { createClient } = require('@supabase/supabase-js');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

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
  const barcode = 'JT12607971529';
  console.log(`=== SEARCHING FOR BARCODE ${barcode} ===`);

  // 1. Check Supabase batch_items
  const { data: bi, error: biErr } = await supabase
    .from('batch_items')
    .select('id, barcode, batch_id, created_at, batches!inner(batch_no, excel_filename, created_at)')
    .eq('barcode', barcode);

  console.log('\nSupabase batch_items:', bi);

  // 2. Check Supabase scanned_items
  const { data: si } = await supabase
    .from('scanned_items')
    .select('*')
    .eq('barcode', barcode);

  console.log('\nSupabase scanned_items:', si);

  // 3. Check Firestore admin_batch_imports
  const qFs = query(collection(db, 'admin_batch_imports'), where('barcodes', 'array-contains', barcode));
  const snapFs = await getDocs(qFs);
  console.log('\nFirestore admin_batch_imports docs:', snapFs.size);
  snapFs.forEach(docSnap => {
    const d = docSnap.data();
    console.log(`Doc ID: ${docSnap.id} | BatchId: ${d.batchId} | File: ${d.excelFilename || d.fileName} | Timestamp: ${d.timestamp}`);
  });
}

run().catch(console.error);
