import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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

async function test() {
  console.log("Investigating ALL PACKING docs in Firestore...");

  // Fetch documents where role == 'PACKING'
  const qPacking = query(collection(db, 'scanned_items'), where('role', '==', 'PACKING'));
  const snap = await getDocs(qPacking);
  console.log(`Fetched ${snap.docs.length} total PACKING docs from Firestore.`);

  const dateFromTimestamp = {};
  const dateFromScanDate = {};
  const dateFromCreatedAt = {};
  const timestampTypes = {};

  snap.docs.forEach(docSnap => {
    const d = docSnap.data();

    // Check timestamp type
    const tsType = typeof d.timestamp;
    timestampTypes[tsType] = (timestampTypes[tsType] || 0) + 1;

    // 1. Date from timestamp
    if (d.timestamp) {
      const tsNum = Number(d.timestamp);
      if (!isNaN(tsNum) && tsNum > 100000000000) {
        const dt = new Date(tsNum);
        const k = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        dateFromTimestamp[k] = (dateFromTimestamp[k] || 0) + 1;
      }
    }

    // 2. Date from scan_date
    if (d.scan_date) {
      let sdStr = String(d.scan_date);
      if (!isNaN(d.scan_date)) {
        sdStr = excelToDateStr(Number(d.scan_date)) || sdStr;
      }
      dateFromScanDate[sdStr] = (dateFromScanDate[sdStr] || 0) + 1;
    }

    // 3. Date from created_at
    if (d.created_at) {
      let caStr = String(d.created_at).substring(0, 10);
      dateFromCreatedAt[caStr] = (dateFromCreatedAt[caStr] || 0) + 1;
    }
  });

  console.log("\n=== Timestamp Types ===");
  console.log(timestampTypes);

  console.log("\n=== Date Breakdown from TIMESTAMP (top 15 dates) ===");
  console.log(Object.entries(dateFromTimestamp).sort((a,b)=>b[1]-a[1]).slice(0, 15));

  console.log("\n=== Date Breakdown from SCAN_DATE (top 15 dates) ===");
  console.log(Object.entries(dateFromScanDate).sort((a,b)=>b[1]-a[1]).slice(0, 15));

  console.log("\n=== Date Breakdown from CREATED_AT (top 15 dates) ===");
  console.log(Object.entries(dateFromCreatedAt).sort((a,b)=>b[1]-a[1]).slice(0, 15));

  process.exit(0);
}

test().catch(console.error);
