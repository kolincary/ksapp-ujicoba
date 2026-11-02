import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCyt5XTwrSIK0aWlZXkUw4wdaMrMZsfbP4",
  authDomain: "pro-pulsar-476713-s9.firebaseapp.com",
  projectId: "pro-pulsar-476713-s9",
  storageBucket: "pro-pulsar-476713-s9.firebasestorage.app",
  messagingSenderId: "1087859743191",
  appId: "1:1087859743191:web:aec1c24af3ad0b40d61392"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "project-ks");

function excelToDateStr(excelVal) {
  if (!excelVal || isNaN(excelVal)) return null;
  const jsTimestamp = Math.round((excelVal - 25569) * 86400 * 1000);
  const d = new Date(jsTimestamp);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function audit() {
  console.log("=== AUDITING ALL FIRESTORE COLLECTIONS & DATE FORMATS FOR JUL 30 & 31 ===");

  // 1. Check all collections in Firestore if possible or test common collection names
  const collectionsToTest = [
    'scanned_items',
    'scanned_items_archive',
    'packing_data',
    'packing_logs',
    'batches',
    'leader_scan_2',
    'scanned_history'
  ];

  for (const collName of collectionsToTest) {
    try {
      const snap = await getDocs(query(collection(db, collName), limit(5)));
      console.log(`Collection "${collName}": Exists! Found ${snap.docs.length} sample docs.`);
    } catch (e) {
      console.log(`Collection "${collName}": ${e.message}`);
    }
  }

  // 2. Fetch a large sample of scanned_items to inspect scan_date, created_at, timestamp, excel_filename
  console.log("\nFetching scanned_items sample to inspect all date representations...");
  const snapAll = await getDocs(query(collection(db, 'scanned_items'), limit(5000)));
  console.log(`Examining ${snapAll.docs.length} scanned_items...`);

  let jul30Count = 0;
  let jul31Count = 0;
  const dateFormatsFound = new Set();
  const scanDateValues = {};
  const createdAtValues = {};

  snapAll.docs.forEach(docSnap => {
    const d = docSnap.data();
    
    // Check scan_date field
    if (d.scan_date !== undefined) {
      const sd = String(d.scan_date);
      scanDateValues[sd] = (scanDateValues[sd] || 0) + 1;
      if (sd.includes('2026-07-30') || sd === '30-07-2026' || sd === '30/07/2026') jul30Count++;
      if (sd.includes('2026-07-31') || sd === '31-07-2026' || sd === '31/07/2026') jul31Count++;
    }

    // Check created_at field
    if (d.created_at !== undefined) {
      const ca = String(d.created_at);
      if (ca.includes('2026-07-30')) createdAtValues['2026-07-30'] = (createdAtValues['2026-07-30'] || 0) + 1;
      if (ca.includes('2026-07-31')) createdAtValues['2026-07-31'] = (createdAtValues['2026-07-31'] || 0) + 1;
    }

    // Check excel_filename
    if (d.excel_filename) {
      const ef = String(d.excel_filename);
      if (ef.includes('30') || ef.includes('31')) {
        dateFormatsFound.add(`excel_filename: ${ef}`);
      }
    }
  });

  console.log("\nTop scan_date values in sample:", Object.entries(scanDateValues).sort((a,b)=>b[1]-a[1]).slice(0, 20));
  console.log("created_at Jul 30/31 counts:", createdAtValues);
  console.log("Sample excel_filenames matching 30/31:", Array.from(dateFormatsFound).slice(0, 10));

  process.exit(0);
}

audit().catch(console.error);
