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
  // Excel base date: Dec 30, 1899
  const jsTimestamp = Math.round((excelVal - 25569) * 86400 * 1000);
  const d = new Date(jsTimestamp);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseAnyDateToStr(item) {
  // Try timestamp (Unix ms)
  if (item.timestamp && typeof item.timestamp === 'number') {
    if (item.timestamp > 100000000000) { // Unix ms
      const d = new Date(item.timestamp);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  // Try scan_date (Excel serial)
  if (item.scan_date) {
    const fromScanDate = excelToDateStr(Number(item.scan_date));
    if (fromScanDate) return fromScanDate;
  }
  // Try created_at (Excel serial or string)
  if (item.created_at) {
    if (!isNaN(item.created_at)) {
      const fromCreated = excelToDateStr(Number(item.created_at));
      if (fromCreated) return fromCreated;
    } else if (typeof item.created_at === 'string') {
      return item.created_at.substring(0, 10);
    }
  }
  return 'unknown';
}

async function test() {
  console.log("Checking dates across Firestore scanned_items...");

  // Query role PACKING
  const snap = await getDocs(query(collection(db, 'scanned_items'), where('role', '==', 'PACKING'), limit(2000)));
  console.log(`Fetched ${snap.docs.length} PACKING docs.`);

  const dateCounts = {};
  snap.docs.forEach(doc => {
    const d = doc.data();
    const parsedDate = parseAnyDateToStr(d);
    dateCounts[parsedDate] = (dateCounts[parsedDate] || 0) + 1;
  });

  console.log("Parsed Date Counts for PACKING in Firestore (sample 2000):", dateCounts);

  // Check if any docs match August 2026 or 2026-08-06
  const aug6Docs = snap.docs.filter(doc => parseAnyDateToStr(doc.data()) === '2026-08-06');
  console.log(`Matching 2026-08-06: ${aug6Docs.length} docs`);

  process.exit(0);
}

test().catch(console.error);
