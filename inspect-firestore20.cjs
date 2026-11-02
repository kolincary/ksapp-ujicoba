const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, orderBy, limit } = require('firebase/firestore');

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

async function run() {
  console.log('=== QUERYING FIRESTORE admin_batch_imports FOR 2026-08-20 ===');
  const start20 = '2026-08-20T00:00:00.000Z';
  const end20 = '2026-08-20T23:59:59.999Z';

  const q20 = query(
    collection(db, 'admin_batch_imports'),
    where('timestamp', '>=', start20),
    where('timestamp', '<=', end20)
  );

  const snap20 = await getDocs(q20);
  console.log('Firestore docs on 2026-08-20:', snap20.size);

  let totalResi20 = 0;
  snap20.forEach(docSnap => {
    const d = docSnap.data();
    const len = Array.isArray(d.barcodes) ? d.barcodes.length : (d.jumlah || 0);
    totalResi20 += len;
    console.log(`Doc ID: ${docSnap.id} | Staff: ${d.staffName} | Timestamp: ${d.timestamp} | Barcodes count: ${len} | Title: ${d.title || d.fileName}`);
  });
  console.log('Total Resi on 2026-08-20:', totalResi20);

  console.log('\n=== QUERYING FIRESTORE admin_batch_imports FOR 2026-08-19 ===');
  const start19 = '2026-08-19T00:00:00.000Z';
  const end19 = '2026-08-19T23:59:59.999Z';

  const q19 = query(
    collection(db, 'admin_batch_imports'),
    where('timestamp', '>=', start19),
    where('timestamp', '<=', end19)
  );

  const snap19 = await getDocs(q19);
  console.log('Firestore docs on 2026-08-19:', snap19.size);
  let totalResi19 = 0;
  snap19.forEach(docSnap => {
    const d = docSnap.data();
    const len = Array.isArray(d.barcodes) ? d.barcodes.length : (d.jumlah || 0);
    totalResi19 += len;
    console.log(`Doc ID: ${docSnap.id} | Staff: ${d.staffName} | Timestamp: ${d.timestamp} | Barcodes count: ${len} | Title: ${d.title || d.fileName}`);
  });
  console.log('Total Resi on 2026-08-19:', totalResi19);
}

run().catch(console.error);
