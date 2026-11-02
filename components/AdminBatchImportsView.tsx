import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebaseClient';
import { supabase } from '../services/supabaseClient';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { AdminUser } from '../types';
import { 
  Database, 
  Search, 
  RefreshCw, 
  Trash2, 
  Pencil, 
  X, 
  Save, 
  AlertCircle,
  Eye,
  Copy,
  Check,
  FileText,
  Layers,
  Users,
  UserCheck,
  LayoutGrid,
  SlidersHorizontal,
  FileSpreadsheet
} from 'lucide-react';

interface AdminBatchImportItem {
  id: string;
  excelFilename: string;
  staffName: string;
  jumlah: number;
  batchId: string;
  timestamp: string;
  createdAt: string;
  barcodes: string[];
  [key: string]: any;
}

interface AdminBatchImportsViewProps {
  currentAdmin?: AdminUser | null;
}

// Responsive Card Component for Mobile & Tablet Grid
const BatchImportCard = React.memo(({
  item,
  index,
  pickerName,
  isPrimaryAdmin,
  hasMatchedBarcode,
  onViewBarcodes,
  onEdit,
  onDelete,
  onCopyBatchId,
  formatDate
}: {
  item: AdminBatchImportItem;
  index: number;
  pickerName?: string;
  isPrimaryAdmin: boolean;
  hasMatchedBarcode?: boolean;
  onViewBarcodes: (item: AdminBatchImportItem) => void;
  onEdit: (item: AdminBatchImportItem) => void;
  onDelete: (id: string) => void;
  onCopyBatchId?: (batchId: string) => void;
  formatDate: (ts: string) => string;
}) => {
  const count = item.barcodes?.length || item.jumlah || 0;
  const staffInitial = (item.staffName || 'S').charAt(0).toUpperCase();
  const pickerInitial = (pickerName || 'P').charAt(0).toUpperCase();

  return (
    <div className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-3 shadow-sm hover:shadow-md ${
      hasMatchedBarcode 
        ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/40' 
        : 'bg-white dark:bg-gray-800 border-gray-200/80 dark:border-gray-700/80 hover:border-emerald-300 dark:hover:border-emerald-700'
    }`}>
      {/* Top Header: Index + Excel Filename + Barcode Match Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
            #{index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-gray-900 dark:text-white leading-tight break-all">
                {item.excelFilename || 'Tanpa Nama File'}
              </span>
              {hasMatchedBarcode && (
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[10px] font-black rounded-full border border-amber-300 dark:border-amber-700 animate-pulse">
                  RESI COCOK
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-400 font-mono mt-0.5 select-all truncate" title={item.id}>
              ID: {item.id}
            </div>
          </div>
        </div>

        {/* Action Eye / Resi Count button */}
        <button
          onClick={() => onViewBarcodes(item)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shrink-0 cursor-pointer shadow-2xs"
          title="Klik untuk melihat list resi barcode"
        >
          <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{count} Resi</span>
        </button>
      </div>

      {/* Batch ID Banner */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate font-mono">
            {item.batchId || '-'}
          </span>
        </div>
        {item.batchId && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(item.batchId);
              if (onCopyBatchId) onCopyBatchId(item.batchId);
            }}
            className="p-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors cursor-pointer"
            title="Salin Batch ID"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Staff & Picker row */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800/80">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Staff Import</span>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0">
              {staffInitial}
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{item.staffName || '-'}</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800/80">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Picker Terdeteksi</span>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
              {pickerInitial}
            </div>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 truncate">{pickerName || '-'}</span>
          </div>
        </div>
      </div>

      {/* Timestamp & Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[11px] text-gray-400 font-mono">
          {formatDate(item.timestamp)}
        </span>

        {isPrimaryAdmin && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer"
              title="Edit Document"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors cursor-pointer"
              title="Delete Document"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export function AdminBatchImportsView({ currentAdmin }: AdminBatchImportsViewProps = {}) {
  const isPrimaryAdmin = useMemo(() => {
    if (!currentAdmin) return false;
    if (currentAdmin.id === 0) return true;
    const uname = (currentAdmin.username || '').toLowerCase();
    return uname === 'admin' || uname === 'superdev' || uname.includes('dev');
  }, [currentAdmin]);

  const [items, setItems] = useState<AdminBatchImportItem[]>([]);
  const [pickerNames, setPickerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState<'excelFilename' | 'batchId' | 'staffName' | 'id' | 'barcode'>('excelFilename');
  const [limitCount, setLimitCount] = useState<number>(100);

  // Layout switcher state
  const [batchViewLayout, setBatchViewLayout] = useState<'AUTO' | 'TABLE' | 'CARDS'>('AUTO');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Mass Search State
  const [searchMode, setSearchMode] = useState<'SINGLE' | 'MASS'>('SINGLE');
  const [massSearchText, setMassSearchText] = useState('');
  const [massSearchApplied, setMassSearchApplied] = useState<string[]>([]);

  const getParsedMassBarcodes = (text: string): string[] => {
    if (!text || !text.trim()) return [];
    return Array.from(
      new Set(
        text
          .split(/[\r\n,;\t]+/)
          .map(b => b.replace(/@/g, '').trim().toUpperCase())
          .filter(b => b.length >= 3)
      )
    );
  };
  
  // Edit State
  const [editingItem, setEditingItem] = useState<AdminBatchImportItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdminBatchImportItem>>({});
  const [editBarcodesText, setEditBarcodesText] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Parsed Barcodes for Edit Modal
  const editBarcodesList = useMemo(() => {
    if (!editBarcodesText || !editBarcodesText.trim()) return [];
    return editBarcodesText
      .split(/[\r\n,;\t]+/)
      .map(b => b.replace(/@/g, '').trim().toUpperCase())
      .filter(b => b.length > 0);
  }, [editBarcodesText]);

  const uniqueEditBarcodesCount = useMemo(() => {
    return new Set(editBarcodesList).size;
  }, [editBarcodesList]);

  const handleCleanAndDeduplicateBarcodes = () => {
    if (!editBarcodesText.trim()) return;
    const uniqueList = Array.from(new Set(editBarcodesList));
    setEditBarcodesText(uniqueList.join('\n'));
    setEditForm(prev => ({ ...prev, jumlah: uniqueList.length }));
    showToast(`${uniqueList.length} resi dirapikan (duplikat dibuang).`);
  };

  // Barcode Viewer Modal State
  const [viewingBarcodesItem, setViewingBarcodesItem] = useState<AdminBatchImportItem | null>(null);
  const [barcodeSearchTerm, setBarcodeSearchTerm] = useState('');
  const [copiedBarcodes, setCopiedBarcodes] = useState(false);

  // Real-time Summary Stats
  const stats = useMemo(() => {
    let totalResi = 0;
    const staffSet = new Set<string>();
    let pickerCount = 0;

    items.forEach(item => {
      totalResi += (item.barcodes?.length || item.jumlah || 0);
      if (item.staffName && item.staffName.trim()) {
        staffSet.add(item.staffName.trim().toUpperCase());
      }
      if (pickerNames[item.id]) {
        pickerCount++;
      }
    });

    return {
      totalBatches: items.length,
      totalResi,
      totalStaff: staffSet.size,
      totalPicker: pickerCount
    };
  }, [items, pickerNames]);

  const fetchRecentData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let constraints: any[] = [orderBy('timestamp', 'desc')];
      if (limitCount > 0) {
        constraints.push(limit(limitCount));
      }

      const q = query(
        collection(db, 'admin_batch_imports'),
        ...constraints
      );
      const snapshot = await getDocs(q);
      const data: AdminBatchImportItem[] = [];
      snapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as AdminBatchImportItem);
      });
      setItems(data);
    } catch (err: any) {
      console.error('Error fetching admin_batch_imports data:', err);
      setErrorMsg(err.message || 'Gagal memuat data dari Firestore');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      fetchRecentData();
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    try {
      const term = searchTerm.trim();
      const termUpper = term.toUpperCase();
      let data: AdminBatchImportItem[] = [];

      if (searchBy === 'id') {
        const q = query(collection(db, 'admin_batch_imports'), where('__name__', '==', term));
        const snapshot = await getDocs(q);
        snapshot.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as AdminBatchImportItem);
        });
      } else if (searchBy === 'barcode') {
        // 1. Try exact array-contains query in Firestore
        const qExact = query(collection(db, 'admin_batch_imports'), where('barcodes', 'array-contains', termUpper));
        const snapshotExact = await getDocs(qExact);
        snapshotExact.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as AdminBatchImportItem);
        });

        // 2. If no exact match or for partial search, scan recent Firestore docs
        if (data.length === 0) {
          const qRecent = query(collection(db, 'admin_batch_imports'), orderBy('timestamp', 'desc'), limit(limitCount > 0 ? limitCount : 1000));
          const snapRecent = await getDocs(qRecent);
          snapRecent.forEach((docSnap) => {
            const item = { id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as AdminBatchImportItem;
            if (Array.isArray(item.barcodes) && item.barcodes.some(b => (b || '').toString().toUpperCase().includes(termUpper))) {
              data.push(item);
            }
          });
        }
      } else {
        const variations = Array.from(new Set([term, termUpper, term.toLowerCase()]));
        const q = query(collection(db, 'admin_batch_imports'), where(searchBy, 'in', variations));
        const snapshot = await getDocs(q);
        snapshot.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as AdminBatchImportItem);
        });
      }
      
      setItems(data);
      if (data.length === 0) {
        setErrorMsg(`Tidak ditemukan data batch import yang cocok dengan ${searchBy === 'barcode' ? 'Nomor Resi' : searchBy}: "${searchTerm}"`);
      }
    } catch (err: any) {
      console.error('Error searching firestore:', err);
      setErrorMsg(err.message || 'Gagal mencari data');
    } finally {
      setLoading(false);
    }
  };

  const handleMassSearch = async () => {
    const parsed = getParsedMassBarcodes(massSearchText);
    setMassSearchApplied(parsed);
    if (parsed.length === 0) {
      alert("Silakan paste setidaknya 1 barcode valid.");
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    try {
      const matchedMap = new Map<string, AdminBatchImportItem>();
      
      // 1. In chunks of 30, query array-contains-any in Firestore
      for (let i = 0; i < parsed.length; i += 30) {
        const chunk = parsed.slice(i, i + 30);
        try {
          const q = query(
            collection(db, 'admin_batch_imports'),
            where('barcodes', 'array-contains-any', chunk)
          );
          const snap = await getDocs(q);
          snap.forEach(docSnap => {
            matchedMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as AdminBatchImportItem);
          });
        } catch (e) {
          console.warn("Array contains any failed, continuing fallback...", e);
        }
      }

      // 2. Also scan recent batch imports from Firestore for any items containing the parsed barcodes
      const qRecent = query(collection(db, 'admin_batch_imports'), orderBy('timestamp', 'desc'), limit(limitCount > 0 ? limitCount : 1000));
      const snapRecent = await getDocs(qRecent);
      snapRecent.forEach(docSnap => {
        const item = { id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as AdminBatchImportItem;
        if (Array.isArray(item.barcodes) && item.barcodes.some(b => parsed.includes((b || '').toString().trim().toUpperCase()))) {
          matchedMap.set(item.id, item);
        }
      });

      const data = Array.from(matchedMap.values()).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setItems(data);
      if (data.length === 0) {
        setErrorMsg(`Tidak ditemukan data batch import yang memuat ${parsed.length} barcode yang dicari.`);
      }
    } catch (err: any) {
      console.error('Error mass searching firestore:', err);
      setErrorMsg(err.message || 'Gagal mencari data massal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentData();
  }, [limitCount]);

  useEffect(() => {
    const fetchPickerNames = async () => {
      if (!items || items.length === 0) return;
      
      const barcodeToBatchId: Record<string, string> = {};
      const firstBarcodes: string[] = [];
      
      items.forEach(item => {
        if (item.barcodes && item.barcodes.length > 0) {
          const bc = item.barcodes[0];
          firstBarcodes.push(bc);
          barcodeToBatchId[bc] = item.id;
        }
      });

      if (firstBarcodes.length === 0) return;

      try {
        let result: Record<string, string> = {};
        for (let i = 0; i < firstBarcodes.length; i += 100) {
          const chunk = firstBarcodes.slice(i, i + 100);
          const { data, error } = await supabase
            .from('scanned_items')
            .select('barcode, employee_name')
            .in('barcode', chunk)
            .in('role', ['PICKER', 'Picker', 'OJOL', 'Ojol']);
          
          if (data && !error) {
            data.forEach(row => {
              if (row.employee_name && row.barcode) {
                const batchId = barcodeToBatchId[row.barcode];
                if (batchId) {
                  result[batchId] = row.employee_name;
                }
              }
            });
          }
        }
        setPickerNames(prev => ({ ...prev, ...result }));
      } catch (e) {
        console.error("Failed to fetch picker names", e);
      }
    };
    
    fetchPickerNames();
  }, [items]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus data impor batch ini dari Firestore & Supabase secara permanen?')) {
      return;
    }
    
    try {
      const itemToDelete = items.find(item => item.id === id);

      // 1. Delete from Firestore
      await deleteDoc(doc(db, 'admin_batch_imports', id));

      // 2. Delete from Supabase
      if (itemToDelete) {
        if (itemToDelete.batchId) {
          const { data: matchedBatches } = await supabase.from('batches').select('id').eq('batch_no', itemToDelete.batchId);
          const matchingIds = (matchedBatches || []).map(b => b.id);
          if (matchingIds.length > 0) {
            await supabase.from('batch_items').delete().in('batch_id', matchingIds);
            await supabase.from('batches').delete().in('id', matchingIds);
          }
        }
        if (itemToDelete.barcodes && itemToDelete.barcodes.length > 0) {
          for (let i = 0; i < itemToDelete.barcodes.length; i += 500) {
            const chunk = itemToDelete.barcodes.slice(i, i + 500);
            await supabase.from('batch_items').delete().in('barcode', chunk);
          }
        }
      }

      setItems(items.filter(item => item.id !== id));
      showToast('Data batch berhasil dihapus.');
    } catch (err: any) {
      console.error('Error deleting document:', err);
      alert('Gagal menghapus data: ' + err.message);
    }
  };

  const openEditModal = (item: AdminBatchImportItem) => {
    setEditingItem(item);
    setEditForm({ ...item });
    const initialText = Array.isArray(item.barcodes) ? item.barcodes.join('\n') : '';
    setEditBarcodesText(initialText);
  };

  const openBarcodesModal = (item: AdminBatchImportItem) => {
    setViewingBarcodesItem(item);
    setBarcodeSearchTerm(searchTerm && searchBy === 'barcode' ? searchTerm : '');
    setCopiedBarcodes(false);
  };

  const handleCopyBarcodes = (barcodes: string[]) => {
    if (!barcodes || barcodes.length === 0) return;
    navigator.clipboard.writeText(barcodes.join('\n'));
    setCopiedBarcodes(true);
    showToast(`${barcodes.length} resi berhasil disalin!`);
    setTimeout(() => setCopiedBarcodes(false), 2000);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    
    setIsSaving(true);
    try {
      const docRef = doc(db, 'admin_batch_imports', editingItem.id);
      
      // Parse current edited barcodes
      const parsedBarcodes = editBarcodesText
        .split(/[\r\n,;\t]+/)
        .map(b => b.replace(/@/g, '').trim().toUpperCase())
        .filter(b => b.length > 0);

      const finalJumlah = parsedBarcodes.length > 0 ? parsedBarcodes.length : (editForm.jumlah || 0);

      const dataToSave = { 
        ...editForm,
        barcodes: parsedBarcodes,
        jumlah: finalJumlah
      };
      delete dataToSave.id;
      
      // 1. Update in Firestore
      await updateDoc(docRef, dataToSave);

      // 2. Sync with Supabase (batches and batch_items) if exists
      try {
        const oldBatchId = editingItem.batchId;
        const newBatchId = dataToSave.batchId || oldBatchId;
        const newExcelFilename = dataToSave.excelFilename || editingItem.excelFilename;

        if (oldBatchId) {
          const { data: matchedBatches } = await supabase
            .from('batches')
            .select('id, batch_no')
            .eq('batch_no', oldBatchId);

          if (matchedBatches && matchedBatches.length > 0) {
            const batchIdInDb = matchedBatches[0].id;
            
            // Update batch header
            await supabase.from('batches').update({
              batch_no: newBatchId,
              excel_filename: newExcelFilename
            }).eq('id', batchIdInDb);

            // Check if barcodes were changed
            const oldBarcodes = editingItem.barcodes || [];
            const isBarcodeChanged = 
              oldBarcodes.length !== parsedBarcodes.length || 
              oldBarcodes.some((bc, idx) => bc !== parsedBarcodes[idx]);

            if (isBarcodeChanged) {
              // Delete existing batch_items for this batch
              await supabase.from('batch_items').delete().eq('batch_id', batchIdInDb);

              // Re-insert new barcodes in chunks of 500
              if (parsedBarcodes.length > 0) {
                const itemsToInsert = parsedBarcodes.map(bc => ({
                  batch_id: batchIdInDb,
                  barcode: bc,
                  created_at: dataToSave.createdAt || editingItem.createdAt || new Date().toISOString()
                }));

                for (let i = 0; i < itemsToInsert.length; i += 500) {
                  const chunk = itemsToInsert.slice(i, i + 500);
                  await supabase.from('batch_items').insert(chunk);
                }
              }
            }
          }
        }
      } catch (sbErr) {
        console.warn('Supabase sync on batch edit warning:', sbErr);
      }
      
      setItems(items.map(item => item.id === editingItem.id ? { ...item, ...dataToSave } as AdminBatchImportItem : item));
      setEditingItem(null);
      showToast(`Data batch berhasil diperbarui (${parsedBarcodes.length} resi).`);
    } catch (err: any) {
      console.error('Error updating document:', err);
      alert('Gagal mengupdate data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (tsStr: string) => {
    if (!tsStr) return '-';
    try {
      return new Date(tsStr).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return tsStr;
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 min-h-full flex flex-col">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[110] bg-gray-900/95 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-gray-700 flex items-center gap-2 text-xs sm:text-sm font-bold animate-[fadeIn_0.2s_ease-out]">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-800/60 shadow-sm">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Batch Imports Manager
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  FIRESTORE
                </span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-0.5">
                Kelola data collection <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-emerald-600 dark:text-emerald-400">admin_batch_imports</code> secara langsung
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Batas Row:</span>
            <select 
              value={limitCount}
              onChange={(e) => setLimitCount(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-bold cursor-pointer shadow-2xs"
            >
              <option value={100}>100 Data</option>
              <option value={500}>500 Data</option>
              <option value={1000}>1000 Data</option>
              <option value={2000}>2000 Data</option>
              <option value={5000}>5000 Data</option>
              <option value={0}>Semua Data (Tanpa Batas)</option>
            </select>
          </div>
        </div>

        {/* 4 STAT METRICS CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 dark:border-emerald-500/30 relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Batches</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white font-mono">
                {stats.totalBatches.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">dokumen</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 dark:border-blue-500/30 relative overflow-hidden group hover:border-blue-500/40 transition-all shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Total Resi Terimpor</span>
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white font-mono">
                {stats.totalResi.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">resi</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 dark:border-purple-500/30 relative overflow-hidden group hover:border-purple-500/40 transition-all shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Staff Pengunggah</span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white font-mono">
                {stats.totalStaff}
              </span>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">orang</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 dark:border-amber-500/30 relative overflow-hidden group hover:border-amber-500/40 transition-all shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Picker Terdeteksi</span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white font-mono">
                {stats.totalPicker}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">batch</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar with Single / Mass Mode & Layout Switcher */}
        <div className="bg-gray-50/80 dark:bg-gray-700/40 p-3.5 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col gap-3 shadow-2xs">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between w-full">
            
            {/* Mode Switcher + Layout Switcher */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-start">
              <div className="flex items-center p-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 shrink-0">
                <button
                  type="button"
                  onClick={() => setSearchMode('SINGLE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    searchMode === 'SINGLE'
                      ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Single Search</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode('MASS')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    searchMode === 'MASS'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Mass Search</span>
                  {massSearchApplied.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-white text-amber-700 rounded-full text-[10px] font-extrabold">
                      {massSearchApplied.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Layout Switcher (Auto / Table / Cards) */}
              <div className="flex items-center p-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 shrink-0">
                <button
                  type="button"
                  onClick={() => setBatchViewLayout('AUTO')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    batchViewLayout === 'AUTO'
                      ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Tampilan Otomatis"
                >
                  <SlidersHorizontal size={13} />
                  <span className="hidden sm:inline">Auto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchViewLayout('TABLE')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    batchViewLayout === 'TABLE'
                      ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Paksa Tampilan Tabel"
                >
                  <Layers size={13} />
                  <span className="hidden sm:inline">Tabel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchViewLayout('CARDS')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    batchViewLayout === 'CARDS'
                      ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Paksa Tampilan Kartu"
                >
                  <LayoutGrid size={13} />
                  <span className="hidden sm:inline">Kartu</span>
                </button>
              </div>
            </div>

            {/* Single Search Mode Form */}
            {searchMode === 'SINGLE' && (
              <form onSubmit={handleSearch} className="flex flex-wrap sm:flex-nowrap gap-2 items-center flex-1 w-full">
                <select 
                  value={searchBy}
                  onChange={(e) => setSearchBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm h-11 font-medium shrink-0"
                >
                  <option value="excelFilename">Excel Filename</option>
                  <option value="barcode">Nomor Resi / Barcode</option>
                  <option value="batchId">Batch ID</option>
                  <option value="staffName">Staff Name</option>
                  <option value="id">Doc ID</option>
                </select>
                
                <div className="relative flex items-center flex-1 min-w-[160px] w-full">
                  <Search className="absolute left-3.5 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder={searchBy === 'barcode' ? "Cari nomor resi / barcode (misal: 004647886474)..." : "Cari data import batch..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm h-11 w-full font-mono placeholder:font-sans"
                  />
                  {searchTerm && (
                    <button 
                      type="button"
                      onClick={() => { setSearchTerm(''); fetchRecentData(); }}
                      className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors cursor-pointer"
                      title="Hapus pencarian"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <button 
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm h-11 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>Cari</span>
                </button>
                
                <button 
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    fetchRecentData();
                  }}
                  title="Refresh / Reset Filter"
                  className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors h-11 w-11 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </form>
            )}
          </div>

          {/* Mass Search Expandable Panel */}
          {searchMode === 'MASS' && (
            <div className="w-full bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    Paste Daftar Barcode Vertikal (Atas ke Bawah):
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {massSearchText.trim() && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                      {getParsedMassBarcodes(massSearchText).length} Barcode Terdeteksi
                    </span>
                  )}
                </div>
              </div>

              <textarea
                value={massSearchText}
                onChange={(e) => setMassSearchText(e.target.value)}
                placeholder="Contoh:&#10;JT12607971529&#10;004647886474&#10;SPXID048991283"
                rows={4}
                className="w-full p-3 text-xs sm:text-sm font-mono border border-amber-300 dark:border-amber-800 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-amber-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                  * Sistem akan otomatis mencocokkan dokumen import yang memuat salah satu barcode di atas.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMassSearchText('');
                      setMassSearchApplied([]);
                      fetchRecentData();
                    }}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleMassSearch}
                    disabled={loading || !massSearchText.trim()}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Cari Massal ({getParsedMassBarcodes(massSearchText).length})</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-2xl flex items-center gap-3 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* RESULTS SECTION: TABLE & MOBILE CARDS */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 sm:p-20 min-h-[300px]">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
            <p className="text-sm text-gray-500 font-medium">Memuat data dari Firestore...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 sm:p-20 text-gray-400 min-h-[300px]">
            <Database className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm text-center">Tidak ada data batch import ditemukan.</p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE VIEW */}
            <div className={`overflow-x-auto ${
              batchViewLayout === 'TABLE' ? 'block' : batchViewLayout === 'CARDS' ? 'hidden' : 'hidden md:block'
            }`}>
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3.5 font-bold w-16">No</th>
                    <th className="px-4 py-3.5 font-bold">Excel Filename</th>
                    <th className="px-4 py-3.5 font-bold">Batch ID</th>
                    <th className="px-4 py-3.5 font-bold text-center">Jumlah Resi</th>
                    <th className="px-4 py-3.5 font-bold">Staff Name</th>
                    <th className="px-4 py-3.5 font-bold">Picker Name</th>
                    <th className="px-4 py-3.5 font-bold">Timestamp</th>
                    <th className="px-4 py-3.5 font-bold">Doc ID</th>
                    {isPrimaryAdmin && (
                      <th className="px-4 py-3.5 font-bold text-right w-28">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-700 dark:text-gray-200">
                  {items.map((item, idx) => {
                    const hasMatchedBarcode = searchTerm && searchBy === 'barcode' && Array.isArray(item.barcodes) && item.barcodes.some(b => (b || '').toString().toUpperCase().includes(searchTerm.trim().toUpperCase()));

                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${hasMatchedBarcode ? 'bg-amber-50/70 dark:bg-amber-900/20' : ''}`}>
                        <td className="px-4 py-3.5 text-gray-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-3.5 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{item.excelFilename || '-'}</span>
                            {hasMatchedBarcode && (
                              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-full border border-amber-300 dark:border-amber-700 animate-pulse">
                                Resi Cocok
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          <div className="flex items-center gap-1.5">
                            <span>{item.batchId}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(item.batchId);
                                showToast(`Batch ID ${item.batchId} disalin!`);
                              }}
                              className="text-gray-400 hover:text-emerald-500 transition-colors cursor-pointer"
                              title="Salin Batch ID"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => openBarcodesModal(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors cursor-pointer"
                            title="Klik untuk melihat list resi barcode"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>{item.barcodes?.length || item.jumlah || 0}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3.5 font-medium">{item.staffName || '-'}</td>
                        <td className="px-4 py-3.5 font-medium text-emerald-600 dark:text-emerald-400">{pickerNames[item.id] || '-'}</td>
                        <td className="px-4 py-3.5 text-xs text-gray-500 font-mono">{formatDate(item.timestamp)}</td>
                        <td className="px-4 py-3.5 text-[11px] text-gray-400 font-mono select-all max-w-[120px] truncate" title={item.id}>
                          {item.id}
                        </td>
                        {isPrimaryAdmin && (
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button 
                                onClick={() => openBarcodesModal(item)}
                                className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                                title="Lihat List Resi Barcode (Mata)"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => openEditModal(item)}
                                className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                                title="Edit Document"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                                title="Delete Document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE / TABLET CARD GRID VIEW */}
            <div className={`p-4 ${
              batchViewLayout === 'CARDS' ? 'block' : batchViewLayout === 'TABLE' ? 'hidden' : 'block md:hidden'
            }`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {items.map((item, idx) => {
                  const hasMatchedBarcode = searchTerm && searchBy === 'barcode' && Array.isArray(item.barcodes) && item.barcodes.some(b => (b || '').toString().toUpperCase().includes(searchTerm.trim().toUpperCase()));

                  return (
                    <BatchImportCard
                      key={item.id}
                      item={item}
                      index={idx}
                      pickerName={pickerNames[item.id]}
                      isPrimaryAdmin={isPrimaryAdmin}
                      hasMatchedBarcode={hasMatchedBarcode}
                      onViewBarcodes={openBarcodesModal}
                      onEdit={openEditModal}
                      onDelete={handleDelete}
                      onCopyBatchId={(b) => showToast(`Batch ID ${b} disalin!`)}
                      formatDate={formatDate}
                    />
                  );
                })}
              </div>
            </div>

            {/* BOTTOM SUMMARY FOOTER */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 mt-auto">
              <span>
                Menampilkan <strong className="text-gray-800 dark:text-gray-200">{items.length}</strong> data batch import {limitCount === 0 ? '(Semua Data)' : 'terbaru'}
              </span>
              <span>
                Total <strong className="text-emerald-600 dark:text-emerald-400">{stats.totalResi.toLocaleString('id-ID')}</strong> resi barcode
              </span>
            </div>
          </>
        )}
      </div>

      {/* BARCODE LIST VIEWER MODAL (GAMBAR MATA) */}
      {viewingBarcodesItem && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-700 animate-[fadeIn_0.2s_ease-out]">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-900/20 sticky top-0 z-10">
              <div className="min-w-0 flex-1 pr-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 truncate">
                  <Eye className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">List Barcode Resi ({viewingBarcodesItem.barcodes?.length || viewingBarcodesItem.jumlah || 0})</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  Batch: <strong className="text-emerald-600 dark:text-emerald-400">{viewingBarcodesItem.batchId}</strong> • File: {viewingBarcodesItem.excelFilename}
                </p>
              </div>
              
              <button 
                onClick={() => setViewingBarcodesItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex flex-wrap items-center justify-between gap-2.5">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Filter resi di batch ini..."
                  value={barcodeSearchTerm}
                  onChange={(e) => setBarcodeSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  autoFocus
                />
                {barcodeSearchTerm && (
                  <button 
                    onClick={() => setBarcodeSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const itemToEdit = viewingBarcodesItem;
                    setViewingBarcodesItem(null);
                    openEditModal(itemToEdit);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Edit data batch dan daftar resi ini"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Resi</span>
                </button>
                <button
                  onClick={() => handleCopyBarcodes(viewingBarcodesItem.barcodes || [])}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {copiedBarcodes ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBarcodes ? 'Tersalin!' : 'Salin Semua'}</span>
                </button>
              </div>
            </div>

            {/* List Body */}
            <div className="p-4 overflow-y-auto flex-1 bg-white dark:bg-gray-800">
              {(() => {
                const barcodes: string[] = viewingBarcodesItem.barcodes || [];
                if (barcodes.length === 0) {
                  return (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      Tidak ada detail barcode yang tersimpan pada item ini.
                    </div>
                  );
                }

                const filtered = barcodeSearchTerm.trim()
                  ? barcodes.filter(b => b.toUpperCase().includes(barcodeSearchTerm.trim().toUpperCase()))
                  : barcodes;

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      Tidak ada barcode yang cocok dengan filter "{barcodeSearchTerm}".
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {filtered.map((b, i) => {
                      const isHighlighted = barcodeSearchTerm && b.toUpperCase().includes(barcodeSearchTerm.trim().toUpperCase());
                      return (
                        <div 
                          key={i} 
                          className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono border transition-all ${
                            isHighlighted 
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-bold' 
                              : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <span className="truncate select-all mr-2">{b}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(b);
                              showToast(`Resi ${b} disalin!`);
                            }}
                            className="p-1 text-gray-400 hover:text-emerald-500 rounded transition-colors shrink-0"
                            title="Salin barcode ini"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            
            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center text-xs text-gray-500">
              <span>Staff: <strong className="text-gray-700 dark:text-gray-300">{viewingBarcodesItem.staffName || '-'}</strong></span>
              <button 
                onClick={() => setViewingBarcodesItem(null)}
                className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-700">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-500" />
                Edit Batch Import
              </h3>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Doc ID (Read Only)</label>
                <input 
                  type="text" 
                  value={editForm.id || ''} 
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-500 font-mono text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Excel Filename</label>
                   <input 
                     type="text" 
                     value={editForm.excelFilename || ''} 
                     onChange={(e) => setEditForm({...editForm, excelFilename: e.target.value})}
                     className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm"
                   />
                 </div>
                 
                 <div>
                   <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Batch ID</label>
                   <input 
                     type="text" 
                     value={editForm.batchId || ''} 
                     onChange={(e) => setEditForm({...editForm, batchId: e.target.value})}
                     className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm font-mono"
                   />
                 </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Staff Name</label>
                   <input 
                     type="text" 
                     value={editForm.staffName || ''} 
                     onChange={(e) => setEditForm({...editForm, staffName: e.target.value})}
                     className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm"
                   />
                 </div>
                 
                 <div>
                   <div className="flex items-center justify-between mb-1">
                     <label className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Jumlah</label>
                     {editBarcodesList.length > 0 && editBarcodesList.length !== (editForm.jumlah || 0) && (
                       <button
                         type="button"
                         onClick={() => setEditForm(prev => ({ ...prev, jumlah: editBarcodesList.length }))}
                         className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                       >
                         Sinkron ({editBarcodesList.length} resi)
                       </button>
                     )}
                   </div>
                   <input 
                     type="number" 
                     value={editForm.jumlah || 0} 
                     onChange={(e) => setEditForm({...editForm, jumlah: Number(e.target.value)})}
                     className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm font-mono"
                   />
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Timestamp</label>
                   <input 
                     type="text" 
                     value={editForm.timestamp || ''} 
                     onChange={(e) => setEditForm({...editForm, timestamp: e.target.value})}
                     className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs sm:text-sm"
                   />
                 </div>
                 <div>
                   <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Created At</label>
                   <input 
                     type="text" 
                     value={editForm.createdAt || ''} 
                     onChange={(e) => setEditForm({...editForm, createdAt: e.target.value})}
                     className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs sm:text-sm"
                   />
                 </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span>Daftar Barcode / Resi</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {editBarcodesList.length} resi
                    </span>
                    {editBarcodesList.length !== uniqueEditBarcodesCount && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        {editBarcodesList.length - uniqueEditBarcodesCount} duplikat
                      </span>
                    )}
                  </label>

                  <div className="flex items-center gap-1.5">
                    {editBarcodesList.length !== uniqueEditBarcodesCount && (
                      <button
                        type="button"
                        onClick={handleCleanAndDeduplicateBarcodes}
                        className="text-[11px] px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-colors shadow-xs"
                        title="Buang resi duplikat dari daftar"
                      >
                        Buang Duplikat
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!editBarcodesText.trim()) return;
                        navigator.clipboard.writeText(editBarcodesText);
                        showToast(`${editBarcodesList.length} resi disalin.`);
                      }}
                      className="text-[11px] px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editBarcodesText.trim() && window.confirm('Kosongkan semua daftar resi?')) {
                          setEditBarcodesText('');
                          setEditForm(prev => ({ ...prev, jumlah: 0 }));
                        }
                      }}
                      className="text-[11px] px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-lg font-medium transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Kosongkan</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={editBarcodesText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditBarcodesText(val);
                    const parsed = val
                      .split(/[\r\n,;\t]+/)
                      .map(b => b.replace(/@/g, '').trim().toUpperCase())
                      .filter(b => b.length > 0);
                    setEditForm(prev => ({ ...prev, jumlah: parsed.length }));
                  }}
                  rows={6}
                  placeholder="Tempel nomor resi di sini (satu resi per baris, atau pisahkan dengan koma)..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs leading-relaxed resize-y shadow-inner"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>* Masukkan 1 nomor resi per baris (Enter) atau pisahkan dengan koma (,).</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    Total: {editBarcodesList.length} resi ({uniqueEditBarcodesCount} unik)
                  </span>
                </div>
              </div>
            </div>
            
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 mt-auto">
              <button 
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                disabled={isSaving}
              >
                Batal
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
