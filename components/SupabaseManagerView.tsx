import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Database, 
  Search, 
  RefreshCw, 
  Trash2, 
  Pencil, 
  X, 
  Save, 
  AlertCircle,
  Calendar
} from 'lucide-react';
import { UserRole } from '../types';

interface SupabaseItem {
  id: string;
  barcode: string;
  destination: string;
  description: string;
  role: string;
  timestamp: number;
  admin_name?: string;
  employee_name?: string;
  menu_context?: string;
  excel_filename?: string;
  [key: string]: any;
}

export function SupabaseManagerView() {
  const [items, setItems] = useState<SupabaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState<'barcode' | 'destination' | 'id'>('barcode');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [limitCount, setLimitCount] = useState(100);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [isDateRange, setIsDateRange] = useState(false);
  
  // Edit State
  const [editingItem, setEditingItem] = useState<SupabaseItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<SupabaseItem>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Bulk Sync & Bulk Edit Date State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [syncRole, setSyncRole] = useState<string>('PICKER');
  const [isSyncing, setIsSyncing] = useState(false);
  const [bulkTargetDate, setBulkTargetDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isBulkUpdatingDate, setIsBulkUpdatingDate] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchRecentData = async () => {
    setLoading(true);
    setErrorMsg('');
    setHasSearched(false);
    setSelectedIds([]);
    try {
      let queryBuilder = supabase.from('scanned_items').select('*');
      
      let actualStartDate = startDate;
      let actualEndDate = isDateRange ? endDate : startDate;

      if (actualStartDate) {
        const startMs = new Date(`${actualStartDate}T00:00:00`).getTime();
        queryBuilder = queryBuilder.gte('timestamp', startMs);
      }
      if (actualEndDate) {
        const endMs = new Date(`${actualEndDate}T23:59:59.999`).getTime();
        queryBuilder = queryBuilder.lte('timestamp', endMs);
      }

      if (selectedRoleFilter !== 'ALL') {
        if (selectedRoleFilter === 'PICKER') {
          queryBuilder = queryBuilder.in('role', ['PICKER', 'PICKER_2']);
        } else {
          queryBuilder = queryBuilder.eq('role', selectedRoleFilter);
        }
      }

      const { data, error } = await queryBuilder
        .order('timestamp', { ascending: false })
        .limit(limitCount);

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Error fetching Supabase data:', err);
      setErrorMsg(err.message || 'Gagal memuat data dari Supabase');
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
    setHasSearched(true);
    setSelectedIds([]);
    try {
      let queryBuilder = supabase.from('scanned_items').select('*');
      
      const searchTerms = searchTerm.trim().split(/[\s,;]+/).filter(Boolean);

      if (searchBy === 'barcode' && searchTerms.length > 1) {
         queryBuilder = queryBuilder.in('barcode', searchTerms);
      } else if (searchBy === 'id') {
         queryBuilder = queryBuilder.eq('id', searchTerm.trim());
      } else {
         queryBuilder = queryBuilder.ilike(searchBy, `%${searchTerm.trim()}%`);
      }
      
      let actualStartDate = startDate;
      let actualEndDate = isDateRange ? endDate : startDate;

      if (actualStartDate) {
        const startMs = new Date(`${actualStartDate}T00:00:00`).getTime();
        queryBuilder = queryBuilder.gte('timestamp', startMs);
      }
      if (actualEndDate) {
        const endMs = new Date(`${actualEndDate}T23:59:59.999`).getTime();
        queryBuilder = queryBuilder.lte('timestamp', endMs);
      }

      if (selectedRoleFilter !== 'ALL') {
        if (selectedRoleFilter === 'PICKER') {
          queryBuilder = queryBuilder.in('role', ['PICKER', 'PICKER_2']);
        } else {
          queryBuilder = queryBuilder.eq('role', selectedRoleFilter);
        }
      }
      
      const { data, error } = await queryBuilder.order('timestamp', { ascending: false });
      if (error) throw error;
      
      let fetchedData = data || [];
      if (searchBy === 'barcode' && searchTerms.length > 0) {
         const roleOrder: Record<string, number> = {
            'PICKER': 1,
            'PICKER_2': 1,
            'CHECKER': 2,
            'PACKING': 3,
            'OJOL': 4
         };
         fetchedData.sort((a, b) => {
            if (a.barcode !== b.barcode) return (a.barcode || '').localeCompare(b.barcode || '');
            const orderA = roleOrder[a.role?.toUpperCase()] || 99;
            const orderB = roleOrder[b.role?.toUpperCase()] || 99;
            return orderA - orderB;
         });
      }
      
      setItems(fetchedData);
    } catch (err: any) {
      console.error('Error searching Supabase:', err);
      setErrorMsg(err.message || 'Gagal mencari data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentData();
  }, [limitCount, selectedRoleFilter]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus data ini dari Supabase secara permanen?')) {
      return;
    }
    
    try {
      const { error } = await supabase.from('scanned_items').delete().eq('id', id);
      if (error) throw error;
      setItems(items.filter(item => item.id !== id));
    } catch (err: any) {
      console.error('Error deleting row:', err);
      alert('Gagal menghapus data: ' + err.message);
    }
  };

  const openEditModal = (item: SupabaseItem) => {
    setEditingItem(item);
    setEditForm({ ...item });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    
    setIsSaving(true);
    try {
      const dataToSave = { ...editForm };
      delete dataToSave.id;
      
      const { error } = await supabase.from('scanned_items').update(dataToSave).eq('id', editingItem.id);
      if (error) throw error;
      
      setItems(items.map(item => item.id === editingItem.id ? { ...item, ...dataToSave } as SupabaseItem : item));
      setEditingItem(null);
    } catch (err: any) {
      console.error('Error updating row:', err);
      alert('Gagal mengupdate data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('id-ID');
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(items.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(rowId => rowId !== id));
    }
  };

  const handleSyncTimestamp = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Yakin ingin menyinkronkan timestamp ${selectedIds.length} data terpilih sesuai dengan role ${syncRole}?`)) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // 1. Dapatkan barcode dari item yang dipilih
      const selectedItems = items.filter(item => selectedIds.includes(item.id));
      const barcodes = Array.from(new Set(selectedItems.map(item => item.barcode)));

      // 2. Query data sumber (target role) dari Supabase untuk barcode tersebut
      const { data: sourceData, error } = await supabase
        .from('scanned_items')
        .select('barcode, timestamp, created_at')
        .in('barcode', barcodes)
        .eq('role', syncRole);

      if (error) throw error;

      // 3. Buat map barcode -> data sumber (ambil yang terbaru)
      const sourceMap = new Map();
      sourceData?.forEach(item => {
        if (!sourceMap.has(item.barcode) || sourceMap.get(item.barcode).timestamp < item.timestamp) {
           sourceMap.set(item.barcode, item);
        }
      });

      // 4. Update item yang dipilih
      for (const item of selectedItems) {
        const source = sourceMap.get(item.barcode);
        if (source) {
          const updateData: any = { timestamp: source.timestamp };
          if (source.created_at) {
            updateData.created_at = source.created_at;
          }
          const { error: updateError } = await supabase
            .from('scanned_items')
            .update(updateData)
            .eq('id', item.id);
            
          if (!updateError) {
             successCount++;
             // Update state lokal agar UI langsung berubah
             item.timestamp = source.timestamp;
             if (source.created_at) item.created_at = source.created_at;
          } else {
             failCount++;
          }
        } else {
          failCount++; // Tidak ditemukan data sumber untuk disinkronkan
        }
      }

      alert(`Sinkronisasi selesai.\nBerhasil: ${successCount}\nGagal/Tidak ada sumber: ${failCount}`);
      setItems([...items]); // force re-render
      setSelectedIds([]);
    } catch (err: any) {
      console.error('Error syncing timestamps:', err);
      alert('Gagal menyinkronkan data: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkUpdateDate = async () => {
    if (selectedIds.length === 0) {
      alert("Pilih setidaknya 1 baris data!");
      return;
    }
    if (!bulkTargetDate) {
      alert("Silakan pilih tanggal target terlebih dahulu!");
      return;
    }

    if (!window.confirm(`Konfirmasi Ubah Tanggal Massal:\n- Total Data Terpilih: ${selectedIds.length}\n- Tanggal Baru: ${bulkTargetDate}\n- Catatan: Jam, menit, dan detik asli masing-masing data TIDAK AKAN diubah.\n\nApakah Anda yakin ingin melanjutkan?`)) {
      return;
    }

    setIsBulkUpdatingDate(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const [targetY, targetM, targetD] = bulkTargetDate.split('-').map(Number);
      const selectedItems = items.filter(item => selectedIds.includes(item.id));

      for (const item of selectedItems) {
        const origTs = item.timestamp || Date.now();
        const origDateObj = new Date(origTs);

        // Preserve original time of day
        const hours = origDateObj.getHours();
        const mins = origDateObj.getMinutes();
        const secs = origDateObj.getSeconds();
        const ms = origDateObj.getMilliseconds();

        const newDateObj = new Date(targetY, targetM - 1, targetD, hours, mins, secs, ms);
        const newTimestamp = newDateObj.getTime();
        const newCreatedAt = newDateObj.toISOString();

        const { error } = await supabase
          .from('scanned_items')
          .update({
            timestamp: newTimestamp,
            created_at: newCreatedAt
          })
          .eq('id', item.id);

        if (!error) {
          successCount++;
          item.timestamp = newTimestamp;
          item.created_at = newCreatedAt;
        } else {
          console.error(`Error updating date for item ${item.id}:`, error);
          failCount++;
        }
      }

      alert(`Selesai mengubah tanggal massal:\n- Berhasil: ${successCount} data\n- Gagal: ${failCount} data\n\nJam & detik asli tetap utuh dipertahankan.`);
      setItems([...items]);
      setSelectedIds([]);
    } catch (err: any) {
      console.error("Error bulk updating date:", err);
      alert("Gagal merubah tanggal: " + err.message);
    } finally {
      setIsBulkUpdatingDate(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert("Pilih setidaknya 1 baris data untuk dihapus!");
      return;
    }

    if (!window.confirm(`Konfirmasi Hapus Massal:\n- Total data yang akan dihapus: ${selectedIds.length} baris\n\nData akan dihapus secara PERMANEN dari tabel 'scanned_items' di Supabase.\nApakah Anda yakin ingin melanjutkan?`)) {
      return;
    }

    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
        const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from('scanned_items')
          .delete()
          .in('id', chunk);

        if (error) {
          console.error('Error deleting chunk:', error);
          failCount += chunk.length;
          throw error;
        } else {
          successCount += chunk.length;
        }
      }

      const deletedSet = new Set(selectedIds);
      setItems(prev => prev.filter(item => !deletedSet.has(item.id)));
      setSelectedIds([]);
      alert(`Berhasil menghapus ${successCount} data dari Supabase.`);
    } catch (err: any) {
      console.error('Error bulk deleting data:', err);
      alert(`Gagal menghapus sebagian data:\n${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-500" />
            Supabase Data Manager
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Kelola data tabel 'scanned_items' secara langsung (Read, Update, Delete)
          </p>
        </div>
        
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-1.5 mr-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
             <input type="checkbox" checked={isDateRange} onChange={(e) => setIsDateRange(e.target.checked)} className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
             Rentang Tanggal
          </label>

          <input 
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 h-[42px]"
            title={isDateRange ? "Tanggal Mulai" : "Pilih Tanggal"}
          />
          {isDateRange && (
             <>
                <span className="text-gray-500 font-medium">-</span>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 h-[42px]"
                  title="Tanggal Akhir"
                />
             </>
          )}

          <select 
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 h-[42px] font-bold text-xs"
            title="Filter Role"
          >
            <option value="ALL">Semua Role</option>
            <option value="PICKER">PICKER (1 & 2)</option>
            <option value="CHECKER">CHECKER</option>
            <option value="PACKING">PACKING</option>
            <option value="OJOL">OJOL</option>
            <option value="SORTIR">SORTIR</option>
            <option value="LOGISTIK">LOGISTIK</option>
            <option value="LEADER">LEADER</option>
          </select>

          <select 
            value={searchBy}
            onChange={(e) => setSearchBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 h-[42px]"
          >
            <option value="barcode">Barcode</option>
            <option value="destination">Destination</option>
            <option value="id">ID</option>
          </select>
          
          <div className="relative flex items-start">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <textarea 
              placeholder="Cari data (bisa massal...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              rows={searchBy === 'barcode' && searchTerm.length > 30 ? 2 : 1}
              className="pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 w-48 lg:w-64 min-h-[42px] resize-y"
            />
            {searchTerm && (
               <button 
                  type="button"
                  onClick={() => { setSearchTerm(''); fetchRecentData(); }}
                  className="absolute right-2 top-2.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors"
                  title="Hapus pencarian"
               >
                  <X className="w-4 h-4" />
               </button>
            )}
          </div>
          
          <button 
            type="submit"
            className="h-[42px] px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-emerald-500 shrink-0"
          >
            <Search className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Cari Data</span>
          </button>
          
          <button 
            type="button"
            onClick={fetchRecentData}
            title="Refresh Data"
            className="h-[42px] px-3.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-1.5 font-semibold text-xs shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm">
          <div className="text-sm text-emerald-900 dark:text-emerald-200 font-medium flex items-center gap-2">
            <span className="bg-emerald-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-full shadow-xs">
              {selectedIds.length} Data Terpilih
            </span>
            <span>Aksi massal untuk data terpilih:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Action 1: Bulk Edit Date (Preserve Original Time) */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-2xs">
              <Calendar size={14} className="text-emerald-600 dark:text-emerald-400 ml-1 shrink-0" />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Tanggal:</span>
              <input 
                type="date"
                value={bulkTargetDate}
                onChange={(e) => setBulkTargetDate(e.target.value)}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold outline-none cursor-pointer"
                disabled={isBulkUpdatingDate || isSyncing}
              />
              <button
                type="button"
                onClick={handleBulkUpdateDate}
                disabled={isBulkUpdatingDate || isSyncing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                {isBulkUpdatingDate ? <RefreshCw size={14} className="animate-spin" /> : <Calendar size={14} />}
                {isBulkUpdatingDate ? 'Proses...' : 'Ubah Tanggal Massal'}
              </button>
            </div>

            {/* Action 2: Sync Role Timestamp */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-blue-300 dark:border-blue-700 shadow-2xs">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 ml-1">Sync ke Role:</span>
              <select 
                value={syncRole} 
                onChange={(e) => setSyncRole(e.target.value)}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold outline-none cursor-pointer"
                disabled={isSyncing || isBulkUpdatingDate}
              >
                {Object.values(UserRole).map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSyncTimestamp}
                disabled={isSyncing || isBulkUpdatingDate || isBulkDeleting}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Role'}
              </button>
            </div>

            {/* Action 3: Bulk Delete Selected */}
            <div className="flex items-center bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-red-300 dark:border-red-700 shadow-2xs">
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting || isBulkUpdatingDate || isSyncing}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Hapus data terpilih secara permanen dari Supabase"
              >
                {isBulkDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isBulkDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedIds.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 font-semibold w-16">No</th>
                <th className="px-4 py-3 font-semibold">Barcode</th>
                <th className="px-4 py-3 font-semibold">Destination</th>
                <th className="px-4 py-3 font-semibold">Role / Karyawan</th>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">UUID</th>
                <th className="px-4 py-3 font-semibold text-right w-24">
                  {selectedIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      disabled={isBulkDeleting || isBulkUpdatingDate || isSyncing}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-[11px] font-bold transition-all shadow-xs cursor-pointer animate-pulse"
                      title={`Hapus ${selectedIds.length} data terpilih`}
                    >
                      <Trash2 size={12} />
                      <span>Hapus ({selectedIds.length})</span>
                    </button>
                  ) : (
                    'Aksi'
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-700 dark:text-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat data dari Supabase...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada data ditemukan.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id} className={`transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.id)}
                        onChange={(e) => handleSelectRow(item.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold">{item.barcode}</td>
                    <td className="px-4 py-3">{item.destination || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">{item.role || '-'}</div>
                      <div className="text-xs text-gray-500">{item.admin_name || item.employee_name || ''}</div>
                    </td>
                    <td className="px-4 py-3">{formatDate(item.timestamp)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono select-all">
                      {item.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(item)}
                          className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          title="Edit Row"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                          title="Delete Row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && items.length > 0 && !searchTerm && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Menampilkan {items.length} data terbaru
            </span>
            <select 
              value={limitCount}
              onChange={(e) => setLimitCount(Number(e.target.value))}
              className="text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none"
            >
              <option value={100}>100 Data</option>
              <option value={500}>500 Data</option>
              <option value={1000}>1000 Data</option>
            </select>
          </div>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-[260] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-500" />
                Edit Data Supabase
              </h3>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID (Read Only)</label>
                <input 
                  type="text" 
                  value={editForm.id || ''} 
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-500 font-mono"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Barcode</label>
                <input 
                  type="text" 
                  value={editForm.barcode || ''} 
                  onChange={(e) => setEditForm({...editForm, barcode: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination</label>
                <input 
                  type="text" 
                  value={editForm.destination || ''} 
                  onChange={(e) => setEditForm({...editForm, destination: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea 
                  value={editForm.description || ''} 
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select 
                    value={editForm.role || ''} 
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {Object.values(UserRole).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timestamp</label>
                  <input 
                    type="number" 
                    value={editForm.timestamp || 0} 
                    onChange={(e) => setEditForm({...editForm, timestamp: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Karyawan / Staff</label>
                  <input 
                    type="text" 
                    value={editForm.employee_name || ''} 
                    onChange={(e) => setEditForm({...editForm, employee_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Creator</label>
                  <input 
                    type="text" 
                    value={editForm.admin_name || ''} 
                    onChange={(e) => setEditForm({...editForm, admin_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Menu Context</label>
                  <input 
                    type="text" 
                    value={editForm.menu_context || ''} 
                    onChange={(e) => setEditForm({...editForm, menu_context: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Excel Filename</label>
                  <input 
                    type="text" 
                    value={editForm.excel_filename || ''} 
                    onChange={(e) => setEditForm({...editForm, excel_filename: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/90 shrink-0 sticky bottom-0 z-20">
              <button 
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors cursor-pointer"
                disabled={isSaving}
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
