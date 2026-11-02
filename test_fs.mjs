import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

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

async function test() {
  console.log("Querying firestore...");
  const q = query(collection(db, 'scanned_items'), limit(5000));
  const snap = await getDocs(q);
  console.log(`Fetched ${snap.docs.length} docs`);
  
  let found = 0;
  snap.forEach(doc => {
    const data = doc.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('ainul 26') || str.includes('sp campur')) {
      console.log(doc.id, data);
      found++;
    }
  });
  console.log(`Found ${found} matches.`);
  process.exit(0);
}

test().catch(console.error);
