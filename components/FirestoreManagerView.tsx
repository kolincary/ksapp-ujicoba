import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseClient';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { 
  Database, 
  Search, 
  RefreshCw, 
  Trash2, 
  Pencil, 
  X, 
  Save, 
  AlertCircle,
  Filter,
  UserCheck,
  FileText,
  Calendar
} from 'lucide-react';
import { UserRole } from '../types';

interface FirestoreItem {
  id: string;
  barcode: string;
  destination: string;
  description: string;
  role: string;
  timestamp: number;
  admin_name?: string;
  employee_name?: string;
  [key: string]: any;
}

export function FirestoreManagerView() {
  const [items, setItems] = useState<FirestoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState<'barcode' | 'destination' | 'role' | 'admin_name' | 'employee_name' | 'id'>('barcode');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [adminSearch, setAdminSearch] = useState<string>('');
  const [limitCount, setLimitCount] = useState<number>(100);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateRange, setIsDateRange] = useState(false);
  
  // Edit State
  const [editingItem, setEditingItem] = useState<FirestoreItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<FirestoreItem>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Helper to generate barcode variations for Firestore 'in' query
  const generateBarcodeVariations = (input: string): string[] => {
    const clean = input.trim();
    if (!clean) return [];
    const set = new Set<string>();
    set.add(clean);
    set.add(clean.toUpperCase());
    set.add(clean.toLowerCase());
    
    // Strip or add 0026
    if (clean.startsWith('0026')) {
      const s = clean.slice(2);
      set.add(s);
      set.add(s.toUpperCase());
    } else {
      set.add('0026' + clean);
    }
    
    // Dash variations for prefix-based couriers (LXAD, JNAP, JNEB, JP, SPX)
    if (/^LXAD-?/i.test(clean)) {
      const digits = clean.replace(/^LXAD-?/i, '');
      set.add(`LXAD-${digits}`);
      set.add(`LXAD${digits}`);
      set.add(`lxad-${digits}`);
      set.add(`lxad${digits}`);
    }
    if (/^JNAP-?/i.test(clean)) {
      const digits = clean.replace(/^JNAP-?/i, '');
      set.add(`JNAP-${digits}`);
      set.add(`JNAP${digits}`);
      set.add(`jnap-${digits}`);
      set.add(`jnap${digits}`);
    }
    if (/^JNEB-?/i.test(clean)) {
      const digits = clean.replace(/^JNEB-?/i, '');
      set.add(`JNEB-${digits}`);
      set.add(`JNEB${digits}`);
      set.add(`jneb-${digits}`);
      set.add(`jneb${digits}`);
    }
    
    return Array.from(set).slice(0, 30);
  };

  const fetchRecentData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let constraints: any[] = [orderBy('timestamp', 'desc')];
      
      let actualStartDate = startDate;
      let actualEndDate = isDateRange ? endDate : startDate;

      if (actualStartDate) {
        const startMs = new Date(`${actualStartDate}T00:00:00`).getTime();
        constraints.push(where('timestamp', '>=', startMs));
      }
      if (actualEndDate) {
        const endMs = new Date(`${actualEndDate}T23:59:59.999`).getTime();
        constraints.push(where('timestamp', '<=', endMs));
      }

      if (limitCount > 0) {
        constraints.push(limit(limitCount));
      }

      const q = query(
        collection(db, 'scanned_items'),
        ...constraints
      );
      const snapshot = await getDocs(q);
      const data: FirestoreItem[] = [];
      snapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as FirestoreItem);
      });
      setItems(data);
    } catch (err: any) {
      console.error('Error fetching firestore data:', err);
      setErrorMsg(err.message || 'Gagal memuat data dari Firestore');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      fetchRecentData();
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    try {
      let q;
      if (searchBy === 'id') {
        q = query(collection(db, 'scanned_items'), where('__name__', '==', searchTerm.trim()));
      } else if (searchBy === 'barcode') {
        const variations = generateBarcodeVariations(searchTerm);
        q = query(collection(db, 'scanned_items'), where('barcode', 'in', variations));
      } else {
        const variations = Array.from(new Set([searchTerm.trim(), searchTerm.trim().toUpperCase(), searchTerm.trim().toLowerCase()]));
        q = query(collection(db, 'scanned_items'), where(searchBy, 'in', variations));
      }
      
      const snapshot = await getDocs(q);
      let data: FirestoreItem[] = [];
      snapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as FirestoreItem);
      });
      
      // Filter locally by date if dates are set
      let actualStartDate = startDate;
      let actualEndDate = isDateRange ? endDate : startDate;

      if (actualStartDate) {
        const startMs = new Date(`${actualStartDate}T00:00:00`).getTime();
        data = data.filter(item => item.timestamp >= startMs);
      }
      if (actualEndDate) {
        const endMs = new Date(`${actualEndDate}T23:59:59.999`).getTime();
        data = data.filter(item => item.timestamp <= endMs);
      }
      
      setItems(data);
    } catch (err: any) {
      console.error('Error searching firestore:', err);
      setErrorMsg(err.message || 'Gagal mencari data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      fetchRecentData();
    }
  }, [limitCount, startDate, endDate, isDateRange]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus data ini dari Firestore secara permanen?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'scanned_items', id));
      setItems(items.filter(item => item.id !== id));
    } catch (err: any) {
      console.error('Error deleting document:', err);
      alert('Gagal menghapus data: ' + err.message);
    }
  };

  const openEditModal = (item: FirestoreItem) => {
    setEditingItem(item);
    setEditForm({ ...item });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    
    setIsSaving(true);
    try {
      const docRef = doc(db, 'scanned_items', editingItem.id);
      
      const dataToSave = { ...editForm };
      delete dataToSave.id;
      
      await updateDoc(docRef, dataToSave);
      
      setItems(items.map(item => item.id === editingItem.id ? { ...item, ...dataToSave } as FirestoreItem : item));
      setEditingItem(null);
    } catch (err: any) {
      console.error('Error updating document:', err);
      alert('Gagal mengupdate data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('id-ID');
  };

  // Collect unique roles for filter dropdown
  const roleOptions = Array.from(new Set([
    ...Object.values(UserRole),
    ...items.map(i => i.role).filter(Boolean)
  ]));

  // Filter items based on selectedRole and adminSearch
  const filteredItems = items.filter(item => {
    if (selectedRole !== 'ALL') {
      if ((item.role || '').toUpperCase() !== selectedRole.toUpperCase()) {
        return false;
      }
    }
    if (adminSearch.trim()) {
      const term = adminSearch.trim().toLowerCase();
      const adminName = (item.admin_name || '').toLowerCase();
      const empName = (item.employee_name || '').toLowerCase();
      const roleName = (item.role || '').toLowerCase();
      if (!adminName.includes(term) && !empName.includes(term) && !roleName.includes(term)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="p-6 bg-white dark:bg-gray-800 min-h-full">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Database className="w-6 h-6 text-orange-500" />
              Firestore Data Manager
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Kelola data collection 'scanned_items' secara langsung (Read, Update, Delete)
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Batas Row:</span>
            <select 
              value={limitCount}
              onChange={(e) => setLimitCount(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium"
            >
              <option value={100}>100 Data</option>
              <option value={500}>500 Data</option>
              <option value={1000}>1000 Data</option>
              <option value={2000}>2000 Data</option>
              <option value={5000}>5000 Data</option>
              <option value={0}>Tanpa Batas (Semua Data)</option>
            </select>
          </div>
        </div>

        {/* Database Info Notice */}
        <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Info Database Firestore:</span> Menu ini mengelola data collection <code>scanned_items</code> di <strong>Cloud Firestore (Firebase)</strong>. Seluruh data operasional harian utama (Data Packing, Picker, Ekspedisi, Retur, dll.) tersimpan di <strong>Supabase</strong>. Data bulan sebelumnya di Firestore hanya tersedia jika telah disinkronkan melalui menu <strong>Search Data 2</strong> (DevMode Sync).
          </div>
        </div>

        {/* Stats & Totals Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 p-4 rounded-xl flex items-center gap-3">
            <div className="p-3 bg-orange-500 text-white rounded-lg shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">Total Hasil Data</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {filteredItems.length.toLocaleString('id-ID')} <span className="text-xs font-normal text-gray-500">row</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 p-4 rounded-xl flex items-center gap-3">
            <div className="p-3 bg-blue-500 text-white rounded-lg shadow-sm">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Tanggal Diberlakukan</div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">
                {startDate ? (isDateRange && endDate ? `${startDate} s/d ${endDate}` : startDate) : 'Semua Tanggal'}
              </div>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 p-4 rounded-xl flex items-center gap-3">
            <div className="p-3 bg-purple-500 text-white rounded-lg shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">Filter Karyawan / Admin</div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">
                {adminSearch.trim() ? adminSearch.trim() : 'Semua Karyawan'}
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-xl flex items-center gap-3">
            <div className="p-3 bg-emerald-500 text-white rounded-lg shadow-sm">
              <Filter className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Filter Role</div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">
                {selectedRole !== 'ALL' ? selectedRole : 'Semua Role'}
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-500" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-orange-500 text-sm h-[42px]"
            >
              <option value="ALL">Semua Role</option>
              {roleOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Admin / Employee Filter */}
          <div className="relative flex items-center">
            <UserCheck className="absolute left-3 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Filter Admin / Karyawan..."
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              className="pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-orange-500 text-sm h-[42px] w-48"
            />
            {adminSearch && (
              <button
                type="button"
                onClick={() => setAdminSearch('')}
                className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="h-6 w-[1px] bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>

          <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-center flex-1">
            <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
               <input type="checkbox" checked={isDateRange} onChange={(e) => setIsDateRange(e.target.checked)} className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
               Rentang Tanggal
            </label>

            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-orange-500 text-sm h-[42px]"
              title={isDateRange ? "Tanggal Mulai" : "Pilih Tanggal"}
            />
            {isDateRange && (
               <>
                  <span className="text-gray-500 font-medium">-</span>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-orange-500 text-sm h-[42px]"
                    title="Tanggal Akhir"
                  />
               </>
            )}

            <select 
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-orange-500 text-sm h-[42px]"
            >
              <option value="barcode">Barcode</option>
              <option value="destination">Destination</option>
              <option value="role">Role</option>
              <option value="admin_name">Nama Admin</option>
              <option value="employee_name">Nama Karyawan</option>
              <option value="id">Doc ID</option>
            </select>
            
            <div className="relative flex items-center flex-1 min-w-[160px]">
              <Search className="absolute left-3 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Cari data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-orange-500 text-sm h-[42px] w-full"
              />
              {searchTerm && (
                 <button 
                    type="button"
                    onClick={() => { setSearchTerm(''); fetchRecentData(); }}
                    className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors"
                    title="Hapus pencarian"
                 >
                    <X className="w-4 h-4" />
                 </button>
              )}
            </div>
            
            <button 
              type="submit"
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm h-[42px] transition-colors flex items-center gap-1.5"
            >
              <Search className="w-4 h-4" />
              Cari
            </button>
            
            <button 
              type="button"
              onClick={() => {
                setSelectedRole('ALL');
                setAdminSearch('');
                setSearchTerm('');
                fetchRecentData();
              }}
              title="Refresh / Reset Filter"
              className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors h-[42px] flex items-center justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </form>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 font-semibold w-16">No</th>
                <th className="px-4 py-3 font-semibold">Barcode</th>
                <th className="px-4 py-3 font-semibold">Destination</th>
                <th className="px-4 py-3 font-semibold">Role / Admin</th>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Doc ID</th>
                <th className="px-4 py-3 font-semibold text-right w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-700 dark:text-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Memuat data dari Firestore...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada data ditemukan.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">{item.barcode}</td>
                    <td className="px-4 py-3">{item.destination || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 mr-2">
                        {item.role || '-'}
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400 inline-block">{item.admin_name || item.employee_name || ''}</div>
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
                          title="Edit Document"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                          title="Delete Document"
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
        
        {!loading && items.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Menampilkan {filteredItems.length} data {filteredItems.length !== items.length ? `(difilter dari total ${items.length} data)` : limitCount === 0 ? '(Tanpa Batas / Semua Data)' : `terbaru`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Limit:</span>
              <select 
                value={limitCount}
                onChange={(e) => setLimitCount(Number(e.target.value))}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none px-3 py-1.5 focus:ring-2 focus:ring-orange-500"
              >
                <option value={100}>100 Data</option>
                <option value={500}>500 Data</option>
                <option value={1000}>1000 Data</option>
                <option value={2000}>2000 Data</option>
                <option value={5000}>5000 Data</option>
                <option value={0}>Tanpa Batas (Semua Data)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-500" />
                Edit Data Firestore
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Doc ID (Read Only)</label>
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
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 mt-auto">
              <button 
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                disabled={isSaving}
              >
                Batal
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
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
