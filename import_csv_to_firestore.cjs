/**
 * Tool Import CSV/Excel Supabase -> Cloud Firestore (Ultra Fast, Multi-File Batch & 100% Robust)
 * 
 * Fitur:
 * 1. Mendukung SATU file maupun BANYAK file CSV/Excel sekaligus secara berurutan.
 * 2. Mampu memproses ratusan ribu hingga jutaan data dengan aman.
 * 3. Anti-dobel/duplikasi (menggunakan Document ID asli Supabase dengan merge: true).
 * 
 * Cara Penggunaan:
 * - Import SEMUA file CSV di folder:
 *   npm run import-csv
 * 
 * - Import 1 file tertentu:
 *   node import_csv_to_firestore.cjs "scanned_agustus.csv"
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('./node_modules/xlsx');

// Import Firebase Client SDK from local node_modules
const { initializeApp } = require('./node_modules/firebase/app');
const { getFirestore, doc, writeBatch } = require('./node_modules/firebase/firestore');

// Konfigurasi Firebase (Project KS)
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
const TARGET_COLLECTION = 'scanned_items';
const BATCH_SIZE = 250; // Ukuran batch optimal & aman
const THROTTLE_DELAY_MS = 25; // Jeda mikro agar write stream Firestore stabil

// Bersihkan Document ID dari karakter terlarang Firestore (terutama '/')
function sanitizeDocId(rawId, row, index) {
  let id = rawId ? String(rawId).trim() : '';
  if (!id || id === 'undefined' || id === 'null') {
    const b = row.barcode ? String(row.barcode).replace(/[^a-zA-Z0-9_-]/g, '') : 'item';
    const r = row.role ? String(row.role).replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const ts = row.timestamp || Date.now();
    id = `${b}_${r}_${ts}_${index}`;
  }
  // Ganti tanda garis miring '/' yang dilarang Firestore
  id = id.replace(/\//g, '_').replace(/\\/g, '_');
  return id;
}

// Cari seluruh file CSV / XLSX di folder
function getAllDataFiles() {
  const argFile = process.argv[2];
  if (argFile) {
    const resolved = path.resolve(argFile);
    if (fs.existsSync(resolved)) return [resolved];
    console.error(`❌ File '${argFile}' tidak ditemukan!`);
    process.exit(1);
  }

  const files = fs.readdirSync(__dirname);
  const matched = files
    .filter(f => {
      const lower = f.toLowerCase();
      return (lower.endsWith('.csv') || lower.endsWith('.xlsx')) && !lower.includes('package');
    })
    .map(f => path.join(__dirname, f));

  return matched;
}

async function importSingleFile(filePath, fileIndex, totalFiles) {
  const fileName = path.basename(filePath);
  const fileStats = fs.statSync(filePath);
  const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n------------------------------------------------------`);
  console.log(`📂 [File ${fileIndex}/${totalFiles}] : ${fileName} (${fileSizeMB} MB)`);
  console.log(`⏳ Membaca & mem-parsing file...`);

  const workbook = XLSX.readFile(filePath, { raw: false, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

  console.log(`📊 Ditemukan : ${rawRows.length.toLocaleString('id-ID')} baris data`);
  if (rawRows.length === 0) {
    console.log(`⚠️ File kosong, lewati.`);
    return 0;
  }

  console.log(`⏳ Mengirim data ke Firestore ('${TARGET_COLLECTION}')...`);
  const startTime = Date.now();
  let successCount = 0;
  let batchItems = [];
  let batchNumber = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const item = {};

    for (const key in raw) {
      let val = raw[key];
      if (val !== null && val !== undefined && val !== '') {
        const cleanKey = String(key).trim();

        if (typeof val === 'string') {
          val = val.trim();
        }

        if (cleanKey === 'barcode') {
          val = String(val).trim();
        }

        if (cleanKey === 'timestamp') {
          const num = Number(val);
          if (!isNaN(num) && num > 0) {
            val = num;
          } else {
            const parsed = new Date(val).getTime();
            if (!isNaN(parsed)) val = parsed;
          }
        }

        item[cleanKey] = val;
      }
    }

    const docId = sanitizeDocId(item.id, item, i);
    batchItems.push({ docId, data: item });

    if (batchItems.length >= BATCH_SIZE) {
      batchNumber++;
      await commitBatch(batchItems);
      successCount += batchItems.length;
      batchItems = [];

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const speed = Math.round(successCount / (elapsedSec || 1));
      const pct = Math.round((successCount / rawRows.length) * 100);
      process.stdout.write(`\r   [Batch #${batchNumber}] Terimport: ${successCount.toLocaleString('id-ID')} / ${rawRows.length.toLocaleString('id-ID')} (${pct}%) | ${speed} data/dtk | ${elapsedSec}s`);

      if (THROTTLE_DELAY_MS > 0) {
        await new Promise(r => setTimeout(r, THROTTLE_DELAY_MS));
      }
    }
  }

  if (batchItems.length > 0) {
    batchNumber++;
    await commitBatch(batchItems);
    successCount += batchItems.length;
  }

  const fileTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n   ✅ ${fileName} Selesai: ${successCount.toLocaleString('id-ID')} data terimport (${fileTime}s)`);
  return successCount;
}

async function runImport() {
  console.log('\n======================================================');
  console.log('🚀 KALINDO SCAN: IMPORT CSV/EXCEL -> CLOUD FIRESTORE');
  console.log('======================================================');
  console.log(`🎯 Database Target   : project-ks (Firestore)`);
  console.log(`📦 Collection Target : ${TARGET_COLLECTION}`);

  const files = getAllDataFiles();
  if (files.length === 0) {
    console.error('\n❌ Tidak ada file CSV / Excel yang ditemukan di folder!');
    console.log('\nPetunjuk:');
    console.log('1. Letakkan satu atau beberapa file CSV di folder proyek ini.');
    console.log('2. Atau jalankan: node import_csv_to_firestore.cjs "nama_file.csv"\n');
    process.exit(1);
  }

  console.log(`\n📁 Total File Ditemukan : ${files.length} file:`);
  files.forEach((f, idx) => console.log(`   ${idx + 1}. ${path.basename(f)}`));

  const totalStartTime = Date.now();
  let grandTotalImported = 0;

  for (let i = 0; i < files.length; i++) {
    const imported = await importSingleFile(files[i], i + 1, files.length);
    grandTotalImported += imported;
  }

  const grandTotalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`🎉 SEMUA FILE TELAH BERHASIL DIIMPORT!`);
  console.log(`📁 Total File Diproses   : ${files.length} file`);
  console.log(`📊 Grand Total Data Masuk: ${grandTotalImported.toLocaleString('id-ID')} data`);
  console.log(`⏱️ Total Waktu           : ${grandTotalTime} detik`);
  console.log(`🎯 Koleksi Firestore     : '${TARGET_COLLECTION}' (project-ks)`);
  console.log(`======================================================\n`);
  process.exit(0);
}

async function commitBatch(items) {
  const batch = writeBatch(db);
  for (const { docId, data } of items) {
    const docRef = doc(db, TARGET_COLLECTION, docId);
    batch.set(docRef, data, { merge: true });
  }

  let retries = 3;
  while (retries > 0) {
    try {
      await batch.commit();
      break;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

runImport().catch(err => {
  console.error('\n❌ Terjadi error saat proses import:', err);
  process.exit(1);
});
