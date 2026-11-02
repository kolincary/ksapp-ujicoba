import React, { useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import {
   Search,
   Wrench,
   Sparkles,
   CheckCircle2,
   AlertCircle,
   ArrowRight,
   Copy,
   Download,
   RefreshCw,
   Layers,
   Database,
   FileText,
   Check,
   Calendar,
   Filter,
   Loader2,
   ShieldAlert,
   Eye,
   CheckSquare,
   Square,
   MinusCircle,
   PlusCircle,
   Trash2
} from 'lucide-react';

interface ResiFormatterViewProps {
   isDarkMode?: boolean;
}

interface FoundBarcodeItem {
   id: string;
   table: 'scanned_items' | 'batch_items' | 'admin_batch_imports';
   originalBarcode: string;
   formattedBarcode: string;
   role?: string;
   employee_name?: string;
   timestamp?: number | string;
   order_id?: string | null;
   excel_filename?: string | null;
   firestoreDocId?: string;
   firestoreIndex?: number;
   selected: boolean;
   status?: 'PENDING' | 'SUCCESS' | 'ERROR';
   errorMsg?: string;
}

// Prefixes that SHOULD have hyphen formatting
const FORMAT_PREFIXES = ['LXAD', 'JNEB', 'JNAP'];

// Common prefixes that should NOT have hyphens (for quick un-strip cleanup)
const UNSTRIP_PREFIXES = ['SPXID', 'CM', 'GTL', 'JP', 'TKP', 'SAP'];

export const ResiFormatterView: React.FC<ResiFormatterViewProps> = ({ isDarkMode = false }) => {
   const [activeTab, setActiveTab] = useState<'DATABASE' | 'TEXT_FORMAT'>('DATABASE');

   // ----------------------------------------------------
   // TAB 1: DATABASE SEARCH & UPDATE STATE
   // ----------------------------------------------------
   const [operationMode, setOperationMode] = useState<'ADD_HYPHEN' | 'REMOVE_HYPHEN'>('ADD_HYPHEN');
   const [searchPrefix, setSearchPrefix] = useState('LXAD');
   const [customPrefix, setCustomPrefix] = useState('');
   const [targetTables, setTargetTables] = useState<{ scanned: boolean; batch: boolean; adminImports: boolean }>({
      scanned: true,
      batch: true,
      adminImports: true
   });
   const [dateFilterType, setDateFilterType] = useState<'ALL' | 'TODAY' | '7_DAYS' | 'CUSTOM'>('ALL');
   const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
   const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
   const [limitCount, setLimitCount] = useState<number>(500);

   const [isSearching, setIsSearching] = useState(false);
   const [hasSearched, setHasSearched] = useState(false);
   const [foundItems, setFoundItems] = useState<FoundBarcodeItem[]>([]);
   const [tableFilterText, setTableFilterText] = useState('');

   // Processing / Execution State
   const [isExecuting, setIsExecuting] = useState(false);
   const [execProgress, setExecProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
   const [execLogs, setExecLogs] = useState<{ time: string; msg: string; type: 'success' | 'error' | 'info' }[]>([]);

   // ----------------------------------------------------
   // TAB 2: TEXT FORMATTER STATE
   // ----------------------------------------------------
   const [textMode, setTextMode] = useState<'ADD_HYPHEN' | 'REMOVE_HYPHEN'>('ADD_HYPHEN');
   const [rawTextInput, setRawTextInput] = useState('');
   const [textPrefix, setTextPrefix] = useState('LXAD');
   const [autoDetectPrefix, setAutoDetectPrefix] = useState(true);
   const [copiedToast, setCopiedToast] = useState(false);

   // Effective active prefix
   const effectivePrefix = (customPrefix.trim() ? customPrefix.trim().toUpperCase() : searchPrefix).trim().toUpperCase();

   // Helper to format a barcode with prefix (ADD HYPHEN)
   const formatBarcodeWithPrefix = (barcode: string, prefix: string): string => {
      const clean = barcode.replace(/@/g, '').trim().toUpperCase();
      if (!prefix) return clean;

      const p = prefix.toUpperCase();
      // If already has prefix with hyphen (e.g., LXAD-12345), do not change
      if (clean.startsWith(`${p}-`)) {
         return clean;
      }
      // If starts with prefix without hyphen (e.g., LXAD12345)
      if (clean.startsWith(p)) {
         const rest = clean.slice(p.length);
         // If there's content after prefix and it doesn't already start with hyphen
         if (rest.length > 0 && !rest.startsWith('-')) {
            return `${p}-${rest}`;
         }
      }
      return clean;
   };

   // Helper to remove hyphen from barcode given a prefix or general hyphen
   const removeHyphenFromBarcode = (barcode: string, prefix: string): string => {
      const clean = barcode.replace(/@/g, '').trim().toUpperCase();
      if (!clean) return '';
      if (!prefix) {
         // If no prefix specified, remove first hyphen
         return clean.replace('-', '');
      }

      const p = prefix.toUpperCase();
      if (clean.startsWith(`${p}-`)) {
         return `${p}${clean.slice(p.length + 1)}`;
      }
      return clean;
   };

   // ----------------------------------------------------
   // SEARCH IN DATABASE (Supabase & Firestore)
   // ----------------------------------------------------
   const handleSearchDatabase = async () => {
      if (!effectivePrefix) {
         alert('Silakan pilih atau ketik kata kunci/prefix yang ingin dicari.');
         return;
      }

      setIsSearching(true);
      setHasSearched(true);
      setFoundItems([]);
      setExecLogs([]);

      const items: FoundBarcodeItem[] = [];

      try {
         // 1. Search in scanned_items (Use .like for fast index scans)
         if (targetTables.scanned) {
            const searchPattern = operationMode === 'ADD_HYPHEN' 
               ? `${effectivePrefix}%` 
               : `${effectivePrefix}-%`;

            let query = supabase
               .from('scanned_items')
               .select('id, barcode, role, employee_name, timestamp, order_id, excel_filename')
               .like('barcode', searchPattern)
               .limit(limitCount);

            if (dateFilterType === 'TODAY') {
               const todayStart = new Date();
               todayStart.setHours(0, 0, 0, 0);
               query = query.gte('timestamp', todayStart.getTime());
            } else if (dateFilterType === '7_DAYS') {
               const sevenDaysAgo = new Date();
               sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
               sevenDaysAgo.setHours(0, 0, 0, 0);
               query = query.gte('timestamp', sevenDaysAgo.getTime());
            } else if (dateFilterType === 'CUSTOM' && startDate && endDate) {
               const s = new Date(`${startDate}T00:00:00`).getTime();
               const e = new Date(`${endDate}T23:59:59.999`).getTime();
               query = query.gte('timestamp', s).lte('timestamp', e);
            }

            const { data: scannedData, error: scannedErr } = await query;
            if (scannedErr) {
               console.error('Error fetching scanned_items:', scannedErr);
               if (scannedErr.code === '57014') {
                  alert(`Pencarian scanned_items timeout karena tabel memiliki data banyak.\nSaran: Pilih filter tanggal 'Hari Ini' atau '7 Hari Terakhir'.`);
               }
            } else if (scannedData) {
               for (const row of scannedData) {
                  const rawBc = (row.barcode || '').trim().toUpperCase();
                  if (operationMode === 'ADD_HYPHEN') {
                     if (rawBc.startsWith(effectivePrefix) && !rawBc.startsWith(`${effectivePrefix}-`)) {
                        const formatted = formatBarcodeWithPrefix(rawBc, effectivePrefix);
                        if (formatted !== rawBc) {
                           items.push({
                              id: String(row.id),
                              table: 'scanned_items',
                              originalBarcode: rawBc,
                              formattedBarcode: formatted,
                              role: row.role,
                              employee_name: row.employee_name,
                              timestamp: row.timestamp,
                              order_id: row.order_id,
                              excel_filename: row.excel_filename,
                              selected: true,
                              status: 'PENDING'
                           });
                        }
                     }
                  } else {
                     // REMOVE_HYPHEN mode
                     if (rawBc.startsWith(`${effectivePrefix}-`)) {
                        const formatted = removeHyphenFromBarcode(rawBc, effectivePrefix);
                        if (formatted !== rawBc) {
                           items.push({
                              id: String(row.id),
                              table: 'scanned_items',
                              originalBarcode: rawBc,
                              formattedBarcode: formatted,
                              role: row.role,
                              employee_name: row.employee_name,
                              timestamp: row.timestamp,
                              order_id: row.order_id,
                              excel_filename: row.excel_filename,
                              selected: true,
                              status: 'PENDING'
                           });
                        }
                     }
                  }
               }
            }
         }

         // 2. Search in batch_items (Use .like for fast index scans)
         if (targetTables.batch) {
            const searchPattern = operationMode === 'ADD_HYPHEN' 
               ? `${effectivePrefix}%` 
               : `${effectivePrefix}-%`;

            let bQuery = supabase
               .from('batch_items')
               .select('id, barcode, order_id, created_at')
               .like('barcode', searchPattern)
               .limit(limitCount);

            if (dateFilterType === 'TODAY') {
               const todayStart = new Date().toISOString().split('T')[0];
               bQuery = bQuery.gte('created_at', `${todayStart}T00:00:00`);
            } else if (dateFilterType === '7_DAYS') {
               const sevenDaysAgo = new Date();
               sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
               bQuery = bQuery.gte('created_at', sevenDaysAgo.toISOString());
            } else if (dateFilterType === 'CUSTOM' && startDate && endDate) {
               bQuery = bQuery.gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59.999`);
            }

            const { data: batchData, error: batchErr } = await bQuery;
            if (batchErr) {
               console.error('Error fetching batch_items:', batchErr);
            } else if (batchData) {
               for (const row of batchData) {
                  const rawBc = (row.barcode || '').trim().toUpperCase();
                  if (operationMode === 'ADD_HYPHEN') {
                     if (rawBc.startsWith(effectivePrefix) && !rawBc.startsWith(`${effectivePrefix}-`)) {
                        const formatted = formatBarcodeWithPrefix(rawBc, effectivePrefix);
                        if (formatted !== rawBc) {
                           items.push({
                              id: String(row.id),
                              table: 'batch_items',
                              originalBarcode: rawBc,
                              formattedBarcode: formatted,
                              role: 'BATCH',
                              timestamp: row.created_at,
                              order_id: row.order_id,
                              selected: true,
                              status: 'PENDING'
                           });
                        }
                     }
                  } else {
                     // REMOVE_HYPHEN mode
                     if (rawBc.startsWith(`${effectivePrefix}-`)) {
                        const formatted = removeHyphenFromBarcode(rawBc, effectivePrefix);
                        if (formatted !== rawBc) {
                           items.push({
                              id: String(row.id),
                              table: 'batch_items',
                              originalBarcode: rawBc,
                              formattedBarcode: formatted,
                              role: 'BATCH',
                              timestamp: row.created_at,
                              order_id: row.order_id,
                              selected: true,
                              status: 'PENDING'
                           });
                        }
                     }
                  }
               }
            }
         }

         // 3. Search in Firestore admin_batch_imports (Admin Batches)
         if (targetTables.adminImports) {
            try {
               const { db } = await import('../services/firebaseClient');
               const { collection, getDocs, query: fsQuery, orderBy, limit: fsLimit } = await import('firebase/firestore');

               let snap;
               try {
                  snap = await getDocs(fsQuery(collection(db, 'admin_batch_imports'), orderBy('timestamp', 'desc'), fsLimit(300)));
               } catch (queryErr) {
                  snap = await getDocs(collection(db, 'admin_batch_imports'));
               }

               const todayStr = new Date().toISOString().slice(0, 10);
               const sevenDaysAgo = new Date();
               sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
               const sevenDaysStr = sevenDaysAgo.toISOString().slice(0, 10);

               for (const docSnap of snap.docs) {
                  const d = docSnap.data();
                  const docDateStr = (d.timestamp || d.createdAt || '').toString().slice(0, 10);

                  if (dateFilterType === 'TODAY' && docDateStr && docDateStr !== todayStr) {
                     continue;
                  } else if (dateFilterType === '7_DAYS' && docDateStr && docDateStr < sevenDaysStr) {
                     continue;
                  } else if (dateFilterType === 'CUSTOM' && startDate && endDate && docDateStr) {
                     if (docDateStr < startDate || docDateStr > endDate) continue;
                  }

                  if (Array.isArray(d.barcodes)) {
                     d.barcodes.forEach((bc: string, idx: number) => {
                        const rawBc = (bc || '').toString().replace(/@/g, '').trim().toUpperCase();
                        if (operationMode === 'ADD_HYPHEN') {
                           if (rawBc.startsWith(effectivePrefix) && !rawBc.startsWith(`${effectivePrefix}-`)) {
                              const formatted = formatBarcodeWithPrefix(rawBc, effectivePrefix);
                              if (formatted !== rawBc) {
                                 items.push({
                                    id: `${docSnap.id}_${idx}`,
                                    table: 'admin_batch_imports',
                                    firestoreDocId: docSnap.id,
                                    firestoreIndex: idx,
                                    originalBarcode: rawBc,
                                    formattedBarcode: formatted,
                                    role: 'ADMIN BATCH',
                                    employee_name: d.staffName || 'Admin',
                                    timestamp: d.timestamp || d.createdAt,
                                    excel_filename: d.excelFilename || d.batchId,
                                    order_id: d.batchId,
                                    selected: true,
                                    status: 'PENDING'
                                 });
                              }
                           }
                        } else {
                           // REMOVE_HYPHEN mode
                           if (rawBc.startsWith(`${effectivePrefix}-`)) {
                              const formatted = removeHyphenFromBarcode(rawBc, effectivePrefix);
                              if (formatted !== rawBc) {
                                 items.push({
                                    id: `${docSnap.id}_${idx}`,
                                    table: 'admin_batch_imports',
                                    firestoreDocId: docSnap.id,
                                    firestoreIndex: idx,
                                    originalBarcode: rawBc,
                                    formattedBarcode: formatted,
                                    role: 'ADMIN BATCH',
                                    employee_name: d.staffName || 'Admin',
                                    timestamp: d.timestamp || d.createdAt,
                                    excel_filename: d.excelFilename || d.batchId,
                                    order_id: d.batchId,
                                    selected: true,
                                    status: 'PENDING'
                                 });
                              }
                           }
                        }
                     });
                  }
               }
            } catch (fsErr: any) {
               console.error('Error searching admin_batch_imports in Firestore:', fsErr);
            }
         }

         setFoundItems(items);
      } catch (err: any) {
         console.error('Search error:', err);
         alert(`Gagal melakukan pencarian: ${err.message}`);
      } finally {
         setIsSearching(false);
      }
   };

   // ----------------------------------------------------
   // TOGGLE SELECTION
   // ----------------------------------------------------
   const toggleSelectItem = (id: string, table: 'scanned_items' | 'batch_items' | 'admin_batch_imports') => {
      setFoundItems(prev =>
         prev.map(item => (item.id === id && item.table === table ? { ...item, selected: !item.selected } : item))
      );
   };

   const toggleSelectAll = () => {
      const allSelected = foundItems.every(i => i.selected);
      setFoundItems(prev => prev.map(item => ({ ...item, selected: !allSelected })));
   };

   const selectedCount = useMemo(() => foundItems.filter(i => i.selected).length, [foundItems]);

   // Filtered preview items based on local search box
   const displayedItems = useMemo(() => {
      if (!tableFilterText.trim()) return foundItems;
      const q = tableFilterText.toLowerCase();
      return foundItems.filter(
         i =>
            i.originalBarcode.toLowerCase().includes(q) ||
            i.formattedBarcode.toLowerCase().includes(q) ||
            (i.employee_name || '').toLowerCase().includes(q) ||
            (i.role || '').toLowerCase().includes(q) ||
            (i.order_id || '').toLowerCase().includes(q)
      );
   }, [foundItems, tableFilterText]);

   // ----------------------------------------------------
   // MASS UPDATE EXECUTION
   // ----------------------------------------------------
   const handleExecuteMassUpdate = async () => {
      const itemsToUpdate = foundItems.filter(i => i.selected && i.status !== 'SUCCESS');
      if (itemsToUpdate.length === 0) {
         alert('Tidak ada item yang dipilih untuk diproses.');
         return;
      }

      const actionTitle = operationMode === 'ADD_HYPHEN' ? 'Tambah Strip (-)' : 'Hapus Strip / Normalisasi Resi';
      const confirmMsg = `Konfirmasi ${actionTitle} Massal:
- Mode Operasi: ${operationMode === 'ADD_HYPHEN' ? 'Tambah Strip (-)' : 'Hapus Strip (-)'}
- Kata Kunci / Prefix: "${effectivePrefix}"
- Contoh Perubahan: ${itemsToUpdate[0]?.originalBarcode} → ${itemsToUpdate[0]?.formattedBarcode}
- Total Data yang akan Diubah: ${itemsToUpdate.length} baris

Perubahan akan diterapkan pada database Supabase (scanned_items, batch_items) serta Firestore (admin_batch_imports).

Apakah Anda yakin ingin melanjutkan?`;

      if (!window.confirm(confirmMsg)) {
         return;
      }

      setIsExecuting(true);
      setExecProgress({ current: 0, total: itemsToUpdate.length, success: 0, failed: 0 });

      let successCount = 0;
      let failedCount = 0;

      const addLog = (msg: string, type: 'success' | 'error' | 'info') => {
         const time = new Date().toLocaleTimeString('id-ID');
         setExecLogs(prev => [{ time, msg, type }, ...prev.slice(0, 100)]);
      };

      addLog(`Memulai proses update ${itemsToUpdate.length} data (${actionTitle})...`, 'info');

      // 1. Separate Supabase items and Firestore items
      const supabaseItems = itemsToUpdate.filter(i => i.table === 'scanned_items' || i.table === 'batch_items');
      const firestoreItems = itemsToUpdate.filter(i => i.table === 'admin_batch_imports');

      // Process Supabase in small parallel chunks
      const CHUNK_SIZE = 25;
      for (let i = 0; i < supabaseItems.length; i += CHUNK_SIZE) {
         const chunk = supabaseItems.slice(i, i + CHUNK_SIZE);

         await Promise.all(
            chunk.map(async item => {
               try {
                  const { error } = await supabase
                     .from(item.table)
                     .update({ barcode: item.formattedBarcode })
                     .eq('id', item.id);

                  if (error) throw error;

                  successCount++;
                  setFoundItems(prev =>
                     prev.map(it => (it.id === item.id && it.table === item.table ? { ...it, status: 'SUCCESS' } : it))
                  );
               } catch (err: any) {
                  failedCount++;
                  console.error(`Failed to update ${item.table} id ${item.id}:`, err);
                  setFoundItems(prev =>
                     prev.map(it =>
                        it.id === item.id && it.table === item.table
                           ? { ...it, status: 'ERROR', errorMsg: err.message || 'Update failed' }
                           : it
                     )
                  );
                  addLog(`Gagal ubah ${item.originalBarcode} (${item.table}): ${err.message}`, 'error');
               }
            })
         );

         setExecProgress({
            current: Math.min(i + CHUNK_SIZE, itemsToUpdate.length),
            total: itemsToUpdate.length,
            success: successCount,
            failed: failedCount
         });
      }

      // 2. Process Firestore admin_batch_imports (Group by Document ID for efficient updates)
      const barcodeMapping = new Map<string, string>();
      itemsToUpdate.forEach(item => {
         barcodeMapping.set(item.originalBarcode, item.formattedBarcode);
      });

      try {
         const { db } = await import('../services/firebaseClient');
         const { collection, getDocs, doc, getDoc, updateDoc } = await import('firebase/firestore');

         if (firestoreItems.length > 0) {
            const byDocId = new Map<string, { [origBc: string]: string }>();
            firestoreItems.forEach(it => {
               if (!it.firestoreDocId) return;
               if (!byDocId.has(it.firestoreDocId)) {
                  byDocId.set(it.firestoreDocId, {});
               }
               byDocId.get(it.firestoreDocId)![it.originalBarcode] = it.formattedBarcode;
            });

            for (const [docId, replaceMap] of byDocId.entries()) {
               try {
                  const docRef = doc(db, 'admin_batch_imports', docId);
                  const snap = await getDoc(docRef);
                  if (snap.exists()) {
                     const data = snap.data();
                     if (Array.isArray(data.barcodes)) {
                        const updated = data.barcodes.map((b: string) => {
                           const upper = (b || '').trim().toUpperCase();
                           return replaceMap[upper] || b;
                        });
                        await updateDoc(docRef, { barcodes: updated });
                     }
                  }
                  firestoreItems.filter(i => i.firestoreDocId === docId).forEach(it => {
                     setFoundItems(prev => prev.map(p => (p.id === it.id ? { ...p, status: 'SUCCESS' } : p)));
                     successCount++;
                  });
                  addLog(`Berhasil update ${Object.keys(replaceMap).length} resi di Firestore batch (${docId})`, 'success');
               } catch (fsErr: any) {
                  failedCount += firestoreItems.filter(i => i.firestoreDocId === docId).length;
                  addLog(`Gagal update Firestore doc ${docId}: ${fsErr.message}`, 'error');
               }
            }
         }

         // Cross-sync to Firestore admin_batch_imports
         if (barcodeMapping.size > 0 && firestoreItems.length === 0) {
            const fsSnap = await getDocs(collection(db, 'admin_batch_imports'));
            for (const docSnap of fsSnap.docs) {
               const data = docSnap.data();
               if (Array.isArray(data.barcodes)) {
                  let changed = false;
                  const updatedBarcodes = data.barcodes.map((bc: string) => {
                     const clean = (bc || '').toString().trim().toUpperCase();
                     if (barcodeMapping.has(clean)) {
                        changed = true;
                        return barcodeMapping.get(clean)!;
                     }
                     return bc;
                  });

                  if (changed) {
                     await updateDoc(doc(db, 'admin_batch_imports', docSnap.id), {
                        barcodes: updatedBarcodes
                     });
                     addLog(`Tersinkronisasi ke Firestore Admin Batch (${docSnap.data().excelFilename || docSnap.id})`, 'info');
                  }
               }
            }
         }
      } catch (fsCrossErr: any) {
         console.warn('Cross sync to Firestore failed:', fsCrossErr);
      }

      setExecProgress({
         current: itemsToUpdate.length,
         total: itemsToUpdate.length,
         success: successCount,
         failed: failedCount
      });

      addLog(`Proses selesai: ${successCount} berhasil, ${failedCount} gagal.`, successCount > 0 ? 'success' : 'error');
      setIsExecuting(false);
      alert(`Selesai memproses!\n- Berhasil: ${successCount}\n- Gagal: ${failedCount}`);
   };

   // ----------------------------------------------------
   // EXPORT PREVIEW CSV
   // ----------------------------------------------------
   const handleExportPreviewCsv = () => {
      if (foundItems.length === 0) {
         alert('Tidak ada data untuk diexport.');
         return;
      }

      const headers = ['No', 'Tabel', 'Barcode Asli', 'Barcode Baru', 'ID Pesanan', 'Role', 'Employee', 'Waktu'];
      const rows = foundItems.map((item, idx) => {
         const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID').replace(/,/g, '') : '-';
         return [
            idx + 1,
            item.table,
            `=""${item.originalBarcode}""`,
            `=""${item.formattedBarcode}""`,
            `=""${item.order_id || ''}""`,
            item.role || '-',
            item.employee_name || '-',
            timeStr
         ].join(',');
      });

      const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Preview_Resi_${operationMode}_${effectivePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
   };

   // ----------------------------------------------------
   // TAB 2: TEXT FORMATTER CONVERSION
   // ----------------------------------------------------
   const convertedTextResult = useMemo(() => {
      if (!rawTextInput.trim()) return { lines: [], text: '' };

      const lines = rawTextInput.split(/[\r\n,;]+/);
      const outputLines: string[] = [];

      for (const line of lines) {
         const trimmed = line.replace(/@/g, '').trim();
         if (!trimmed) continue;

         let formatted = trimmed;

         if (textMode === 'ADD_HYPHEN') {
            if (autoDetectPrefix) {
               // Only format known valid prefixes: LXAD, JNEB, JNAP
               let matched = false;
               for (const p of FORMAT_PREFIXES) {
                  if (trimmed.toUpperCase().startsWith(p) && !trimmed.toUpperCase().startsWith(`${p}-`)) {
                     formatted = formatBarcodeWithPrefix(trimmed, p);
                     matched = true;
                     break;
                  }
               }
               if (!matched && textPrefix.trim()) {
                  formatted = formatBarcodeWithPrefix(trimmed, textPrefix.trim().toUpperCase());
               }
            } else if (textPrefix.trim()) {
               formatted = formatBarcodeWithPrefix(trimmed, textPrefix.trim().toUpperCase());
            }
         } else {
            // REMOVE_HYPHEN mode
            if (autoDetectPrefix) {
               // Remove hyphen if present in any prefix
               formatted = trimmed.replace(/^([A-Z0-9]+)-/i, '$1');
            } else if (textPrefix.trim()) {
               formatted = removeHyphenFromBarcode(trimmed, textPrefix.trim().toUpperCase());
            } else {
               formatted = trimmed.replace(/-/g, '');
            }
         }

         outputLines.push(formatted);
      }

      return {
         lines: outputLines,
         text: outputLines.join('\n')
      };
   }, [rawTextInput, textPrefix, autoDetectPrefix, textMode]);

   const handleCopyConverted = () => {
      if (!convertedTextResult.text) return;
      navigator.clipboard.writeText(convertedTextResult.text);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
   };

   const handleDownloadConverted = (format: 'txt' | 'csv') => {
      if (!convertedTextResult.text) return;

      let content = convertedTextResult.text;
      let mime = 'text/plain;charset=utf-8;';
      let ext = 'txt';

      if (format === 'csv') {
         content = '\uFEFFBarcode\n' + convertedTextResult.lines.map(l => `=""${l}""`).join('\n');
         mime = 'text/csv;charset=utf-8;';
         ext = 'csv';
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Formatted_Barcodes_${new Date().toISOString().slice(0, 10)}.${ext}`;
      link.click();
   };

   return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
         {/* Top Header Card */}
         <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
               <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide">
                     <Wrench size={14} className="animate-spin-slow" />
                     <span>TOOL RESI & PREFIX FORMATTER</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Format Resi & Manajemen Strip Barcode</h1>
                  <p className="text-blue-100 text-sm max-w-2xl">
                     Atur penambahan tanda strip (<code className="bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold">LXAD-</code>, <code className="bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold">JNEB-</code>, <code className="bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold">JNAP-</code>) atau bersihkan tanda strip yang tidak diinginkan (<code className="bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold">SPXID-</code> → <code className="bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold">SPXID</code>) langsung di database Supabase/Firestore atau teks massal.
                  </p>
               </div>

               {/* Tab Switcher in Header */}
               <div className="flex bg-black/20 p-1.5 rounded-2xl backdrop-blur-md shrink-0 self-start md:self-center border border-white/10">
                  <button
                     onClick={() => setActiveTab('DATABASE')}
                     className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'DATABASE'
                           ? 'bg-white text-indigo-700 shadow-md scale-102'
                           : 'text-white/80 hover:text-white hover:bg-white/10'
                     }`}
                  >
                     <Database size={16} />
                     <span>Database Mass Update</span>
                  </button>
                  <button
                     onClick={() => setActiveTab('TEXT_FORMAT')}
                     className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'TEXT_FORMAT'
                           ? 'bg-white text-indigo-700 shadow-md scale-102'
                           : 'text-white/80 hover:text-white hover:bg-white/10'
                     }`}
                  >
                     <Sparkles size={16} />
                     <span>Quick Text Formatter</span>
                  </button>
               </div>
            </div>
         </div>

         {/* ========================================================================= */}
         {/* TAB 1: DATABASE MASS UPDATE */}
         {/* ========================================================================= */}
         {activeTab === 'DATABASE' && (
            <div className="space-y-6">
               {/* Controls & Search Filter Box */}
               <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
                  {/* Mode Operasi Selector */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700">
                     <div>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mode Operasi Database:</div>
                        <div className="text-sm font-extrabold text-gray-900 dark:text-white">
                           {operationMode === 'ADD_HYPHEN' ? 'Tambah Strip (-) Pada Resi' : 'Hapus Strip (-) / Pembersih Resi'}
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button
                           type="button"
                           onClick={() => {
                              setOperationMode('ADD_HYPHEN');
                              setSearchPrefix('LXAD');
                              setCustomPrefix('');
                              setFoundItems([]);
                              setHasSearched(false);
                           }}
                           className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              operationMode === 'ADD_HYPHEN'
                                 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                 : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100'
                           }`}
                        >
                           <PlusCircle size={15} />
                           <span>Tambah Strip (LXAD, JNEB, JNAP)</span>
                        </button>
                        <button
                           type="button"
                           onClick={() => {
                              setOperationMode('REMOVE_HYPHEN');
                              setSearchPrefix('SPXID');
                              setCustomPrefix('');
                              setFoundItems([]);
                              setHasSearched(false);
                           }}
                           className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              operationMode === 'REMOVE_HYPHEN'
                                 ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                                 : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100'
                           }`}
                        >
                           <MinusCircle size={15} />
                           <span>Hapus Strip (SPXID-, CM-, dll.)</span>
                        </button>
                     </div>
                  </div>

                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-4">
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                           1
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                           {operationMode === 'ADD_HYPHEN' ? 'Pilih Prefix Target Tambah Strip' : 'Pilih Prefix Target Hapus Strip'}
                        </h2>
                     </div>
                     <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Hasil: <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                           {operationMode === 'ADD_HYPHEN'
                              ? (effectivePrefix ? `${effectivePrefix}XXXXX → ${effectivePrefix}-XXXXX` : '-')
                              : (effectivePrefix ? `${effectivePrefix}-XXXXX → ${effectivePrefix}XXXXX` : '-')}
                        </span>
                     </span>
                  </div>

                  {/* Prefix Preset Buttons & Custom Input */}
                  <div className="space-y-3">
                     <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        {operationMode === 'ADD_HYPHEN' ? 'Prefix Standar Ber-Strip:' : 'Prefix Umum untuk Dibersihkan Stripnya:'}
                     </label>
                     <div className="flex flex-wrap items-center gap-2">
                        {(operationMode === 'ADD_HYPHEN' ? FORMAT_PREFIXES : UNSTRIP_PREFIXES).map(p => (
                           <button
                              key={p}
                              type="button"
                              onClick={() => {
                                 setSearchPrefix(p);
                                 setCustomPrefix('');
                              }}
                              className={`px-3.5 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold border transition-all ${
                                 searchPrefix === p && !customPrefix
                                    ? operationMode === 'ADD_HYPHEN'
                                       ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 scale-105'
                                       : 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20 scale-105'
                                    : 'bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                           >
                              {p}
                           </button>
                        ))}

                        <div className="flex items-center gap-2 ml-auto">
                           <span className="text-xs text-gray-400">atau custom:</span>
                           <input
                              type="text"
                              value={customPrefix}
                              onChange={e => setCustomPrefix(e.target.value.toUpperCase())}
                              placeholder="Ketik prefix lain..."
                              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-mono font-bold bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white uppercase focus:ring-2 focus:ring-blue-500 outline-hidden w-36"
                           />
                        </div>
                     </div>
                  </div>

                  {/* Advanced Filters: Target Tables, Date Filter, Limits */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                     {/* Target Tables */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                           <Layers size={14} />
                           Target Tabel Database:
                        </label>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-2xl border border-gray-200 dark:border-gray-700">
                           <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                              <input
                                 type="checkbox"
                                 checked={targetTables.scanned}
                                 onChange={e => setTargetTables(prev => ({ ...prev, scanned: e.target.checked }))}
                                 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>scanned_items</span>
                           </label>
                           <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                              <input
                                 type="checkbox"
                                 checked={targetTables.batch}
                                 onChange={e => setTargetTables(prev => ({ ...prev, batch: e.target.checked }))}
                                 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>batch_items</span>
                           </label>
                           <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                              <input
                                 type="checkbox"
                                 checked={targetTables.adminImports}
                                 onChange={e => setTargetTables(prev => ({ ...prev, adminImports: e.target.checked }))}
                                 className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                              <span className="text-purple-600 dark:text-purple-400 font-bold">Admin Batches (Firestore)</span>
                           </label>
                        </div>
                     </div>

                     {/* Date Filter */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                           <Calendar size={14} />
                           Filter Tanggal:
                        </label>
                        <select
                           value={dateFilterType}
                           onChange={e => setDateFilterType(e.target.value as any)}
                           className="w-full px-3 py-2 rounded-2xl text-xs sm:text-sm font-semibold bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                        >
                           <option value="ALL">Semua Waktu (Data Lengkap)</option>
                           <option value="TODAY">Hanya Hari Ini</option>
                           <option value="7_DAYS">7 Hari Terakhir</option>
                           <option value="CUSTOM">Rentang Tanggal Kustom...</option>
                        </select>
                     </div>

                     {/* Search Limits & Button */}
                     <div className="space-y-2 flex flex-col justify-end">
                        {dateFilterType === 'CUSTOM' ? (
                           <div className="flex items-center gap-2">
                              <input
                                 type="date"
                                 value={startDate}
                                 onChange={e => setStartDate(e.target.value)}
                                 className="w-1/2 px-2 py-1.5 rounded-xl text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                              />
                              <span className="text-xs text-gray-400">-</span>
                              <input
                                 type="date"
                                 value={endDate}
                                 onChange={e => setEndDate(e.target.value)}
                                 className="w-1/2 px-2 py-1.5 rounded-xl text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                              />
                           </div>
                        ) : (
                           <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>Maksimal baris:</span>
                              <select
                                 value={limitCount}
                                 onChange={e => setLimitCount(Number(e.target.value))}
                                 className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-bold"
                              >
                                 <option value={100}>100 baris</option>
                                 <option value={500}>500 baris</option>
                                 <option value={1000}>1.000 baris</option>
                                 <option value={5000}>5.000 baris</option>
                              </select>
                           </div>
                        )}

                        <button
                           onClick={handleSearchDatabase}
                           disabled={isSearching}
                           className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm text-white shadow-lg transition-all disabled:opacity-50 active:scale-98 ${
                              operationMode === 'ADD_HYPHEN'
                                 ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                                 : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25'
                           }`}
                        >
                           {isSearching ? (
                              <>
                                 <Loader2 size={16} className="animate-spin" />
                                 <span>Mencari di Database...</span>
                              </>
                           ) : (
                              <>
                                 <Search size={16} />
                                 <span>{operationMode === 'ADD_HYPHEN' ? 'Cari Resi Tanpa Strip' : 'Cari Resi Ber-Strip untuk Dibersihkan'}</span>
                              </>
                           )}
                        </button>
                     </div>
                  </div>
               </div>

               {/* Execution Progress Bar (if executing) */}
               {isExecuting && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-3xl p-5 space-y-3 animate-pulse">
                     <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-300">
                        <div className="flex items-center gap-2">
                           <Loader2 size={16} className="animate-spin text-indigo-600" />
                           <span>Sedang Memproses Update Massal ke Database...</span>
                        </div>
                        <span>
                           {execProgress.current} / {execProgress.total} (
                           {Math.round((execProgress.current / (execProgress.total || 1)) * 100)}%)
                        </span>
                     </div>
                     <div className="w-full h-3 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                        <div
                           className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
                           style={{
                              width: `${Math.round((execProgress.current / (execProgress.total || 1)) * 100)}%`
                           }}
                        />
                     </div>
                     <div className="flex items-center gap-4 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                        <span>Berhasil: {execProgress.success}</span>
                        <span>Gagal: {execProgress.failed}</span>
                     </div>
                  </div>
               )}

               {/* Results & Action Table */}
               {hasSearched && (
                  <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden space-y-4 p-6">
                     {/* Table Header & Action Controls */}
                     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                           <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                 Hasil Resi yang Ditemukan
                              </h3>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                                 operationMode === 'ADD_HYPHEN'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                              }`}>
                                 {foundItems.length} Data
                              </span>
                           </div>
                           <p className="text-xs text-gray-500 dark:text-gray-400">
                              Dipilih: <span className="font-bold text-blue-600 dark:text-blue-400">{selectedCount}</span> baris
                           </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                           {/* Quick search in table */}
                           <div className="relative flex-1 sm:flex-initial">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                 type="text"
                                 value={tableFilterText}
                                 onChange={e => setTableFilterText(e.target.value)}
                                 placeholder="Filter tabel..."
                                 className="w-full sm:w-44 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                              />
                           </div>

                           <button
                              type="button"
                              onClick={handleExportPreviewCsv}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1.5 transition-all"
                           >
                              <Download size={14} />
                              <span>Export Preview CSV</span>
                           </button>

                           <button
                              type="button"
                              onClick={handleExecuteMassUpdate}
                              disabled={isExecuting || selectedCount === 0}
                              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold text-white active:scale-98 shadow-md flex items-center gap-2 transition-all disabled:opacity-50 ${
                                 operationMode === 'ADD_HYPHEN'
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20'
                                    : 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 shadow-rose-500/20'
                              }`}
                           >
                              <Sparkles size={16} />
                              <span>{operationMode === 'ADD_HYPHEN' ? `Proses Tambah Strip (${selectedCount})` : `Proses Hapus Strip (${selectedCount})`}</span>
                           </button>
                        </div>
                     </div>

                     {/* Table Content */}
                     {foundItems.length === 0 ? (
                        <div className="text-center py-12 space-y-3 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                           <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                           <div className="space-y-1">
                              <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm sm:text-base">
                                 Tidak Ada Resi yang Perlu Diubah
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                 {operationMode === 'ADD_HYPHEN'
                                    ? `Semua resi dengan kata kunci "${effectivePrefix}" di database sudah memiliki strip atau tidak ada data yang cocok dengan filter tanggal ini.`
                                    : `Tidak ditemukan resi ber-strip dengan kata kunci "${effectivePrefix}-" di database untuk dibersihkan.`}
                              </p>
                           </div>
                        </div>
                     ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xs">
                           <div className="max-h-96 overflow-y-auto">
                              <table className="w-full text-left text-xs">
                                 <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 z-10">
                                    <tr>
                                       <th className="p-3 w-10 text-center">
                                          <button
                                             type="button"
                                             onClick={toggleSelectAll}
                                             className="text-gray-500 hover:text-blue-600"
                                          >
                                             {foundItems.every(i => i.selected) ? (
                                                <CheckSquare size={16} className="text-blue-600" />
                                             ) : (
                                                <Square size={16} />
                                             )}
                                          </button>
                                       </th>
                                       <th className="p-3">Tabel</th>
                                       <th className="p-3">Barcode Asli</th>
                                       <th className="p-3 text-center">→</th>
                                       <th className="p-3">Preview Barcode Baru</th>
                                       <th className="p-3">Role / Sumber</th>
                                       <th className="p-3">Karyawan</th>
                                       <th className="p-3">Waktu</th>
                                       <th className="p-3 text-center">Status</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 bg-white dark:bg-gray-800 font-medium">
                                    {displayedItems.map((item) => (
                                       <tr
                                          key={`${item.table}-${item.id}`}
                                          onClick={() => toggleSelectItem(item.id, item.table)}
                                          className={`hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors ${
                                             item.selected ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                                          }`}
                                       >
                                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                             <input
                                                type="checkbox"
                                                checked={item.selected}
                                                onChange={() => toggleSelectItem(item.id, item.table)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                             />
                                          </td>
                                          <td className="p-3">
                                             <span
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                                                   item.table === 'scanned_items'
                                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                      : item.table === 'batch_items'
                                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                                }`}
                                             >
                                                {item.table === 'admin_batch_imports' ? 'admin_batches' : item.table}
                                             </span>
                                          </td>
                                          <td className="p-3 font-mono font-bold text-red-600 dark:text-red-400">
                                             {item.originalBarcode}
                                          </td>
                                          <td className="p-3 text-center text-gray-400">
                                             <ArrowRight size={14} className="mx-auto" />
                                          </td>
                                          <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20">
                                             {item.formattedBarcode}
                                          </td>
                                          <td className="p-3 text-gray-600 dark:text-gray-300">
                                             {item.role || '-'}
                                          </td>
                                          <td className="p-3 text-gray-600 dark:text-gray-300">
                                             {item.employee_name || '-'}
                                          </td>
                                          <td className="p-3 text-gray-500 dark:text-gray-400 text-[11px]">
                                             {item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID') : '-'}
                                          </td>
                                          <td className="p-3 text-center">
                                             {item.status === 'SUCCESS' && (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                                                   <Check size={14} /> Berhasil
                                                </span>
                                             )}
                                             {item.status === 'ERROR' && (
                                                <span className="inline-flex items-center gap-1 text-red-600 font-bold text-[11px]" title={item.errorMsg}>
                                                   <AlertCircle size={14} /> Gagal
                                                </span>
                                             )}
                                             {item.status === 'PENDING' && (
                                                <span className="text-gray-400 text-[11px]">Siap</span>
                                             )}
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                     )}
                  </div>
               )}
            </div>
         )}

         {/* ========================================================================= */}
         {/* TAB 2: QUICK TEXT FORMATTER */}
         {/* ========================================================================= */}
         {activeTab === 'TEXT_FORMAT' && (
            <div className="space-y-4">
               {/* Mode Switcher for Text Formatter */}
               <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <span className="text-xs font-bold text-gray-500 uppercase">Aksi Format Teks:</span>
                  <div className="flex items-center gap-2">
                     <button
                        type="button"
                        onClick={() => setTextMode('ADD_HYPHEN')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                           textMode === 'ADD_HYPHEN'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                     >
                        <PlusCircle size={14} />
                        <span>Tambah Strip (LXAD, JNEB, JNAP)</span>
                     </button>
                     <button
                        type="button"
                        onClick={() => setTextMode('REMOVE_HYPHEN')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                           textMode === 'REMOVE_HYPHEN'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                     >
                        <MinusCircle size={14} />
                        <span>Hapus Strip (SPXID-, CM-, dll.)</span>
                     </button>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Input Panel */}
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4 flex flex-col">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                              1
                           </div>
                           <h2 className="text-base font-bold text-gray-900 dark:text-white">
                              Tempel Daftar Resi Mentah
                           </h2>
                        </div>
                        <span className="text-xs text-gray-500 font-semibold">
                           {rawTextInput.split(/[\r\n,;]+/).filter(l => l.trim()).length} Barcode Terdeteksi
                        </span>
                     </div>

                     {/* Mode & Prefix Controls */}
                     <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="flex items-center justify-between">
                           <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                              <input
                                 type="checkbox"
                                 checked={autoDetectPrefix}
                                 onChange={e => setAutoDetectPrefix(e.target.checked)}
                                 className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>
                                 {textMode === 'ADD_HYPHEN'
                                    ? `Otomatis Deteksi Prefix (${FORMAT_PREFIXES.join(', ')})`
                                    : 'Otomatis Bersihkan Semua Tanda Strip (-)'}
                              </span>
                           </label>
                        </div>

                        {!autoDetectPrefix && (
                           <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                              <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Prefix Manual:</span>
                              <input
                                 type="text"
                                 value={textPrefix}
                                 onChange={e => setTextPrefix(e.target.value.toUpperCase())}
                                 placeholder="LXAD"
                                 className="px-3 py-1 text-xs font-mono font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white uppercase w-28 outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                           </div>
                        )}
                     </div>

                     {/* Textarea */}
                     <textarea
                        value={rawTextInput}
                        onChange={e => setRawTextInput(e.target.value)}
                        rows={12}
                        placeholder={textMode === 'ADD_HYPHEN' 
                           ? `Tempel daftar resi di sini (pemisah Enter, Koma, atau Titik Koma)...\nContoh:\nLXAD5121467456\nJNEB2048327460\nJNAP1234567890` 
                           : `Tempel daftar resi yang memiliki strip di sini...\nContoh:\nSPXID-066536875668\nCM-1234567890`}
                        className="w-full flex-1 p-4 rounded-2xl font-mono text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                     />

                     {/* Clear button */}
                     {rawTextInput && (
                        <div className="flex justify-end">
                           <button
                              type="button"
                              onClick={() => setRawTextInput('')}
                              className="text-xs text-red-500 hover:text-red-700 font-semibold"
                           >
                              Kosongkan Input
                           </button>
                        </div>
                     )}
                  </div>

                  {/* Output Panel */}
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4 flex flex-col">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                              2
                           </div>
                           <h2 className="text-base font-bold text-gray-900 dark:text-white">
                              {textMode === 'ADD_HYPHEN' ? 'Hasil Terformat (Dengan Strip)' : 'Hasil Bersih (Tanpa Strip)'}
                           </h2>
                        </div>

                        <div className="flex items-center gap-2">
                           <button
                              type="button"
                              onClick={() => handleDownloadConverted('txt')}
                              disabled={!convertedTextResult.text}
                              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-bold transition-all disabled:opacity-40"
                              title="Download TXT"
                           >
                              <Download size={15} />
                           </button>
                           <button
                              type="button"
                              onClick={handleCopyConverted}
                              disabled={!convertedTextResult.text}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-40"
                           >
                              {copiedToast ? (
                                 <>
                                    <Check size={14} />
                                    <span>Tersalin!</span>
                                 </>
                              ) : (
                                 <>
                                    <Copy size={14} />
                                    <span>Copy Hasil</span>
                                 </>
                              )}
                           </button>
                        </div>
                     </div>

                     {/* Output Preview Area */}
                     <div className="relative flex-1">
                        <textarea
                           readOnly
                           value={convertedTextResult.text}
                           rows={12}
                           placeholder="Hasil konversi barcode akan muncul di sini..."
                           className="w-full h-full p-4 rounded-2xl font-mono text-xs bg-emerald-50/40 dark:bg-gray-900 border border-emerald-200 dark:border-gray-700 text-emerald-900 dark:text-emerald-300 outline-hidden resize-none font-bold select-all"
                        />
                     </div>

                     {/* Transfer to DB Search Tab */}
                     {convertedTextResult.lines.length > 0 && (
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                           <span className="text-xs text-gray-500 font-medium">
                              Total: <span className="font-bold text-emerald-600">{convertedTextResult.lines.length}</span> baris
                           </span>
                           <button
                              type="button"
                              onClick={() => {
                                 setActiveTab('DATABASE');
                              }}
                              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
                           >
                              <span>Buka Tab Database untuk Update Database</span>
                              <ArrowRight size={14} />
                           </button>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
