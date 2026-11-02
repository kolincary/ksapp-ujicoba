const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

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

async function check() {
  try {
    const snap = await getDoc(doc(db, 'system_config', 'supabase_active'));
    if (snap.exists()) {
      console.log('Firebase system_config/supabase_active:', snap.data());
    } else {
      console.log('No supabase_active doc found in Firestore');
    }
  } catch (err) {
    console.error('Error fetching Firestore doc:', err);
  }
}

check();
