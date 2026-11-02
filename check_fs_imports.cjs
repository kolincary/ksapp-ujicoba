const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, limit } = require('firebase/firestore');

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

async function checkAdminImports() {
  const batchDateFilter = '2026-10-31';
  const startOfDay = new Date(batchDateFilter + 'T00:00:00');
  const endOfDay = new Date(batchDateFilter + 'T23:59:59.999');

  console.log('Querying Firestore admin_batch_imports between', startOfDay.toISOString(), 'and', endOfDay.toISOString());

  const importsRef = collection(db, 'admin_batch_imports');
  const q = query(
    importsRef,
    where('timestamp', '>=', startOfDay.toISOString()),
    where('timestamp', '<=', endOfDay.toISOString())
  );

  const snap = await getDocs(q);
  console.log('admin_batch_imports docs found:', snap.size);
  snap.forEach(d => {
    const data = d.data();
    console.log(`- ${d.id}: batchId=${data.batchId}, excelFilename=${data.excelFilename}, timestamp=${data.timestamp}, barcodesCount=${data.barcodes ? data.barcodes.length : 0}`);
  });
}

checkAdminImports();
