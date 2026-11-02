/**
 * SCRIPT MIGRASI DATA DARI POCKETBASE KE SUPABASE
 * 
 * Aturan:
 * - Data yang sudah ada di Supabase akan otomatis dilewati (skip).
 * - Hanya data baru yang belum ada yang akan dimasukkan ke Supabase.
 * 
 * Cara Pakai:
 * Opsi A (Pakai file data.db PocketBase):
 *   1. Download file `pb_data/data.db` dari VPS PocketBase Anda.
 *   2. Taruh file `data.db` di folder project ini.
 *   3. Jalankan: node scripts/migrate_from_pb.cjs --file data.db
 * 
 * Opsi B (Pakai URL PocketBase langsung jika VPS menyala):
 *   1. Jalankan: node scripts/migrate_from_pb.cjs --url https://api.kalindoapp.my.id
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Target Supabase (Supabase Utama)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ldzsudeqrpmpjolpybsx.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkenN1ZGVxcnBtcGpvbHB5YnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2Mjg5NTksImV4cCI6MjEwOTIwNDk1OX0.4ZQW_0fW8QgZbHTy4zJoFK4RmnMmK6iagE6zHEVCDYg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateFromSqlite(dbFilePath) {
  console.log(`\n📂 Membaca database SQLite PocketBase: ${dbFilePath}`);
  if (!fs.existsSync(dbFilePath)) {
    console.error(`❌ File tidak ditemukan: ${dbFilePath}`);
    console.log(`Silakan salin file data.db dari folder pb_data di VPS ke folder ini.`);
    process.exit(1);
  }

  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbFilePath);

  // 1. Migrasi leader_scan_2
  try {
    console.log('\n--- 1. Migrasi leader_scan_2 ---');
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leader_scan_2'").get();
    if (tableExists) {
      const rows = db.prepare("SELECT * FROM leader_scan_2").all();
      console.log(`Ditemukan ${rows.length} data di PocketBase leader_scan_2.`);

      let inserted = 0;
      let skipped = 0;

      for (const row of rows) {
        // Cek apakah barcode sudah ada di Supabase
        const { data: existing } = await supabase
          .from('leader_scan_2')
          .select('id')
          .eq('barcode', row.barcode)
          .maybeSingle();

        if (existing) {
          skipped++;
        } else {
          // Format payload
          const payload = {
            barcode: row.barcode,
            assignment_mode: row.assignment_mode || 'INDIVIDU',
            assignees: typeof row.assignees === 'string' ? (row.assignees.startsWith('[') ? JSON.parse(row.assignees) : [row.assignees]) : (row.assignees || []),
            leader_name: row.leader_name || 'LEADER',
            status: row.status || 'ASSIGNED',
            timestamp: row.timestamp || Date.now(),
            scan_type: row.scan_type || 'PRETELAN',
            leader_profile: row.leader_profile || row.leader_name || 'LEADER',
            date: row.date || new Date().toLocaleDateString('id-ID')
          };

          const { error } = await supabase.from('leader_scan_2').insert([payload]);
          if (!error) inserted++;
          else console.warn(`Gagal insert ${row.barcode}:`, error.message);
        }
      }
      console.log(`✅ leader_scan_2: Disisipkan = ${inserted}, Dilewati (sudah ada) = ${skipped}`);
    } else {
      console.log('Tabel leader_scan_2 tidak ada di file SQLite.');
    }
  } catch (err) {
    console.error('Error saat migrasi leader_scan_2:', err.message);
  }

  // 2. Migrasi scanned_items
  try {
    console.log('\n--- 2. Migrasi scanned_items ---');
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scanned_items'").get();
    if (tableExists) {
      const rows = db.prepare("SELECT * FROM scanned_items").all();
      console.log(`Ditemukan ${rows.length} data di PocketBase scanned_items.`);

      let inserted = 0;
      let skipped = 0;

      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const barcodes = chunk.map(r => r.barcode);

        // Cek data yang sudah ada
        const { data: existingList } = await supabase
          .from('scanned_items')
          .select('barcode, role')
          .in('barcode', barcodes);

        const existingSet = new Set((existingList || []).map(x => `${x.barcode}___${x.role}`));
        const toInsert = [];

        for (const r of chunk) {
          const key = `${r.barcode}___${r.role}`;
          if (existingSet.has(key)) {
            skipped++;
          } else {
            toInsert.push({
              barcode: r.barcode,
              role: r.role || 'PACKING',
              employee_name: r.employee_name || r.user_name || 'Staf',
              timestamp: r.timestamp || Date.now(),
              created_at: r.created || r.created_at || new Date().toISOString(),
              destination: r.destination || '',
              description: r.description || '',
              status: r.status || 'COMPLETED',
              scan_date: r.scan_date || new Date().toISOString().split('T')[0],
              menu_context: r.menu_context || null
            });
            existingSet.add(key);
          }
        }

        if (toInsert.length > 0) {
          const { error } = await supabase.from('scanned_items').insert(toInsert);
          if (!error) {
            inserted += toInsert.length;
          } else {
            console.warn('Chunk insert warning:', error.message);
          }
        }
      }
      console.log(`✅ scanned_items: Disisipkan = ${inserted}, Dilewati (sudah ada) = ${skipped}`);
    } else {
      console.log('Tabel scanned_items tidak ada di file SQLite.');
    }
  } catch (err) {
    console.error('Error saat migrasi scanned_items:', err.message);
  }

  console.log('\n🎉 Selesai proses migrasi!');
}

// Entrypoint
const args = process.argv.slice(2);
const fileArgIdx = args.indexOf('--file');
const dbFile = fileArgIdx !== -1 ? args[fileArgIdx + 1] : (fs.existsSync('data.db') ? 'data.db' : null);

if (dbFile) {
  migrateFromSqlite(dbFile);
} else {
  console.log('Gunakan: node scripts/migrate_from_pb.cjs --file path/to/data.db');
}

